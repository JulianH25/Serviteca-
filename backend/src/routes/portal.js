import { Router } from 'express'
import { identificar, soloCliente, invalidarPerfil } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { formatearRut, rutValido } from '../lib/validaciones.js'

const router = Router()

// Límite de intentos de vinculación: 5 cada 15 minutos por cuenta
const intentos = new Map()
const MAX_INTENTOS = 5
const VENTANA_MS = 15 * 60 * 1000

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

export default router