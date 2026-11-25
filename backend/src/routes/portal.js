import { Router } from 'express'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { identificar, soloCliente, invalidarPerfil } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { formatearRut, rutValido } from '../lib/validaciones.js'
import { enviarCodigoVerificacion } from '../lib/correo.js'

const router = Router()

// Límite de intentos de vinculación: 5 cada 15 minutos por cuenta
const intentos = new Map()
const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000
const CODIGO_MS = 10 * 60 * 1000
const MAX_CODIGO_INTENTOS = 5

function permitirIntento(id) {
  const ahora = Date.now()
  const reg = intentos.get(id)
  if (!reg || reg.expira < ahora) {
    intentos.set(id, { cuenta: 1, expira: ahora + VENTANA_MS })
    return true
  }
  reg.cuenta++
  return reg.cuenta <= MAX_INTENTOS
}

// Vincular la cuenta de Auth0 con un cliente registrado (solo RUT)
router.post('/vincular', identificar, async (req, res) => {
  return res.status(410).json({ error: 'Usa el flujo de verificación por correo' })
  if (req.perfil) return res.status(400).json({ error: 'Tu cuenta ya está registrada en el sistema' })
  if (!permitirIntento(req.auth.id)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' })
  }

  const rut = formatearRut(req.body.rut)
  if (!rutValido(rut)) return res.status(400).json({ error: 'RUT inválido' })

  try {
    const cliente = await prisma.cliente.findUnique({ where: { rut } })
    if (!cliente) {
      return res.status(400).json({
        error: 'No hay un cliente registrado con ese RUT. Pide a la serviteca que te registre.'
      })
    }

    const yaVinculado = await prisma.perfil.findUnique({ where: { clienteRut: rut } })
    if (yaVinculado) {
      return res.status(400).json({
        error: 'Este cliente ya tiene una cuenta. Inicia sesión con ella o contacta a la serviteca.'
      })
    }

    await prisma.perfil.create({
      data: {
        id: req.auth.id,
        email: req.auth.email,
        nombre: cliente.nombre,
        rol: 'cliente',
        clienteRut: rut
      }
    })

    intentos.delete(req.auth.id)
    invalidarPerfil(req.auth.id)
    res.status(201).json({ ok: true })
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Este cliente ya tiene una cuenta vinculada' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo vincular la cuenta' })
  }
})

function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase()
}

function hashCodigo(codigo, salt) {
  return createHash('sha256').update(`${salt}:${codigo}`).digest('hex')
}

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

router.post('/vincular/codigo', identificar, async (req, res) => {
  if (req.perfil) return res.status(400).json({ error: 'Tu cuenta ya está registrada en el sistema' })
  if (!permitirIntento(req.auth.id)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' })

  const rut = formatearRut(req.body.rut)
  const email = normalizarCorreo(req.body.email)
  if (!rutValido(rut) || !correoValido(email)) return res.status(400).json({ error: 'Ingresa un RUT y correo válidos' })

  try {
    const cliente = await prisma.cliente.findFirst({
      where: { rut, correo: { equals: email, mode: 'insensitive' } },
      select: { nombre: true }
    })
    if (!cliente) return res.status(400).json({ error: 'El RUT y el correo no coinciden con un cliente registrado' })
    if (await prisma.perfil.findUnique({ where: { clienteRut: rut } })) {
      return res.status(400).json({ error: 'Este cliente ya tiene una cuenta vinculada' })
    }

    const codigo = String(randomInt(100000, 1000000))
    const salt = randomBytes(16).toString('hex')
    const expiraEn = new Date(Date.now() + CODIGO_MS)
    await prisma.verificacionPortal.upsert({
      where: { id: req.auth.id },
      update: { clienteRut: rut, email, codigoHash: hashCodigo(codigo, salt), salt, intentos: 0, expiraEn },
      create: { id: req.auth.id, clienteRut: rut, email, codigoHash: hashCodigo(codigo, salt), salt, expiraEn }
    })

    let envio
    try {
      envio = await enviarCodigoVerificacion({ destino: email, nombre: cliente.nombre, codigo })
    } catch (e) {
      await prisma.verificacionPortal.delete({ where: { id: req.auth.id } }).catch(() => {})
      console.error('No se pudo enviar el código:', e.message)
      return res.status(503).json({ error: 'No se pudo enviar el código. Inténtalo más tarde.' })
    }
    res.status(202).json({
      ok: true,
      expiraEn: expiraEn.toISOString(),
      ...(envio.modo === 'desarrollo' ? { codigoDesarrollo: envio.codigo } : {})
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo solicitar el código' })
  }
})

router.post('/vincular/verificar', identificar, async (req, res) => {
  if (req.perfil) return res.status(400).json({ error: 'Tu cuenta ya está registrada en el sistema' })
  const rut = formatearRut(req.body.rut)
  const email = normalizarCorreo(req.body.email)
  const codigo = String(req.body.codigo ?? '').trim()
  if (!rutValido(rut) || !correoValido(email) || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ error: 'Datos de verificación inválidos' })
  }

  try {
    const registro = await prisma.verificacionPortal.findUnique({ where: { id: req.auth.id } })
    if (!registro || registro.clienteRut !== rut || registro.email !== email) {
      return res.status(400).json({ error: 'El código no es válido o ya expiró' })
    }
    if (registro.expiraEn <= new Date()) {
      await prisma.verificacionPortal.delete({ where: { id: req.auth.id } }).catch(() => {})
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.' })
    }
    if (registro.intentos >= MAX_CODIGO_INTENTOS) {
      return res.status(429).json({ error: 'Demasiados intentos. Solicita un código nuevo.' })
    }

    const esperado = Buffer.from(registro.codigoHash, 'hex')
    const recibido = Buffer.from(hashCodigo(codigo, registro.salt), 'hex')
    const coincide = esperado.length === recibido.length && timingSafeEqual(esperado, recibido)
    if (!coincide) {
      await prisma.verificacionPortal.update({ where: { id: req.auth.id }, data: { intentos: { increment: 1 } } })
      return res.status(400).json({ error: 'El código no es válido o ya expiró' })
    }

    const cliente = await prisma.cliente.findFirst({
      where: { rut, correo: { equals: email, mode: 'insensitive' } },
      select: { nombre: true }
    })
    if (!cliente) return res.status(400).json({ error: 'El RUT y el correo ya no coinciden' })

    await prisma.$transaction([
      prisma.perfil.create({
        data: { id: req.auth.id, email: req.auth.email ?? email, nombre: cliente.nombre, rol: 'cliente', clienteRut: rut }
      }),
      prisma.verificacionPortal.delete({ where: { id: req.auth.id } })
    ])
    intentos.delete(req.auth.id)
    invalidarPerfil(req.auth.id)
    res.status(201).json({ ok: true })
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Este cliente ya tiene una cuenta vinculada' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo verificar la cuenta' })
  }
})

