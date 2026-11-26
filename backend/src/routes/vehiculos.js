import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const limpiarPatente = (p) => String(p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
const patenteValida = (p) => /^[A-Z]{4}\d{2}$/.test(p) || /^[A-Z]{2}\d{4}$/.test(p)

function limpiarRut(rut) {
  return String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return limpio
  return `${limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`
}

function rutValido(rut) {
  const limpio = limpiarRut(rut)
  return /^\d{7,8}[0-9K]$/.test(limpio)
}

router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const esDueno = req.perfil?.rol === 'dueno'
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        ...(esDueno ? {} : { cliente: { registradoPorId: req.perfil.id } }),
        ...(q
          ? {
            OR: [
              { patente: { contains: limpiarPatente(q) || q, mode: 'insensitive' } },
              { marca: { contains: q, mode: 'insensitive' } },
              { modelo: { contains: q, mode: 'insensitive' } },
              { cliente: { nombre: { contains: q, mode: 'insensitive' } } }
            ]
          }
          : {})
      },
      include: { cliente: { select: { id: true, nombre: true, telefono: true, rut: true } } },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(
      vehiculos.map((v) => ({
        ...v,
        cliente: v.cliente && !esDueno ? { ...v.cliente, rut: null } : v.cliente
      }))
    )
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehiculos' })
  }
})

router.get('/cliente/:rut', verificarToken, async (req, res) => {
  const rut = formatearRut(req.params.rut)
  if (!rutValido(rut)) return res.status(400).json({ error: 'RUT invalido' })
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        clienteRut: rut,
        ...(req.perfil?.rol === 'dueno' ? {} : { cliente: { registradoPorId: req.perfil.id } })
      },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehiculos del cliente' })
  }
})

router.get('/:id/historial', verificarToken, async (req, res) => {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cliente: true,
        ordenesTrabajo: {
          orderBy: { fechaIngreso: 'desc' },
          include: {
            ordenServicios: { include: { servicio: true } },
            ordenProductos: { include: { producto: true } }
          }
        }
      }
    })
    if (!vehiculo) return res.status(404).json({ error: 'Vehiculo no encontrado' })
    if (req.perfil?.rol !== 'dueno' && vehiculo.cliente?.registradoPorId !== req.perfil.id) {
      return res.status(404).json({ error: 'Vehiculo no encontrado' })
    }
    if (req.perfil?.rol !== 'dueno' && vehiculo.cliente) {
      vehiculo.cliente.rut = null
      vehiculo.cliente.correo = null
    }
    res.json(vehiculo)
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el historial' })
  }
})

router.post('/', verificarToken, async (req, res) => {
  const { marca, modelo, anio, kilometraje } = req.body
  const patente = limpiarPatente(req.body.patente)
  const clienteId = Number(req.body.clienteId)
  if (!Number.isInteger(clienteId)) return res.status(400).json({ error: 'Cliente invalido' })
  if (!patenteValida(patente)) return res.status(400).json({ error: 'Patente invalida' })
  if (!marca?.trim() || !modelo?.trim()) return res.status(400).json({ error: 'Marca y modelo son obligatorios' })
  if (!Number.isInteger(Number(anio))) return res.status(400).json({ error: 'Anio invalido' })

  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) return res.status(400).json({ error: 'El cliente no existe. Registralo primero.' })
    if (req.perfil?.rol !== 'dueno' && cliente.registradoPorId !== req.perfil.id) {
      return res.status(403).json({ error: 'El cliente ya fue validado por el dueño' })
    }
    const vehiculo = await prisma.vehiculo.create({
      data: {
        clienteId,
        clienteRut: cliente.rut,
        patente,
        marca: marca.trim(),
        modelo: modelo.trim(),
        anio: Number(anio),
        kilometraje: kilometraje == null || kilometraje === '' ? null : Number(kilometraje)
      }
    })
    res.status(201).json(vehiculo)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un vehiculo con esa patente' })
    res.status(500).json({ error: 'No se pudo registrar el vehiculo' })
  }
})

router.delete('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Vehiculo invalido' })

  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id },
      select: {
        id: true,
        cliente: { select: { registradoPorId: true } },
        _count: { select: { ordenesTrabajo: true, presupuestos: true } }
      }
    })
    if (!vehiculo) return res.status(404).json({ error: 'Vehiculo no encontrado' })
    if (req.perfil.rol !== 'dueno' && vehiculo.cliente?.registradoPorId !== req.perfil.id) {
      return res.status(404).json({ error: 'Vehiculo no encontrado' })
    }
    if (vehiculo._count.ordenesTrabajo > 0 || vehiculo._count.presupuestos > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el vehiculo porque tiene ordenes o presupuestos asociados'
      })
    }

    await prisma.vehiculo.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo eliminar el vehiculo' })
  }
})

export default router
