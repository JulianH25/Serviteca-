import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', verificarToken, async (req, res) => {
  try {
    const categorias = await prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } })
    res.json(categorias)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener las categorías' })
  }
})

router.post('/', verificarToken, async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim()
  if (!nombre || nombre.length > 60) return res.status(400).json({ error: 'Nombre de categoría inválido' })
  try {
    const categoria = await prisma.categoriaProducto.create({ data: { nombre } })
    res.status(201).json(categoria)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear la categoría' })
  }
})

export default router