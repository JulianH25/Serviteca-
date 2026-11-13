import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { ErrorNegocio } from '../lib/errores.js'

const router = Router()

const ESTADOS = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'CONVERTIDO']
const TX = { timeout: 20000, maxWait: 10000 }
const IVA = 0.19

const enteroNoNegativo = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= 0

const incluirDetalle = {
  vehiculo: {
    select: {
      id: true,
      patente: true,
      marca: true,
      modelo: true,
      cliente: { select: { id: true, nombre: true, rut: true, telefono: true } }
    }
  },
  usuario: { select: { nombre: true, email: true } },
  detalle: {
    include: {
      servicio: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true, codigo: true } }
    },
    orderBy: { id: 'asc' }
  }
}

function responderError(res, e, porDefecto) {
  if (e instanceof ErrorNegocio) return res.status(e.status).json({ error: e.message })
  if (e.code === 'P2003') return res.status(400).json({ error: 'Referencia inválida (vehículo, servicio o producto)' })
  console.error(e)
  return res.status(500).json({ error: porDefecto })
}

// Normaliza líneas: [{ servicioId? | productoId?, cantidad, precioUnitario? }]
async function leerLineas(db, lista) {
  if (!Array.isArray(lista) || !lista.length) throw new ErrorNegocio('Agrega al menos una línea al presupuesto')
  const lineas = []
  for (const it of lista) {
    const cantidad = Number(it?.cantidad ?? 1)
    if (!Number.isInteger(cantidad) || cantidad <= 0) throw new ErrorNegocio('Cantidad inválida en el detalle')

    const servicioId = it.servicioId ? Number(it.servicioId) : null
    const productoId = it.productoId ? Number(it.productoId) : null
    if ((servicioId && productoId) || (!servicioId && !productoId)) {
      throw new ErrorNegocio('Cada línea debe ser un servicio o un producto')
    }

    let descripcion
    let precioBase
    if (servicioId) {
      const s = await db.servicio.findUnique({ where: { id: servicioId } })
      if (!s || !s.activo) throw new ErrorNegocio(`El servicio ${servicioId} no existe o está inactivo`)
      descripcion = s.nombre
      precioBase = s.precioBase
    } else {
      const p = await db.producto.findUnique({ where: { id: productoId } })
      if (!p || !p.activo) throw new ErrorNegocio(`El producto ${productoId} no existe o está inactivo`)
      descripcion = p.nombre
      precioBase = p.precioVenta
    }

    let precioUnitario = precioBase
    if (it.precioUnitario !== undefined && it.precioUnitario !== null && it.precioUnitario !== '') {
      if (!enteroNoNegativo(it.precioUnitario)) throw new ErrorNegocio('Precio inválido en el detalle')
      precioUnitario = Number(it.precioUnitario)
    }

    lineas.push({ servicioId, productoId, descripcion, cantidad, precioUnitario })
  }
  return lineas
}

// Listar: ?estado= ?q= (patente, cliente, RUT o N° de presupuesto)
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
      { vehiculo: { patente: { contains: q.replace(/[^a-zA-Z0-9]/g, '') || q, mode: 'insensitive' } } },
      { vehiculo: { cliente: { nombre: { contains: q, mode: 'insensitive' } } } },
      { vehiculo: { clienteRut: { contains: q, mode: 'insensitive' } } }
    ]
    if (/^\d{1,9}$/.test(q)) or.push({ id: Number(q) })
    where.OR = or
  }

  try {
    const presupuestos = await prisma.presupuesto.findMany({
      where,
      orderBy: { id: 'desc' },
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
        }
      }
    })
    res.json(presupuestos)
  } catch (e) {
    responderError(res, e, 'No se pudieron obtener los presupuestos')
  }
})

// Detalle
router.get('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Presupuesto no encontrado' })
  try {
    const presupuesto = await prisma.presupuesto.findUnique({ where: { id }, include: incluirDetalle })
    if (!presupuesto) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    res.json(presupuesto)
  } catch (e) {
    responderError(res, e, 'No se pudo obtener el presupuesto')
  }
})

