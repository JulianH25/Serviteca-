import { Router } from 'express'
import { verificarToken, verificarDueno } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { ErrorNegocio } from '../lib/errores.js'

const router = Router()

const METODOS = ['EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA']
const TX = { timeout: 20000, maxWait: 10000 }

function alcanceOrden(ordenId, perfil) {
  return perfil?.rol === 'dueno'
    ? { id: ordenId }
    : { id: ordenId, vehiculo: { cliente: { registradoPorId: perfil.id } } }
}

const enteroPositivo = (v) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) > 0

const incluirPago = {
  comprobante: true,
  usuario: { select: { nombre: true, email: true } }
}

function responderError(res, e, porDefecto) {
  if (e instanceof ErrorNegocio) return res.status(e.status).json({ error: e.message })
  if (e.code === 'P2003') return res.status(400).json({ error: 'La orden no existe' })
  if (e.code === 'P2002') return res.status(400).json({ error: 'Número de comprobante duplicado, inténtalo de nuevo' })
  console.error(e)
  return res.status(500).json({ error: porDefecto })
}

async function totalDeOrden(db, ordenId) {
  const [servicios, productos] = await Promise.all([
    db.ordenServicio.findMany({ where: { ordenId }, select: { cantidad: true, precioUnitario: true } }),
    db.ordenProducto.findMany({ where: { ordenId }, select: { cantidad: true, precioUnitario: true } })
  ])
  const suma = (l) => l.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
  return suma(servicios) + suma(productos)
}

async function resumenPagos(db, ordenId) {
  const total = await totalDeOrden(db, ordenId)
  const pagos = await db.pago.findMany({
    where: { ordenId },
    orderBy: { fecha: 'asc' },
    include: incluirPago
  })
  const pagado = pagos.reduce((s, p) => s + p.monto, 0)
  return { ordenId, total, pagado, saldo: total - pagado, pagos }
}

async function registrarPago(req, res, ordenId) {
  const metodo = String(req.body.metodo ?? '').toUpperCase()
  const monto = req.body.monto

  if (!Number.isInteger(ordenId)) return res.status(404).json({ error: 'Orden no encontrada' })
  if (!METODOS.includes(metodo)) {
    return res.status(400).json({ error: `Método de pago inválido (${METODOS.join(', ')})` })
  }
  if (!enteroPositivo(monto)) return res.status(400).json({ error: 'Monto inválido' })

  try {
    const pagoId = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenTrabajo.findFirst({ where: alcanceOrden(ordenId, req.perfil) })
      if (!orden) throw new ErrorNegocio('Orden no encontrada', 404)
      if (orden.estado === 'CANCELADO') throw new ErrorNegocio('No se puede pagar una orden cancelada')

      const total = await totalDeOrden(tx, ordenId)
      const agg = await tx.pago.aggregate({ where: { ordenId }, _sum: { monto: true } })
      const saldo = total - (agg._sum.monto ?? 0)

      if (saldo <= 0) throw new ErrorNegocio('La orden ya está pagada por completo')
      if (Number(monto) > saldo) {
        throw new ErrorNegocio(`El monto excede el saldo pendiente (${saldo})`)
      }

      const pago = await tx.pago.create({
        data: { ordenId, monto: Number(monto), metodo, usuarioId: req.usuario.id }
      })
      await tx.comprobante.create({
        data: { pagoId: pago.id, numero: `C-${String(pago.id).padStart(6, '0')}` }
      })
      return pago.id
    }, TX)

    const pago = await prisma.pago.findUnique({ where: { id: pagoId }, include: incluirPago })
    res.status(201).json(pago)
  } catch (e) {
    responderError(res, e, 'No se pudo registrar el pago')
  }
}

// Pagos de una orden con total, pagado y saldo (personal: lo usa recepción para cobrar)
router.get('/orden/:ordenId', verificarToken, async (req, res) => {
  const ordenId = Number(req.params.ordenId)
  if (!Number.isInteger(ordenId)) return res.status(404).json({ error: 'Orden no encontrada' })
  try {
    const orden = await prisma.ordenTrabajo.findFirst({ where: alcanceOrden(ordenId, req.perfil), select: { id: true } })
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' })
    res.json(await resumenPagos(prisma, ordenId))
  } catch (e) {
    responderError(res, e, 'No se pudieron obtener los pagos')
  }
})

// Listar pagos: ?ordenId= (solo dueño)
router.get('/', verificarToken, async (req, res) => {
  const where = {}
  if (req.perfil.rol !== 'dueno') {
    where.orden = { vehiculo: { cliente: { registradoPorId: req.perfil.id } } }
  }
  if (req.query.desde || req.query.hasta) {
    const fecha = {}
    if (req.query.desde) {
      const desde = new Date(`${req.query.desde}T00:00:00`)
      if (Number.isNaN(desde.getTime())) return res.status(400).json({ error: 'Rango de fechas inválido' })
      fecha.gte = desde
    }
    if (req.query.hasta) {
      const hasta = new Date(`${req.query.hasta}T23:59:59.999`)
      if (Number.isNaN(hasta.getTime())) return res.status(400).json({ error: 'Rango de fechas inválido' })
      fecha.lte = hasta
    }
    where.fecha = fecha
  }
  if (req.query.ordenId) {
    const ordenId = Number(req.query.ordenId)
    if (!Number.isInteger(ordenId)) return res.status(400).json({ error: 'Orden inválida' })
    where.ordenId = ordenId
  }
  try {
    const pagos = await prisma.pago.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 200,
      include: {
        ...incluirPago,
        orden: {
          select: {
            id: true,
            vehiculo: {
              select: {
                patente: true,
                cliente: { select: { nombre: true } }
              }
            }
          }
        }
      }
    })
    res.json(pagos)
  } catch (e) {
    responderError(res, e, 'No se pudieron obtener los pagos')
  }
})

// Detalle de un pago con su comprobante y la orden (solo dueño)
router.get('/:id', verificarDueno, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Pago no encontrado' })
  try {
    const pago = await prisma.pago.findUnique({
      where: { id },
      include: {
        ...incluirPago,
        orden: {
          select: {
            id: true,
            vehiculo: {
              select: {
                patente: true,
                marca: true,
                modelo: true,
                cliente: { select: { nombre: true, rut: true } }
              }
            }
          }
        }
      }
    })
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' })
    res.json(pago)
  } catch (e) {
    responderError(res, e, 'No se pudo obtener el pago')
  }
})

// Registrar pago: { ordenId, monto, metodo }
router.post('/', verificarToken, (req, res) => registrarPago(req, res, Number(req.body.ordenId)))

// Alias: POST /api/pagos/orden/:ordenId con { monto, metodo }
router.post('/orden/:ordenId', verificarToken, (req, res) =>
  registrarPago(req, res, Number(req.params.ordenId))
)

export default router
