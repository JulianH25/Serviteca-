import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { ErrorNegocio } from '../lib/errores.js'
import { limpiarPatente } from '../lib/validaciones.js'

const router = Router()

const ESTADOS = ['RECEPCIONADO', 'EN_PROCESO', 'TERMINADO', 'ENTREGADO', 'CANCELADO']
const ESTADOS_CERRADOS = ['ENTREGADO', 'CANCELADO']

const TX = { timeout: 20000, maxWait: 10000 }

const enteroNoNegativo = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0

const incluirDetalle = {
  vehiculo: {
    select: {
      id: true,
      patente: true,
      marca: true,
      modelo: true,
      anio: true,
      kilometraje: true,
      cliente: { select: { id: true, nombre: true, rut: true, telefono: true } }
    }
  },
  usuario: { select: { nombre: true, email: true } },
  ordenServicios: { include: { servicio: { select: { id: true, nombre: true } } }, orderBy: { id: 'asc' } },
  ordenProductos: { include: { producto: { select: { id: true, nombre: true, codigo: true } } }, orderBy: { id: 'asc' } },
  estadosHistorial: {
    orderBy: { fecha: 'asc' },
    include: { usuario: { select: { nombre: true, email: true } } }
  }
}

function totalOrden(orden) {
  const servicios = (orden.ordenServicios || []).reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
  const productos = (orden.ordenProductos || []).reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
  return servicios + productos
}

function responderError(res, e, porDefecto) {
  if (e instanceof ErrorNegocio) return res.status(e.status).json({ error: e.message })
  if (e.code === 'P2003') return res.status(400).json({ error: 'Referencia inválida (vehículo, servicio o producto)' })
  if (e.code === 'P2004' || e.code === '23514') return res.status(400).json({ error: 'Valor no permitido por la base de datos' })
  console.error(e)
  return res.status(500).json({ error: porDefecto })
}

// Normaliza y une duplicados: [{ id, cantidad, precio, notas }]
function leerItems(lista, campoId, nombre) {
  if (lista === undefined || lista === null) return []
  if (!Array.isArray(lista)) throw new ErrorNegocio(`Lista de ${nombre} inválida`)
  const mapa = new Map()
  for (const it of lista) {
    const id = Number(it?.[campoId])
    const cantidad = Number(it?.cantidad ?? 1)
    if (!Number.isInteger(id) || !Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ErrorNegocio(`Datos inválidos en ${nombre}`)
    }
    let precio = null
    if (it.precioUnitario !== undefined && it.precioUnitario !== null && it.precioUnitario !== '') {
      if (!enteroNoNegativo(it.precioUnitario)) throw new ErrorNegocio(`Precio inválido en ${nombre}`)
      precio = Number(it.precioUnitario)
    }
    const notas = String(it.notas ?? '').trim() || null
    const previo = mapa.get(id)
    if (previo) previo.cantidad += cantidad
    else mapa.set(id, { id, cantidad, precio, notas })
  }
  return [...mapa.values()]
}

// Agrega servicios y productos a una orden; descuenta stock y registra movimientos
async function agregarItems(tx, ordenId, usuarioId, servicios, productos) {
  if (servicios.length) {
    const catalogo = await tx.servicio.findMany({
      where: { id: { in: servicios.map((s) => s.id) }, activo: true }
    })
    const porId = new Map(catalogo.map((s) => [s.id, s]))
    for (const s of servicios) {
      const srv = porId.get(s.id)
      if (!srv) throw new ErrorNegocio(`El servicio ${s.id} no existe o está inactivo`)
      await tx.ordenServicio.create({
        data: {
          ordenId,
          servicioId: s.id,
          cantidad: s.cantidad,
          precioUnitario: s.precio ?? srv.precioBase,
          notas: s.notas
        }
      })
    }
  }

  for (const p of productos) {
    const prod = await tx.producto.findUnique({ where: { id: p.id } })
    if (!prod || !prod.activo) throw new ErrorNegocio(`El producto ${p.id} no existe o está inactivo`)

    const r = await tx.producto.updateMany({
      where: { id: p.id, stockActual: { gte: p.cantidad } },
      data: { stockActual: { decrement: p.cantidad } }
    })
    if (r.count === 0) {
      throw new ErrorNegocio(`Stock insuficiente de "${prod.nombre}" (disponible: ${prod.stockActual})`)
    }

    await tx.ordenProducto.create({
      data: { ordenId, productoId: p.id, cantidad: p.cantidad, precioUnitario: p.precio ?? prod.precioVenta }
    })
    await tx.movimientoInventario.create({
      data: {
        productoId: p.id,
        tipo: 'SALIDA',
        cantidad: p.cantidad,
        motivo: `Orden #${ordenId}`,
        ordenId,
        usuarioId
      }
    })
  }
}

