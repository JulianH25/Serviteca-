import { Router } from 'express'
import { verificarDueno } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
const IVA = 0.19
const DIA_MS = 24 * 60 * 60 * 1000

// ---------- Utilidades ----------
const pad = (n) => String(n).padStart(2, '0')
const claveDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const claveMes = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const suma = (l) => l.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
const variacion = (actual, anterior) =>
  anterior ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null

// Rango pedido + período anterior de la misma duración, justo antes
function conRango(req, res, next) {
  const q = req.query
  const ahora = new Date()
  const desde = q.desde ? new Date(`${q.desde}T00:00:00`) : new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const hasta = q.hasta ? new Date(`${q.hasta}T23:59:59.999`) : ahora
  if (isNaN(desde) || isNaN(hasta) || desde > hasta) {
    return res.status(400).json({ error: 'Rango de fechas inválido' })
  }
  const duracion = hasta.getTime() - desde.getTime() + 1
  req.rango = {
    desde,
    hasta,
    anteriorDesde: new Date(desde.getTime() - duracion),
    anteriorHasta: new Date(desde.getTime() - 1)
  }
  next()
}

// Órdenes no canceladas ingresadas en el rango, con todo lo necesario para analizarlas
function cargarOrdenes(desde, hasta) {
  return prisma.ordenTrabajo.findMany({
    where: { estado: { not: 'CANCELADO' }, fechaIngreso: { gte: desde, lte: hasta } },
    select: {
      id: true,
      fechaIngreso: true,
      vehiculo: {
        select: {
          id: true,
          cliente: { select: { id: true, nombre: true, rut: true, creadoEn: true } }
        }
      },
      ordenServicios: {
        select: { cantidad: true, precioUnitario: true, servicio: { select: { id: true, nombre: true } } }
      },
      ordenProductos: {
        select: {
          cantidad: true,
          precioUnitario: true,
          producto: {
            select: { id: true, nombre: true, costo: true, categoria: { select: { nombre: true } } }
          }
        }
      },
      pagos: { select: { monto: true } }
    }
  })
}

const totalOrden = (o) => suma(o.ordenServicios) + suma(o.ordenProductos)
const costoOrden = (o) => o.ordenProductos.reduce((s, p) => s + p.cantidad * p.producto.costo, 0)
const pagadoOrden = (o) => o.pagos.reduce((s, p) => s + p.monto, 0)

function calcularKpis(ordenes) {
  let ventas = 0, ventasServicios = 0, ventasProductos = 0, costo = 0, porCobrar = 0
  for (const o of ordenes) {
    const vs = suma(o.ordenServicios)
    const vp = suma(o.ordenProductos)
    ventasServicios += vs
    ventasProductos += vp
    ventas += vs + vp
    costo += costoOrden(o)
    porCobrar += Math.max(0, vs + vp - pagadoOrden(o))
  }
  const neto = Math.round(ventas / (1 + IVA))
  const ganancia = ventas - costo
  return {
    ordenes: ordenes.length,
    ventas,
    ventasServicios,
    ventasProductos,
    ventasNetas: neto,
    iva: ventas - neto,
    costoProductos: costo,
    ganancia,
    gananciaNeta: neto - costo,
    margen: ventas ? Math.round((ganancia / ventas) * 100) : 0,
    ticketPromedio: ordenes.length ? Math.round(ventas / ordenes.length) : 0,
    porCobrar
  }
}

function responder500(res, e, mensaje) {
  console.error(e)
  res.status(500).json({ error: mensaje })
}

