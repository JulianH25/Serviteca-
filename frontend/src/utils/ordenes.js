export const ESTADOS = [
  { valor: 'RECEPCIONADO', texto: 'Recepcionado' },
  { valor: 'EN_PROCESO', texto: 'En proceso' },
  { valor: 'TERMINADO', texto: 'Terminado' },
  { valor: 'ENTREGADO', texto: 'Entregado' },
  { valor: 'CANCELADO', texto: 'Cancelado' }
]

export const ESTADOS_CERRADOS = ['ENTREGADO', 'CANCELADO']

export const etiquetaEstado = (estado) =>
  ESTADOS.find((e) => e.valor === estado)?.texto ?? String(estado ?? '')

export const totalLineas = (lineas = []) =>
  lineas.reduce((suma, x) => suma + x.cantidad * x.precioUnitario, 0)

export const totalOrden = (orden) =>
  totalLineas(orden.ordenServicios) + totalLineas(orden.ordenProductos)

export const nombreUsuario = (u) => u?.nombre || u?.email || '—'

export const fechaHora = (f) =>
  f ? new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—'