async function detalleOrden(db, id) {
  const orden = await db.ordenTrabajo.findUnique({ where: { id }, include: incluirDetalle })
  return orden ? { ...orden, total: totalOrden(orden) } : null
}

// Listar: ?estado= ?q= (patente, cliente, RUT o N° de orden)
router.get('/', verificarToken, async (req, res) => {
  const estado = String(req.query.estado ?? '').toUpperCase()
  const q = String(req.query.q ?? '').trim()
  const where = {}

  if (estado) {
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })
    where.estado = estado
  }
  if (q) {
    const or = [
      { vehiculo: { patente: { contains: limpiarPatente(q) || q, mode: 'insensitive' } } },
      { vehiculo: { cliente: { nombre: { contains: q, mode: 'insensitive' } } } },
      { vehiculo: { clienteRut: { contains: q, mode: 'insensitive' } } }
    ]
    if (/^\d{1,9}$/.test(q)) or.push({ id: Number(q) })
    where.OR = or
  }

  try {
    const ordenes = await prisma.ordenTrabajo.findMany({
      where,
      orderBy: { fechaIngreso: 'desc' },
      take: 200,
      include: {
        vehiculo: {
          select: {
            id: true,
            patente: true,
            marca: true,
            modelo: true,
            cliente: { select: { id: true, nombre: true, rut: true } }
          }
        },
        ordenServicios: { select: { cantidad: true, precioUnitario: true } },
        ordenProductos: { select: { cantidad: true, precioUnitario: true } }
      }
    })
    res.json(
      ordenes.map(({ ordenServicios, ordenProductos, ...o }) => ({
        ...o,
        total: totalOrden({ ordenServicios, ordenProductos })
      }))
    )
  } catch (e) {
    responderError(res, e, 'No se pudieron obtener las órdenes')
  }
})

// Detalle
router.get('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Orden no encontrada' })
  try {
    const orden = await detalleOrden(prisma, id)
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(orden)
  } catch (e) {
    responderError(res, e, 'No se pudo obtener la orden')
  }
})

// Crear orden: { vehiculoId, kmIngreso?, observaciones?, servicios: [{ servicioId, cantidad?, precioUnitario?, notas? }], productos?: [{ productoId, cantidad, precioUnitario? }] }
router.post('/', verificarToken, async (req, res) => {
  const vehiculoId = Number(req.body.vehiculoId)
  const observaciones = String(req.body.observaciones ?? '').trim() || null
  const kmRaw = req.body.kmIngreso

  if (!Number.isInteger(vehiculoId)) return res.status(400).json({ error: 'Vehículo inválido' })
  if (kmRaw !== undefined && kmRaw !== null && kmRaw !== '' && !enteroNoNegativo(kmRaw)) {
    return res.status(400).json({ error: 'Kilometraje inválido' })
  }
  const kmIngreso = kmRaw === undefined || kmRaw === null || kmRaw === '' ? null : Number(kmRaw)

  try {
    const servicios = leerItems(req.body.servicios, 'servicioId', 'servicios')
    const productos = leerItems(req.body.productos, 'productoId', 'productos')
    if (!servicios.length) throw new ErrorNegocio('Agrega al menos un servicio a la orden')

    const id = await prisma.$transaction(async (tx) => {
      const vehiculo = await tx.vehiculo.findUnique({ where: { id: vehiculoId } })
      if (!vehiculo) throw new ErrorNegocio('El vehículo no existe', 404)

      const orden = await tx.ordenTrabajo.create({
        data: { vehiculoId, usuarioId: req.usuario.id, kmIngreso, observaciones }
      })
      await tx.ordenEstadoHistorial.create({
        data: { ordenId: orden.id, estado: orden.estado, usuarioId: req.usuario.id }
      })
      if (kmIngreso !== null && kmIngreso > (vehiculo.kilometraje ?? 0)) {
        await tx.vehiculo.update({ where: { id: vehiculoId }, data: { kilometraje: kmIngreso } })
      }
      await agregarItems(tx, orden.id, req.usuario.id, servicios, productos)
      return orden.id
    }, TX)

    res.status(201).json(await detalleOrden(prisma, id))
  } catch (e) {
    responderError(res, e, 'No se pudo crear la orden')
  }
})