// ---------- Resumen general ----------
router.get('/resumen', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta, anteriorDesde, anteriorHasta } = req.rango
  try {
    const [actuales, anteriores, pagos, pagosAnt] = await Promise.all([
      cargarOrdenes(desde, hasta),
      cargarOrdenes(anteriorDesde, anteriorHasta),
      prisma.pago.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        select: { fecha: true, monto: true, metodo: true }
      }),
      prisma.pago.aggregate({
        where: { fecha: { gte: anteriorDesde, lte: anteriorHasta } },
        _sum: { monto: true }
      })
    ])

    const kpis = calcularKpis(actuales)
    const kpisAnt = calcularKpis(anteriores)
    const cobrado = pagos.reduce((s, p) => s + p.monto, 0)
    const cobradoAnt = pagosAnt._sum.monto ?? 0

    // Serie: por día, o por mes si el rango es largo
    const porMes = (hasta - desde) / DIA_MS > 92
    const clave = porMes ? claveMes : claveDia
    const mapa = new Map()
    const punto = (k) => {
      if (!mapa.has(k)) mapa.set(k, { periodo: k, ventas: 0, ganancia: 0, cobrado: 0 })
      return mapa.get(k)
    }
    for (const o of actuales) {
      const t = totalOrden(o)
      const p = punto(clave(o.fechaIngreso))
      p.ventas += t
      p.ganancia += t - costoOrden(o)
    }
    const porMetodo = {}
    for (const pg of pagos) {
      punto(clave(pg.fecha)).cobrado += pg.monto
      porMetodo[pg.metodo] = (porMetodo[pg.metodo] ?? 0) + pg.monto
    }

    res.json({
      periodo: { desde: claveDia(desde), hasta: claveDia(hasta), agrupacion: porMes ? 'mes' : 'dia' },
      kpis: { ...kpis, cobrado, cantidadPagos: pagos.length },
      variacion: {
        ventas: variacion(kpis.ventas, kpisAnt.ventas),
        ganancia: variacion(kpis.ganancia, kpisAnt.ganancia),
        ordenes: variacion(kpis.ordenes, kpisAnt.ordenes),
        ticketPromedio: variacion(kpis.ticketPromedio, kpisAnt.ticketPromedio),
        cobrado: variacion(cobrado, cobradoAnt)
      },
      serie: [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
      porMetodo
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el resumen')
  }
})

// ---------- Servicios ----------
function agruparServicios(ordenes) {
  const m = new Map()
  for (const o of ordenes) {
    for (const s of o.ordenServicios) {
      const r = m.get(s.servicio.id) ?? {
        id: s.servicio.id,
        nombre: s.servicio.nombre,
        cantidad: 0,
        monto: 0,
        ordenes: new Set()
      }
      r.cantidad += s.cantidad
      r.monto += s.cantidad * s.precioUnitario
      r.ordenes.add(o.id)
      m.set(r.id, r)
    }
  }
  return m
}

router.get('/servicios', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta, anteriorDesde, anteriorHasta } = req.rango
  try {
    const [actuales, anteriores] = await Promise.all([
      cargarOrdenes(desde, hasta),
      cargarOrdenes(anteriorDesde, anteriorHasta)
    ])
    const act = agruparServicios(actuales)
    const ant = agruparServicios(anteriores)
    const total = [...act.values()].reduce((s, r) => s + r.monto, 0)

    const ranking = [...act.values()]
      .map((r) => ({
        id: r.id,
        nombre: r.nombre,
        cantidad: r.cantidad,
        ordenes: r.ordenes.size,
        monto: r.monto,
        precioPromedio: r.cantidad ? Math.round(r.monto / r.cantidad) : 0,
        participacion: total ? Math.round((r.monto / total) * 1000) / 10 : 0,
        variacion: variacion(r.monto, ant.get(r.id)?.monto ?? 0)
      }))
      .sort((a, b) => b.monto - a.monto)

    res.json({
      total,
      unidades: ranking.reduce((s, r) => s + r.cantidad, 0),
      ranking
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte de servicios')
  }
})

// ---------- Productos ----------
function agruparProductos(ordenes) {
  const m = new Map()
  for (const o of ordenes) {
    for (const p of o.ordenProductos) {
      const r = m.get(p.producto.id) ?? {
        id: p.producto.id,
        nombre: p.producto.nombre,
        categoria: p.producto.categoria?.nombre ?? 'Sin categoría',
        cantidad: 0,
        monto: 0,
        costo: 0
      }
      r.cantidad += p.cantidad
      r.monto += p.cantidad * p.precioUnitario
      r.costo += p.cantidad * p.producto.costo
      m.set(r.id, r)
    }
  }
  return m
}

