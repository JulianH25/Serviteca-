import { Router } from 'express'
import { verificarDueno } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

function rangoFechas(q) {
  const ahora = new Date()
  let desde = q.desde ? new Date(`${q.desde}T00:00:00`) : new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  let hasta = q.hasta ? new Date(`${q.hasta}T23:59:59.999`) : ahora
  if (isNaN(desde) || isNaN(hasta) || desde > hasta) return null
  return { desde, hasta }
}

const dia = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

router.get('/resumen', verificarDueno, async (req, res) => {
  const rango = rangoFechas(req.query)
  if (!rango) return res.status(400).json({ error: 'Rango de fechas inválido' })
  const { desde, hasta } = rango

  try {
    const [pagos, ordenes, ordenesActivas, productos, todasConSaldo] = await Promise.all([
      prisma.pago.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        orderBy: { fecha: 'desc' },
        include: {
          comprobante: true,
          usuario: { select: { nombre: true, email: true } },
          orden: { select: { vehiculo: { select: { patente: true, cliente: { select: { nombre: true } } } } } }
        }
      }),
      prisma.ordenTrabajo.findMany({
        where: { fechaIngreso: { gte: desde, lte: hasta } },
        include: {
          ordenServicios: { include: { servicio: { select: { nombre: true } } } },
          ordenProductos: { include: { producto: { select: { nombre: true, costo: true } } } }
        }
      }),
      prisma.ordenTrabajo.groupBy({ by: ['estado'], _count: { _all: true } }),
      prisma.producto.findMany({
        where: { activo: true },
        select: { stockActual: true, stockMinimo: true, costo: true }
      }),
      prisma.ordenTrabajo.findMany({
        where: { estado: { not: 'CANCELADO' } },
        select: {
          id: true,
          ordenServicios: { select: { cantidad: true, precioUnitario: true } },
          ordenProductos: { select: { cantidad: true, precioUnitario: true } },
          pagos: { select: { monto: true } }
        }
      })
    ])

    // Ingresos (pagos recibidos)
    const totalIngresos = pagos.reduce((s, p) => s + p.monto, 0)
    const porMetodo = {}
    const porDia = {}
    for (const p of pagos) {
      porMetodo[p.metodo] = (porMetodo[p.metodo] ?? 0) + p.monto
      const k = dia(p.fecha)
      porDia[k] = (porDia[k] ?? 0) + p.monto
    }

    // Ventas y ganancia estimada (órdenes del período no canceladas)
    let ventasServicios = 0
    let ventasProductos = 0
    let costoProductos = 0
    const topServicios = new Map()
    const topProductos = new Map()
    const validas = ordenes.filter((o) => o.estado !== 'CANCELADO')

    for (const o of validas) {
      for (const s of o.ordenServicios) {
        const monto = s.cantidad * s.precioUnitario
        ventasServicios += monto
        const t = topServicios.get(s.servicio.nombre) ?? { nombre: s.servicio.nombre, cantidad: 0, monto: 0 }
        t.cantidad += s.cantidad
        t.monto += monto
        topServicios.set(s.servicio.nombre, t)
      }
      for (const p of o.ordenProductos) {
        const monto = p.cantidad * p.precioUnitario
        ventasProductos += monto
        costoProductos += p.cantidad * p.producto.costo
        const t = topProductos.get(p.producto.nombre) ?? { nombre: p.producto.nombre, cantidad: 0, monto: 0 }
        t.cantidad += p.cantidad
        t.monto += monto
        topProductos.set(p.producto.nombre, t)
      }
    }
    const ventasTotales = ventasServicios + ventasProductos
    const ganancia = ventasTotales - costoProductos

    // Por cobrar (global)
    let porCobrar = 0
    let ordenesConSaldo = 0
    for (const o of todasConSaldo) {
      const total =
        o.ordenServicios.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0) +
        o.ordenProductos.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
      const pagado = o.pagos.reduce((s, x) => s + x.monto, 0)
      if (total - pagado > 0) {
        porCobrar += total - pagado
        ordenesConSaldo++
      }
    }

    const ranking = (m) => [...m.values()].sort((a, b) => b.monto - a.monto).slice(0, 5)

    res.json({
      periodo: { desde: dia(desde), hasta: dia(hasta) },
      ingresos: {
        total: totalIngresos,
        cantidadPagos: pagos.length,
        ticketPromedio: pagos.length ? Math.round(totalIngresos / pagos.length) : 0,
        porMetodo,
        porDia: Object.entries(porDia)
          .map(([fecha, monto]) => ({ fecha, monto }))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
      },
      ventas: {
        servicios: ventasServicios,
        productos: ventasProductos,
        total: ventasTotales,
        costoProductos,
        ganancia,
        margen: ventasTotales ? Math.round((ganancia / ventasTotales) * 100) : 0,
        ordenes: validas.length
      },
      porCobrar: { total: porCobrar, ordenes: ordenesConSaldo },
      ordenesPorEstado: Object.fromEntries(ordenesActivas.map((g) => [g.estado, g._count._all])),
      topServicios: ranking(topServicios),
      topProductos: ranking(topProductos),
      inventario: {
        valorCosto: productos.reduce((s, p) => s + p.stockActual * p.costo, 0),
        stockBajo: productos.filter((p) => p.stockActual <= p.stockMinimo).length
      },
      ultimosPagos: pagos.slice(0, 10).map((p) => ({
        id: p.id,
        fecha: p.fecha,
        monto: p.monto,
        metodo: p.metodo,
        comprobante: p.comprobante?.numero ?? null,
        patente: p.orden?.vehiculo?.patente ?? null,
        cliente: p.orden?.vehiculo?.cliente?.nombre ?? null,
        registradoPor: p.usuario?.nombre ?? p.usuario?.email ?? null
      }))
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el resumen del dueño' })
  }
})

// Pagos con filtros: ?desde= ?hasta= ?metodo=
router.get('/pagos', verificarDueno, async (req, res) => {
  const rango = rangoFechas(req.query)
  if (!rango) return res.status(400).json({ error: 'Rango de fechas inválido' })
  const where = { fecha: { gte: rango.desde, lte: rango.hasta } }
  const metodo = String(req.query.metodo ?? '').toUpperCase()
  if (metodo) where.metodo = metodo
  try {
    const pagos = await prisma.pago.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 500,
      include: {
        comprobante: true,
        usuario: { select: { nombre: true, email: true } },
        orden: { select: { id: true, vehiculo: { select: { patente: true, cliente: { select: { nombre: true, rut: true } } } } } }
      }
    })
    res.json(pagos)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener los pagos' })
  }
})

export default router