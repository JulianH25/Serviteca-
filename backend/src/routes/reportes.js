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
          patente: true,
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
      // El ranking responde a "más realizados": primero cantidad y luego monto.
      .sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto)

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
      // El ranking responde a "clientes frecuentes": primero número de órdenes
      // y luego gasto total como criterio de desempate.
      .sort((a, b) => b.ordenes - a.ordenes || b.total - a.total)

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
// ---------- Ganancias ----------
router.get('/ganancias', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta, anteriorDesde, anteriorHasta } = req.rango
  try {
    const [actuales, anteriores] = await Promise.all([
      cargarOrdenes(desde, hasta),
      cargarOrdenes(anteriorDesde, anteriorHasta)
    ])
    const kpis = calcularKpis(actuales)
    const kpisAnt = calcularKpis(anteriores)

    const porMes = (hasta - desde) / DIA_MS > 92
    const clave = porMes ? claveMes : claveDia
    const mapa = new Map()
    for (const o of actuales) {
      const k = clave(o.fechaIngreso)
      const p = mapa.get(k) ?? { periodo: k, ventas: 0, costo: 0, ganancia: 0 }
      const t = totalOrden(o)
      const c = costoOrden(o)
      p.ventas += t
      p.costo += c
      p.ganancia += t - c
      mapa.set(k, p)
    }
    const serie = [...mapa.values()]
      .map((p) => ({ ...p, margen: p.ventas ? Math.round((p.ganancia / p.ventas) * 100) : 0 }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))

    const gananciaProductos = kpis.ventasProductos - kpis.costoProductos
    const fuentes = {
      // Los servicios no tienen costo registrado: se consideran 100% ganancia
      servicios: { ventas: kpis.ventasServicios, costo: 0, ganancia: kpis.ventasServicios, margen: kpis.ventasServicios ? 100 : 0 },
      productos: {
        ventas: kpis.ventasProductos,
        costo: kpis.costoProductos,
        ganancia: gananciaProductos,
        margen: kpis.ventasProductos ? Math.round((gananciaProductos / kpis.ventasProductos) * 100) : 0
      }
    }

    const detalle = actuales
      .map((o) => {
        const total = totalOrden(o)
        const costo = costoOrden(o)
        return {
          id: o.id,
          fecha: o.fechaIngreso,
          patente: o.vehiculo?.patente ?? null,
          cliente: o.vehiculo?.cliente?.nombre ?? null,
          total,
          costo,
          ganancia: total - costo,
          margen: total ? Math.round(((total - costo) / total) * 100) : 0
        }
      })
      .filter((o) => o.total > 0)

    const pagos = await prisma.pago.aggregate({
      where: { fecha: { gte: desde, lte: hasta } },
      _sum: { monto: true }
    })

    res.json({
      periodo: { desde: claveDia(desde), hasta: claveDia(hasta), agrupacion: porMes ? 'mes' : 'dia' },
      kpis: { ...kpis, cobrado: pagos._sum.monto ?? 0 },
      variacion: {
        ventas: variacion(kpis.ventas, kpisAnt.ventas),
        ganancia: variacion(kpis.ganancia, kpisAnt.ganancia),
        gananciaNeta: variacion(kpis.gananciaNeta, kpisAnt.gananciaNeta),
        margen: variacion(kpis.margen, kpisAnt.margen)
      },
      serie,
      fuentes,
      topOrdenes: [...detalle].sort((a, b) => b.ganancia - a.ganancia).slice(0, 10),
      margenBajo: detalle.filter((o) => o.costo > 0).sort((a, b) => a.margen - b.margen).slice(0, 10),
      detalle: detalle.sort((a, b) => a.id - b.id)
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte de ganancias')
  }
})