// Mis datos
router.get('/cliente', identificar, soloCliente, async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { rut: req.cliente.rut },
      select: { nombre: true, rut: true, creadoEn: true }
    })
    res.json(cliente)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener tus datos' })
  }
})

// Mis vehículos
router.get('/vehiculos', identificar, soloCliente, async (req, res) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { clienteRut: req.cliente.rut },
      select: {
        id: true,
        patente: true,
        marca: true,
        modelo: true,
        anio: true,
        kilometraje: true,
        creadoEn: true,
        ordenesTrabajo: {
          orderBy: { fechaIngreso: 'desc' },
          take: 1,
          select: { estado: true, fechaIngreso: true }
        }
      },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener tus vehículos' })
  }
})

// Detalle e historial de uno de mis vehículos
router.get('/vehiculos/:id', identificar, soloCliente, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Vehículo no encontrado' })

  try {
    const vehiculo = await prisma.vehiculo.findFirst({
      where: { id, clienteRut: req.cliente.rut },
      select: {
        id: true,
        patente: true,
        marca: true,
        modelo: true,
        anio: true,
        kilometraje: true,
        creadoEn: true,
        ordenesTrabajo: {
          orderBy: { fechaIngreso: 'desc' },
          select: {
            id: true,
            estado: true,
            fechaIngreso: true,
            fechaEntrega: true,
            kmIngreso: true,
            estadosHistorial: {
              orderBy: { fecha: 'asc' },
              select: { estado: true, fecha: true }
            },
            ordenServicios: {
              select: {
                id: true,
                cantidad: true,
                precioUnitario: true,
                servicio: { select: { nombre: true } }
              }
            },
            ordenProductos: {
              select: {
                id: true,
                cantidad: true,
                precioUnitario: true,
                producto: { select: { nombre: true } }
              }
            }
          }
        }
      }
    })
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' })
    res.json(vehiculo)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el vehículo' })
  }
})

// Mis notificaciones
router.get('/notificaciones', identificar, soloCliente, async (req, res) => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { cliente: { rut: req.cliente.rut } },
      select: {
        id: true,
        mensaje: true,
        enviadaEn: true,
        leidaEn: true,
        orden: { select: { id: true, vehiculo: { select: { id: true, patente: true } } } }
      },
      orderBy: { id: 'desc' },
      take: 50
    })
    res.json(notificaciones)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener tus notificaciones' })
  }
})

router.get('/notificaciones/no-leidas', identificar, soloCliente, async (req, res) => {
  try {
    const total = await prisma.notificacion.count({
      where: { cliente: { rut: req.cliente.rut }, leidaEn: null }
    })
    res.json({ total })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el conteo' })
  }
})

router.post('/notificaciones/leer', identificar, soloCliente, async (req, res) => {
  try {
    await prisma.notificacion.updateMany({
      where: { cliente: { rut: req.cliente.rut }, leidaEn: null },
      data: { leidaEn: new Date() }
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron marcar como leídas' })
  }
})

export default router
