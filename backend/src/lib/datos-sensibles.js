export function ocultarRut(datos, perfil) {
  if (perfil?.rol === 'dueno' || datos == null) return datos
  if (Array.isArray(datos)) return datos.map((item) => ocultarRut(item, perfil))
  if (typeof datos !== 'object') return datos
  return Object.fromEntries(
    Object.entries(datos)
      .filter(([clave]) => clave !== 'rut')
      .map(([clave, valor]) => [clave, ocultarRut(valor, perfil)])
  )
}