router.get('/productos', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta, anteriorDesde, anteriorHasta } = req.rango
  try {
    const [actuales, anteriores, activos] = await Promise.all([
      cargarOrdenes(desde, hasta),
      cargarOrdenes(anteriorDesde, anteriorHasta),
      prisma.producto.findMany({
        where: { activo: true },
        select: {
          id: true,
          nombre: true,
          stockActual: true,
          stockMinimo: true,
          costo: true,
          categoria: { select: { nombre: true } }
        },
        orderBy: { nombre: 'asc' }
      })
    ])
    const act = agruparProductos(actuales)
    const ant = agruparProductos(anteriores)

    const ranking = [...act.values()]
      .map((r) => ({
        ...r,
        ganancia: r.monto - r.costo,
        margen: r.monto ? Math.round(((r.monto - r.costo) / r.monto) * 100) : 0,
        variacion: variacion(r.monto, ant.get(r.id)?.monto ?? 0)
      }))
      .sort((a, b) => b.monto - a.monto)

    const porCategoria = {}
    for (const r of ranking) {
      const c = (porCategoria[r.categoria] ??= { categoria: r.categoria, cantidad: 0, monto: 0, ganancia: 0 })
      c.cantidad += r.cantidad
      c.monto += r.monto
      c.ganancia += r.ganancia
    }

    // Stock con plata parada: hay unidades pero no se vendió nada en el período
    const sinMovimiento = activos
      .filter((p) => p.stockActual > 0 && !act.has(p.id))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria?.nombre ?? 'Sin categoría',
        stockActual: p.stockActual,
        valorCosto: p.stockActual * p.costo
      }))
      .sort((a, b) => b.valorCosto - a.valorCosto)

    const stockBajo = activos
      .filter((p) => p.stockActual <= p.stockMinimo)
      .map((p) => ({ id: p.id, nombre: p.nombre, stockActual: p.stockActual, stockMinimo: p.stockMinimo }))

    res.json({
      totales: {
        monto: ranking.reduce((s, r) => s + r.monto, 0),
        ganancia: ranking.reduce((s, r) => s + r.ganancia, 0),
        unidades: ranking.reduce((s, r) => s + r.cantidad, 0)
      },
      ranking,
      porCategoria: Object.values(porCategoria).sort((a, b) => b.monto - a.monto),
      sinMovimiento,
      capitalInmovilizado: sinMovimiento.reduce((s, p) => s + p.valorCosto, 0),
      stockBajo
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte de productos')
  }
})

// ---------- Clientes ----------
router.get('/clientes', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta } = req.rango
  try {
    const [ordenes, nuevos] = await Promise.all([
      cargarOrdenes(desde, hasta),
      prisma.cliente.count({ where: { creadoEn: { gte: desde, lte: hasta } } })
    ])

    const m = new Map()
    for (const o of ordenes) {
      const c = o.vehiculo?.cliente
      if (!c) continue
      const r = m.get(c.id) ?? {
        id: c.id,
        nombre: c.nombre,
        rut: c.rut,
        ordenes: 0,
        vehiculos: new Set(),
        total: 0,
        pagado: 0,
        saldo: 0,
        ultimaVisita: null
      }
      const t = totalOrden(o)
      const p = pagadoOrden(o)
      r.ordenes++
      r.vehiculos.add(o.vehiculo.id)
      r.total += t
      r.pagado += p
      r.saldo += Math.max(0, t - p)
      if (!r.ultimaVisita || o.fechaIngreso > r.ultimaVisita) r.ultimaVisita = o.fechaIngreso
      m.set(c.id, r)
    }

    const ranking = [...m.values()]
      .map((r) => ({ ...r, vehiculos: r.vehiculos.size }))
      .sort((a, b) => b.total - a.total)

    const total = ranking.reduce((s, r) => s + r.total, 0)
    const recurrentes = ranking.filter((r) => r.ordenes >= 2).length

    res.json({
      resumen: {
        activos: ranking.length,
        nuevos,
        recurrentes,
        tasaRecurrencia: ranking.length ? Math.round((recurrentes / ranking.length) * 100) : 0,
        gastoPromedio: ranking.length ? Math.round(total / ranking.length) : 0,
        saldoPendiente: ranking.reduce((s, r) => s + r.saldo, 0)
      },
      ranking: ranking.slice(0, 100)
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte de clientes')
  }
})

export default router