// Crear: { vehiculoId, validezDias?, detalle: [{ servicioId | productoId, cantidad, precioUnitario? }] }
router.post('/', verificarToken, async (req, res) => {
  const vehiculoId = Number(req.body.vehiculoId)
  const validezRaw = req.body.validezDias
  if (!Number.isInteger(vehiculoId)) return res.status(400).json({ error: 'Vehículo inválido' })

  let validezDias = 15
  if (validezRaw !== undefined && validezRaw !== null && validezRaw !== '') {
    if (!Number.isInteger(Number(validezRaw)) || Number(validezRaw) < 1 || Number(validezRaw) > 365) {
      return res.status(400).json({ error: 'Validez inválida' })
    }
    validezDias = Number(validezRaw)
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      const vehiculo = await tx.vehiculo.findUnique({ where: { id: vehiculoId } })
      if (!vehiculo) throw new ErrorNegocio('El vehículo no existe', 404)

      const lineas = await leerLineas(tx, req.body.detalle)
      const total = lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0)
      const subtotal = Math.round(total / (1 + IVA))
      const iva = total - subtotal

      const creado = await tx.presupuesto.create({
        data: {
          vehiculoId,
          usuarioId: req.usuario.id,
          validezDias,
          subtotal,
          iva,
          total,
          detalle: { create: lineas }
        }
      })
      return creado.id
    }, TX)

    const presupuesto = await prisma.presupuesto.findUnique({ where: { id }, include: incluirDetalle })
    res.status(201).json(presupuesto)
  } catch (e) {
    responderError(res, e, 'No se pudo crear el presupuesto')
  }
})

// Cambiar estado (PENDIENTE / APROBADO / RECHAZADO)
router.patch('/:id/estado', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  const estado = String(req.body.estado ?? '').toUpperCase()
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Presupuesto no encontrado' })
  if (!['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }

  try {
    const actual = await prisma.presupuesto.findUnique({ where: { id } })
    if (!actual) return res.status(404).json({ error: 'Presupuesto no encontrado' })
    if (actual.estado === 'CONVERTIDO') {
      return res.status(400).json({ error: 'El presupuesto ya fue convertido en orden y no se puede modificar' })
    }
    if (actual.estado === estado) return res.status(400).json({ error: 'El presupuesto ya está en ese estado' })

    const presupuesto = await prisma.presupuesto.update({
      where: { id },
      data: { estado },
      include: incluirDetalle
    })
    res.json(presupuesto)
  } catch (e) {
    responderError(res, e, 'No se pudo cambiar el estado')
  }
})

// Convertir en orden de trabajo (solo presupuestos APROBADOS)
router.post('/:id/orden', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Presupuesto no encontrado' })

  try {
    const ordenId = await prisma.$transaction(async (tx) => {
      const p = await tx.presupuesto.findUnique({ where: { id }, include: { detalle: true } })
      if (!p) throw new ErrorNegocio('Presupuesto no encontrado', 404)
      if (p.ordenId) throw new ErrorNegocio(`Este presupuesto ya fue convertido en la orden #${p.ordenId}`)
      if (p.estado !== 'APROBADO') throw new ErrorNegocio('Solo se pueden convertir presupuestos aprobados')

      const vehiculo = await tx.vehiculo.findUnique({ where: { id: p.vehiculoId } })

      const orden = await tx.ordenTrabajo.create({
        data: {
          vehiculoId: p.vehiculoId,
          usuarioId: req.usuario.id,
          kmIngreso: vehiculo?.kilometraje ?? null,
          observaciones: `Generada desde presupuesto #${p.id}`
        }
      })
      await tx.ordenEstadoHistorial.create({
        data: { ordenId: orden.id, estado: orden.estado, usuarioId: req.usuario.id }
      })

      for (const l of p.detalle) {
        if (l.servicioId) {
          await tx.ordenServicio.create({
            data: {
              ordenId: orden.id,
              servicioId: l.servicioId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario
            }
          })
        } else if (l.productoId) {
          const r = await tx.producto.updateMany({
            where: { id: l.productoId, stockActual: { gte: l.cantidad } },
            data: { stockActual: { decrement: l.cantidad } }
          })
          if (r.count === 0) throw new ErrorNegocio(`Stock insuficiente de "${l.descripcion}"`)
          await tx.ordenProducto.create({
            data: {
              ordenId: orden.id,
              productoId: l.productoId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario
            }
          })
          await tx.movimientoInventario.create({
            data: {
              productoId: l.productoId,
              tipo: 'SALIDA',
              cantidad: l.cantidad,
              motivo: `Orden #${orden.id}`,
              ordenId: orden.id,
              usuarioId: req.usuario.id
            }
          })
        }
      }

      await tx.presupuesto.update({
        where: { id },
        data: { ordenId: orden.id, estado: 'CONVERTIDO' }
      })
      return orden.id
    }, TX)

    res.status(201).json({ ordenId })
  } catch (e) {
    responderError(res, e, 'No se pudo convertir el presupuesto en orden')
  }
})

export default router