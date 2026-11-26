export function limpiarRut(rut) {
  return String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
}

export function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

export function rutValido(rut) {
  const limpio = limpiarRut(rut)
  return /^\d{7,8}[0-9K]$/.test(limpio)
}

export const limpiarPatente = (p) => String(p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
export const patenteValida = (p) => {
  const limpia = limpiarPatente(p)
  return /^[A-Z]{4}\d{2}$/.test(limpia) || /^[A-Z]{2}\d{4}$/.test(limpia)
}
