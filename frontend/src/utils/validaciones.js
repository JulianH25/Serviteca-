// ---------- RUT chileno ----------

export function limpiarRut(rut) {
  return String(rut).replace(/[^0-9kK]/g, '').toUpperCase()
}

// 123456789 -> 12.345.678-9
export function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

// Valida solo el formato: 7 u 8 dígitos y un último carácter numérico o K.
export function rutValido(rut) {
  const limpio = limpiarRut(rut)
  return /^\d{7,8}[0-9K]$/.test(limpio)
}

// ---------- Patente chilena ----------

export function limpiarPatente(patente) {
  return String(patente).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

// Formato nuevo (BBBB12) o antiguo (AB1234)
export function patenteValida(patente) {
  const p = limpiarPatente(patente)
  return /^[A-Z]{4}\d{2}$/.test(p) || /^[A-Z]{2}\d{4}$/.test(p)
}

// ---------- Otros ----------

export function telefonoValido(tel) {
  const digitos = String(tel).replace(/\D/g, '')
  return digitos.length >= 8 && digitos.length <= 12
}

export function correoValido(correo) {
  return !correo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

export function formatearFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function formatearPesos(monto) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monto || 0)
}