// ---------- Rotación de productos ----------
// Rotación = unidades vendidas / stock promedio del período.
// Stock inicial se reconstruye con los movimientos: inicial = actual - entradas + salidas.
// Cobertura (días) = stock actual / ventas diarias.
router.get('/rotacion', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta } = req.rango
  try {
    const dias = Math.max(1, Math.round((hasta - desde) / DIA_MS))
    const [ordenes, productos, movs] = await Promise.all([
      cargarOrdenes(desde, hasta),
      prisma.producto.findMany({
        where: { activo: true },
        select: {
          id: true, nombre: true, codigo: true, stockActual: true, stockMinimo: true,
          costo: true, precioVenta: true, categoria: { select: { nombre: true } }
        },
        orderBy: { nombre: 'asc' }
      }),
      prisma.movimientoInventario.groupBy({
        by: ['productoId', 'tipo'],
        where: { fecha: { gte: desde, lte: hasta } },
        _sum: { cantidad: true }
      })
    ])

    const ventas = agruparProductos(ordenes)
    const mov = new Map()
    for (const m of movs) {
      const r = mov.get(m.productoId) ?? { entradas: 0, salidas: 0 }
      if (m.tipo === 'ENTRADA') r.entradas += m._sum.cantidad ?? 0
      else r.salidas += m._sum.cantidad ?? 0
      mov.set(m.productoId, r)
    }

    const filas = productos.map((p) => {
      const vendidas = ventas.get(p.id)?.cantidad ?? 0
      const m = mov.get(p.id) ?? { entradas: 0, salidas: 0 }
      const stockInicial = Math.max(0, p.stockActual - m.entradas + m.salidas)
      const stockPromedio = (stockInicial + p.stockActual) / 2
      const rotacion = stockPromedio > 0 ? Math.round((vendidas / stockPromedio) * 100) / 100 : 0
      const ventasDia = vendidas / dias
      const cobertura = ventasDia > 0 ? Math.round(p.stockActual / ventasDia) : null

      let clase
      if (vendidas === 0) clase = p.stockActual > 0 ? 'SIN_MOVIMIENTO' : 'AGOTADO'
      else if (p.stockActual === 0) clase = 'AGOTADO'
      else if (cobertura <= 30) clase = 'ALTA'
      else if (cobertura <= 90) clase = 'MEDIA'
      else clase = 'BAJA'

      // Sugerencia: stock para cubrir 30 días de ventas, o llegar al mínimo
      const objetivo = Math.max(Math.ceil(ventasDia * 30), p.stockMinimo)
      const reponer = vendidas > 0 || p.stockActual <= p.stockMinimo ? Math.max(0, objetivo - p.stockActual) : 0

      return {
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        categoria: p.categoria?.nombre ?? 'Sin categoría',
        stockActual: p.stockActual,
        stockMinimo: p.stockMinimo,
        vendidas,
        stockPromedio: Math.round(stockPromedio * 10) / 10,
        rotacion,
        cobertura,
        clase,
        reponer,
        valorStock: p.stockActual * p.costo,
        ganancia: ventas.get(p.id) ? ventas.get(p.id).monto - ventas.get(p.id).costo : 0
      }
    })

    const valorInventario = filas.reduce((s, f) => s + f.valorStock, 0)
    const costoVendido = [...ventas.values()].reduce((s, r) => s + r.costo, 0)
    const conMovimiento = filas.filter((f) => f.vendidas > 0)
    const conteo = (c) => filas.filter((f) => f.clase === c).length

    res.json({
      dias,
      resumen: {
        productos: filas.length,
        valorInventario,
        costoVendido,
        // Rotación global del inventario valorizado a costo (valor actual como aproximación)
        rotacionGlobal: valorInventario ? Math.round((costoVendido / valorInventario) * 100) / 100 : 0,
        rotacionPromedio: conMovimiento.length
          ? Math.round((conMovimiento.reduce((s, f) => s + f.rotacion, 0) / conMovimiento.length) * 100) / 100
          : 0,
        capitalInmovilizado: filas.filter((f) => f.clase === 'SIN_MOVIMIENTO').reduce((s, f) => s + f.valorStock, 0),
        porReponer: filas.filter((f) => f.reponer > 0).length,
        conteo: {
          ALTA: conteo('ALTA'), MEDIA: conteo('MEDIA'), BAJA: conteo('BAJA'),
          SIN_MOVIMIENTO: conteo('SIN_MOVIMIENTO'), AGOTADO: conteo('AGOTADO')
        }
      },
      productos: filas.sort((a, b) => b.rotacion - a.rotacion || b.vendidas - a.vendidas)
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte de rotación')
  }
})

