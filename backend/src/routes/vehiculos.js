import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const limpiarPatente = (p) => String(p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
const patenteValida = (p) => /^[A-Z]{4}\d{2}$/.test(p) || /^[A-Z]{2}\d{4}$/.test(p)

// Listar / buscar
router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: q
        ? {
            OR: [
              { patente: { contains: limpiarPatente(q) || q, mode: 'insensitive' } },
              { marca: { contains: q, mode: 'insensitive' } },
              { modelo: { contains: q, mode: 'insensitive' } },
              { cliente: { nombre: { contains: q, mode: 'insensitive' } } }
            ]
          }
        : undefined,
      include: { cliente: { select: { id: true, nombre: true, rut: true } } },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehículos' })
  }
})

// Vehículos de un cliente
router.get('/cliente/:clienteId', verificarToken, async (req, res) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { clienteId: Number(req.params.clienteId) },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehículos del cliente' })
  }
})

// Historial de servicios de un vehículo
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
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' })
    res.json(vehiculo)
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el historial' })
  }
})

// Registrar vehículo
router.post('/', verificarToken, async (req, res) => {
  const { marca, modelo, anio, kilometraje, clienteId } = req.body
  const patente = limpiarPatente(req.body.patente)

  if (!patenteValida(patente)) return res.status(400).json({ error: 'Patente inválida' })
  if (!marca?.trim() || !modelo?.trim()) {
    return res.status(400).json({ error: 'Marca y modelo son obligatorios' })
  }
  if (!Number.isInteger(Number(anio))) return res.status(400).json({ error: 'Año inválido' })

  try {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        patente,
        marca: marca.trim(),
        modelo: modelo.trim(),
        anio: Number(anio),
        kilometraje: kilometraje == null || kilometraje === '' ? null : Number(kilometraje),
        clienteId: Number(clienteId)
      }
    })
    res.status(201).json(vehiculo)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un vehículo con esa patente' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'El cliente no existe' })
    res.status(500).json({ error: 'No se pudo registrar el vehículo' })
  }
})

export default router