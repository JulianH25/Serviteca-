import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { ErrorNegocio } from '../lib/errores.js'

const router = Router()

const enteroNoNegativo = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0

// Listar: ?q= ?categoriaId= ?stockBajo=true ?activos=true
router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const where = {}
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { codigo: { contains: q, mode: 'insensitive' } }
    ]
  }
  if (req.query.categoriaId) {
    const categoriaId = Number(req.query.categoriaId)
    if (!Number.isInteger(categoriaId)) return res.status(400).json({ error: 'Categoría inválida' })
    where.categoriaId = categoriaId
  }
  if (req.query.activos === 'true') where.activo = true

  try {
    let productos = await prisma.producto.findMany({
      where,
      include: { categoria: true },
      orderBy: { nombre: 'asc' }
    })
    if (req.query.stockBajo === 'true') {
      productos = productos.filter((p) => p.stockActual <= p.stockMinimo)
    }
    res.json(productos)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener los productos' })
  }
})

// Detalle con últimos movimientos
router.get('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Producto no encontrado' })
  try {
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        categoria: true,
        movimientosInventario: {
          orderBy: { fecha: 'desc' },
          take: 50,
          include: { usuario: { select: { nombre: true, email: true } } }
        }
      }
    })
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(producto)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el producto' })
  }
})

// Crear producto (si trae stock inicial, registra la ENTRADA)
router.post('/', verificarToken, async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim()
  const codigo = String(req.body.codigo ?? '').trim() || null
  const categoriaId = req.body.categoriaId ? Number(req.body.categoriaId) : null
  const costo = req.body.costo ?? 0
  const precioVenta = req.body.precioVenta
  const stockActual = req.body.stockActual ?? 0
  const stockMinimo = req.body.stockMinimo ?? 0

  if (!nombre || nombre.length > 120) return res.status(400).json({ error: 'Nombre del producto inválido' })
  if (codigo && codigo.length > 30) return res.status(400).json({ error: 'Código demasiado largo' })
  if (categoriaId !== null && !Number.isInteger(categoriaId)) return res.status(400).json({ error: 'Categoría inválida' })
  if (!enteroNoNegativo(precioVenta)) return res.status(400).json({ error: 'Precio de venta inválido' })
  if (!enteroNoNegativo(costo)) return res.status(400).json({ error: 'Costo inválido' })
  if (!enteroNoNegativo(stockActual)) return res.status(400).json({ error: 'Stock inicial inválido' })
  if (!enteroNoNegativo(stockMinimo)) return res.status(400).json({ error: 'Stock mínimo inválido' })

  try {
    const producto = await prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          nombre,
          codigo,
          categoriaId,
          costo: Number(costo),
          precioVenta: Number(precioVenta),
          stockActual: Number(stockActual),
          stockMinimo: Number(stockMinimo)
        },
        include: { categoria: true }
      })
      if (creado.stockActual > 0) {
        await tx.movimientoInventario.create({
          data: {
            productoId: creado.id,
            tipo: 'ENTRADA',
            cantidad: creado.stockActual,
            motivo: 'Stock inicial',
            usuarioId: req.usuario.id
          }
        })
      }
      return creado
    })
    res.status(201).json(producto)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un producto con ese código' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'La categoría no existe' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo crear el producto' })
  }
})

// Editar datos (el stock solo cambia con movimientos)
router.patch('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Producto no encontrado' })

  const data = {}
  const b = req.body
  if (b.nombre !== undefined) {
    const nombre = String(b.nombre).trim()
    if (!nombre || nombre.length > 120) return res.status(400).json({ error: 'Nombre del producto inválido' })
    data.nombre = nombre
  }
  if (b.codigo !== undefined) data.codigo = String(b.codigo).trim() || null
  if (b.categoriaId !== undefined) {
    const categoriaId = b.categoriaId ? Number(b.categoriaId) : null
    if (categoriaId !== null && !Number.isInteger(categoriaId)) return res.status(400).json({ error: 'Categoría inválida' })
    data.categoriaId = categoriaId
  }
  for (const campo of ['costo', 'precioVenta', 'stockMinimo']) {
    if (b[campo] !== undefined) {
      if (!enteroNoNegativo(b[campo])) return res.status(400).json({ error: `Valor inválido en ${campo}` })
      data[campo] = Number(b[campo])
    }
  }
  if (b.activo !== undefined) data.activo = Boolean(b.activo)

  try {
    const producto = await prisma.producto.update({ where: { id }, data, include: { categoria: true } })
    res.json(producto)
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Producto no encontrado' })
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un producto con ese código' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'La categoría no existe' })
    console.error(e)
    res.status(500).json({ error: 'No se pudo actualizar el producto' })
  }
})

// Registrar movimiento de inventario (ENTRADA o SALIDA)
router.post('/:id/movimientos', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  const tipo = String(req.body.tipo ?? '').toUpperCase()
  const cantidad = Number(req.body.cantidad)
  const motivo = String(req.body.motivo ?? '').trim().slice(0, 200) || null

  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Producto no encontrado' })
  if (!['ENTRADA', 'SALIDA'].includes(tipo)) return res.status(400).json({ error: 'Tipo de movimiento inválido' })
  if (!Number.isInteger(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' })

  try {
    const producto = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.producto.updateMany({
        where: tipo === 'SALIDA' ? { id, stockActual: { gte: cantidad } } : { id },
        data: { stockActual: tipo === 'SALIDA' ? { decrement: cantidad } : { increment: cantidad } }
      })
      if (actualizado.count === 0) {
        const existe = await tx.producto.findUnique({ where: { id }, select: { id: true } })
        throw existe
          ? new ErrorNegocio('Stock insuficiente para registrar la salida')
          : new ErrorNegocio('Producto no encontrado', 404)
      }
      await tx.movimientoInventario.create({
        data: { productoId: id, tipo, cantidad, motivo, usuarioId: req.usuario.id }
      })
      return tx.producto.findUnique({ where: { id }, include: { categoria: true } })
    })
    res.status(201).json(producto)
  } catch (e) {
    if (e instanceof ErrorNegocio) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'No se pudo registrar el movimiento' })
  }
})

export default router