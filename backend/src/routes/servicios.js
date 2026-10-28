import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const enteroNoNegativo = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0

// Listar catálogo (?activos=true para solo los habilitados)
router.get('/', verificarToken, async (req, res) => {
  try {
    const servicios = await prisma.servicio.findMany({
      where: req.query.activos === 'true' ? { activo: true } : undefined,
      orderBy: { nombre: 'asc' }
    })
    res.json(servicios)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener los servicios' })
  }
})

// Crear servicio
router.post('/', verificarToken, async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim()
  const descripcion = String(req.body.descripcion ?? '').trim() || null
  const precioBase = req.body.precioBase ?? 0

  if (!nombre || nombre.length > 80) return res.status(400).json({ error: 'Nombre del servicio inválido' })
  if (!enteroNoNegativo(precioBase)) return res.status(400).json({ error: 'Precio base inválido' })

  try {
    const servicio = await prisma.servicio.create({
      data: { nombre, descripcion, precioBase: Number(precioBase) }
    })
    res.status(201).json(servicio)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un servicio con ese nombre' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear el servicio' })
  }
})

// Editar / activar / desactivar
router.patch('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Servicio no encontrado' })

  const data = {}
  if (req.body.nombre !== undefined) {
    const nombre = String(req.body.nombre).trim()
    if (!nombre || nombre.length > 80) return res.status(400).json({ error: 'Nombre del servicio inválido' })
    data.nombre = nombre
  }
  if (req.body.descripcion !== undefined) data.descripcion = String(req.body.descripcion).trim() || null
  if (req.body.precioBase !== undefined) {
    if (!enteroNoNegativo(req.body.precioBase)) return res.status(400).json({ error: 'Precio base inválido' })
    data.precioBase = Number(req.body.precioBase)
  }
  if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo)

  try {
    const servicio = await prisma.servicio.update({ where: { id }, data })
    res.json(servicio)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Servicio no encontrado' })
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un servicio con ese nombre' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo actualizar el servicio' })
  }
})

export default router