// Cambiar estado (CANCELADO devuelve el stock de los productos)
router.patch('/:id/estado', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  const estado = String(req.body.estado ?? '').toUpperCase()
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Orden no encontrada' })
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

  try {
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenTrabajo.findUnique({ where: { id }, include: { ordenProductos: true } })
      if (!orden) throw new ErrorNegocio('Orden no encontrada', 404)
      if (ESTADOS_CERRADOS.includes(orden.estado)) {
        throw new ErrorNegocio('La orden está cerrada (entregada o cancelada) y no se puede modificar')
      }
      if (orden.estado === estado) throw new ErrorNegocio('La orden ya está en ese estado')

      if (estado === 'CANCELADO') {
        for (const p of orden.ordenProductos) {
          await tx.producto.update({
            where: { id: p.productoId },
            data: { stockActual: { increment: p.cantidad } }
          })
          await tx.movimientoInventario.create({
            data: {
              productoId: p.productoId,
              tipo: 'ENTRADA',
              cantidad: p.cantidad,
              motivo: `Anulación orden #${id}`,
              ordenId: id,
              usuarioId: req.usuario.id
            }
          })
        }
      }

      await tx.ordenTrabajo.update({
        where: { id },
        data: { estado, fechaEntrega: estado === 'ENTREGADO' ? new Date() : null }
      })
      await tx.ordenEstadoHistorial.create({
        data: { ordenId: id, estado, usuarioId: req.usuario.id }
      })
    }, TX)

    res.json(await detalleOrden(prisma, id))
  } catch (e) {
    responderError(res, e, 'No se pudo cambiar el estado')
  }
})

// Registrar trabajo realizado: agregar servicio a una orden existente
router.post('/:id/servicios', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Orden no encontrada' })
  try {
    const servicios = leerItems([req.body], 'servicioId', 'servicios')
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenTrabajo.findUnique({ where: { id } })
      if (!orden) throw new ErrorNegocio('Orden no encontrada', 404)
      if (ESTADOS_CERRADOS.includes(orden.estado)) {
        throw new ErrorNegocio('La orden está cerrada (entregada o cancelada) y no se puede modificar')
      }
      await agregarItems(tx, id, req.usuario.id, servicios, [])
    }, TX)
    res.status(201).json(await detalleOrden(prisma, id))
  } catch (e) {
    responderError(res, e, 'No se pudo agregar el servicio')
  }
})

// Agregar producto a una orden existente (descuenta stock)
router.post('/:id/productos', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Orden no encontrada' })
  try {
    const productos = leerItems([req.body], 'productoId', 'productos')
    await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenTrabajo.findUnique({ where: { id } })
      if (!orden) throw new ErrorNegocio('Orden no encontrada', 404)
      if (ESTADOS_CERRADOS.includes(orden.estado)) {
        throw new ErrorNegocio('La orden está cerrada (entregada o cancelada) y no se puede modificar')
      }
      await agregarItems(tx, id, req.usuario.id, [], productos)
    }, TX)
    res.status(201).json(await detalleOrden(prisma, id))
  } catch (e) {
    responderError(res, e, 'No se pudo agregar el producto')
  }
})

export default router