// ---------- Reporte general ----------
router.get('/general', verificarDueno, conRango, async (req, res) => {
  const { desde, hasta } = req.rango
  try {
    const [ordenes, presupuestos, pagos, productos, nuevos] = await Promise.all([
      prisma.ordenTrabajo.findMany({
        where: { fechaIngreso: { gte: desde, lte: hasta } },
        select: {
          id: true, estado: true, fechaIngreso: true, fechaEntrega: true,
          usuario: { select: { id: true, nombre: true, email: true } },
          ordenServicios: { select: { cantidad: true, precioUnitario: true } },
          ordenProductos: { select: { cantidad: true, precioUnitario: true } }
        }
      }),
      prisma.presupuesto.findMany({
        where: { fecha: { gte: desde, lte: hasta } },
        select: { estado: true, total: true, ordenId: true }
      }),
      prisma.pago.groupBy({
        by: ['metodo'],
        where: { fecha: { gte: desde, lte: hasta } },
        _sum: { monto: true },
        _count: { _all: true }
      }),
      prisma.producto.findMany({
        where: { activo: true },
        select: { stockActual: true, stockMinimo: true, costo: true, precioVenta: true }
      }),
      prisma.cliente.count({ where: { creadoEn: { gte: desde, lte: hasta } } })
    ])

    // Órdenes
    const porEstado = {}
    const personal = new Map()
    let horasTotal = 0
    let entregadas = 0
    for (const o of ordenes) {
      porEstado[o.estado] = (porEstado[o.estado] ?? 0) + 1
      if (o.estado === 'ENTREGADO' && o.fechaEntrega) {
        horasTotal += (o.fechaEntrega - o.fechaIngreso) / 3600000
        entregadas++
      }
      const u = o.usuario
      if (!u) continue
      const r = personal.get(u.id) ?? { id: u.id, nombre: u.nombre ?? u.email ?? '—', ordenes: 0, entregadas: 0, ventas: 0 }
      r.ordenes++
      if (o.estado === 'ENTREGADO') r.entregadas++
      if (o.estado !== 'CANCELADO') r.ventas += totalOrden(o)
      personal.set(u.id, r)
    }
    const canceladas = porEstado.CANCELADO ?? 0

    // Presupuestos
    const pEstado = {}
    for (const p of presupuestos) pEstado[p.estado] = (pEstado[p.estado] ?? 0) + 1
    const aprobados = (pEstado.APROBADO ?? 0) + (pEstado.CONVERTIDO ?? 0)
    const montoCotizado = presupuestos.reduce((s, p) => s + p.total, 0)

    // Pagos
    const porMetodo = pagos.map((p) => ({ metodo: p.metodo, monto: p._sum.monto ?? 0, cantidad: p._count._all }))
    const cobrado = porMetodo.reduce((s, p) => s + p.monto, 0)

    res.json({
      periodo: { desde: claveDia(desde), hasta: claveDia(hasta) },
      ordenes: {
        total: ordenes.length,
        porEstado,
        tasaCancelacion: ordenes.length ? Math.round((canceladas / ordenes.length) * 100) : 0,
        tiempoPromedioHoras: entregadas ? Math.round((horasTotal / entregadas) * 10) / 10 : null,
        entregadas
      },
      personal: [...personal.values()].sort((a, b) => b.ventas - a.ventas),
      presupuestos: {
        total: presupuestos.length,
        porEstado: pEstado,
        montoCotizado,
        tasaAprobacion: presupuestos.length ? Math.round((aprobados / presupuestos.length) * 100) : 0,
        tasaConversion: presupuestos.length
          ? Math.round((presupuestos.filter((p) => p.ordenId).length / presupuestos.length) * 100)
          : 0
      },
      pagos: { cobrado, cantidad: pagos.reduce((s, p) => s + p._count._all, 0), porMetodo },
      inventario: {
        productos: productos.length,
        valorCosto: productos.reduce((s, p) => s + p.stockActual * p.costo, 0),
        valorVenta: productos.reduce((s, p) => s + p.stockActual * p.precioVenta, 0),
        stockBajo: productos.filter((p) => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length,
        agotados: productos.filter((p) => p.stockActual === 0).length
      },
      clientesNuevos: nuevos
    })
  } catch (e) {
    responder500(res, e, 'No se pudo generar el reporte general')
  }
})
export default router
