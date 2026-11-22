// =====================================================================
// SPRINT 3: presupuestos, pagos y comprobantes
// =====================================================================

export const TASA_IVA = 0.19

// Los precios del catálogo ya incluyen IVA (como en cualquier boleta en Chile).
// Para el presupuesto se separa el total en neto + IVA.
//   total 11.900 -> neto 10.000 + IVA 1.900
export function desglosarIva(total) {
  const t = Math.round(Number(total) || 0)
  const neto = Math.round(t / (1 + TASA_IVA))
  return { neto, iva: t - neto, total: t }
}

export const totalLineas = (lineas = []) =>
  lineas.reduce((suma, l) => suma + (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0), 0)

// ---------- Fechas ----------

// La columna `fecha` del presupuesto es tipo DATE: llega como "2026-11-11T00:00:00.000Z".
// Si se pasa directo a new Date(), en Chile (UTC-3) se muestra el día anterior.
// Por eso se toma solo la parte "YYYY-MM-DD" y se arma la fecha en hora local.
export function fechaLocal(valor) {
  if (!valor) return null
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate())
  const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function fechaVencimiento(presupuesto) {
  const f = fechaLocal(presupuesto.fecha)
  if (!f) return null
  f.setDate(f.getDate() + (Number(presupuesto.validezDias) || 0))
  return f
}

// "2026-11-11" en hora local (para los filtros de fecha)
export function hoyIso(base = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}`
}

// ---------- Estados del presupuesto ----------

export const ESTADOS_PRESUPUESTO = [
  { valor: 'PENDIENTE', texto: 'Pendiente' },
  { valor: 'APROBADO', texto: 'Aprobado' },
  { valor: 'RECHAZADO', texto: 'Rechazado' },
  { valor: 'VENCIDO', texto: 'Vencido' }
]

// Un presupuesto pendiente cuya validez ya pasó se muestra como VENCIDO
// (no se guarda en la base de datos: se calcula al mostrarlo).
export function estadoPresupuesto(presupuesto, hoy = new Date()) {
  if (presupuesto.estado !== 'PENDIENTE') return presupuesto.estado
  const vence = fechaVencimiento(presupuesto)
  const hoyLocal = fechaLocal(hoy)
  return vence && hoyLocal > vence ? 'VENCIDO' : 'PENDIENTE'
}

export const etiquetaPresupuesto = (estado) =>
  ESTADOS_PRESUPUESTO.find((e) => e.valor === estado)?.texto ?? String(estado ?? '')

// ---------- Pagos ----------

export const METODOS_PAGO = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'DEBITO', texto: 'Tarjeta de débito' },
  { valor: 'CREDITO', texto: 'Tarjeta de crédito' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' }
]

export const etiquetaMetodo = (metodo) =>
  METODOS_PAGO.find((m) => m.valor === metodo)?.texto ?? String(metodo ?? '')

export function resumenPagos(total, pagos = []) {
  const pagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const saldo = Math.max(0, (Number(total) || 0) - pagado)
  return { total: Number(total) || 0, pagado, saldo, pagadoCompleto: saldo === 0 && pagado > 0 }
}

// Devuelve el mensaje de error, o '' si el monto es válido
export function validarMonto(monto, saldo) {
  const n = Number(monto)
  if (monto === '' || monto === null || !Number.isInteger(n) || n <= 0) {
    return 'Ingresa un monto mayor a 0, sin decimales'
  }
  if (n > saldo) return 'El monto no puede ser mayor que el saldo pendiente'
  return ''
}
