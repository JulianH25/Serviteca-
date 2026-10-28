import axios from 'axios'
import { auth0 } from '@/services/auth0'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
})

function cerrarSesion(motivo) {
  if (motivo) sessionStorage.setItem('serviteca_error', motivo)
  const destino = sessionStorage.getItem('serviteca_zona') === 'portal' ? '/portal/login' : '/login'
  auth0.logout({ logoutParams: { returnTo: `${window.location.origin}${destino}` } })
}

api.interceptors.request.use(async (config) => {
  try {
    const token = await auth0.getAccessTokenSilently()
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch (e) {
    // sin sesión: el guard del router se encarga de redirigir
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (e) => {
    const status = e.response?.status
    if (status === 401) cerrarSesion()
    if (status === 403 && e.response.data?.codigo === 'NO_AUTORIZADO') {
      cerrarSesion('no_autorizado')
    }
    return Promise.reject(e)
  }
)

export function mensajeError(e, porDefecto = 'Ocurrió un error') {
  if (!e.response) return 'No se pudo conectar con el servidor. ¿Está corriendo el backend?'
  return e.response.data?.error || porDefecto
}

const datos = (r) => r.data

// ---------- Resumen ----------
export const resumenApi = {
  obtener: () => api.get('/resumen').then(datos)
}

// ---------- Clientes ----------
export const clientesApi = {
  listar: (q = '') => api.get('/clientes', { params: { q } }).then(datos),
  obtener: (id) => api.get(`/clientes/${id}`).then(datos),
  porRut: (rut) => api.get(`/clientes/rut/${encodeURIComponent(rut)}`).then(datos),
  crear: (d) => api.post('/clientes', d).then(datos)
}

// ---------- Vehículos ----------
export const vehiculosApi = {
  listar: (q = '') => api.get('/vehiculos', { params: { q } }).then(datos),
  porCliente: (rut) => api.get(`/vehiculos/cliente/${encodeURIComponent(rut)}`).then(datos),
  historial: (id) => api.get(`/vehiculos/${id}/historial`).then(datos),
  crear: (d) => api.post('/vehiculos', d).then(datos)
}

// ---------- Servicios (catálogo) ----------
export const serviciosApi = {
  listar: (soloActivos = false) =>
    api.get('/servicios', { params: soloActivos ? { activos: true } : {} }).then(datos),
  crear: (d) => api.post('/servicios', d).then(datos),
  actualizar: (id, d) => api.patch(`/servicios/${id}`, d).then(datos)
}

// ---------- Inventario ----------
export const categoriasApi = {
  listar: () => api.get('/categorias').then(datos),
  crear: (nombre) => api.post('/categorias', { nombre }).then(datos)
}

export const productosApi = {
  listar: (params = {}) => api.get('/productos', { params }).then(datos),
  obtener: (id) => api.get(`/productos/${id}`).then(datos),
  crear: (d) => api.post('/productos', d).then(datos),
  actualizar: (id, d) => api.patch(`/productos/${id}`, d).then(datos),
  movimiento: (id, d) => api.post(`/productos/${id}/movimientos`, d).then(datos)
}

// ---------- Órdenes de trabajo ----------
export const ordenesApi = {
  listar: (params = {}) => api.get('/ordenes', { params }).then(datos),
  obtener: (id) => api.get(`/ordenes/${id}`).then(datos),
  crear: (d) => api.post('/ordenes', d).then(datos),
  cambiarEstado: (id, estado) => api.patch(`/ordenes/${id}/estado`, { estado }).then(datos),
  agregarServicio: (id, d) => api.post(`/ordenes/${id}/servicios`, d).then(datos),
  agregarProducto: (id, d) => api.post(`/ordenes/${id}/productos`, d).then(datos)
}

// ---------- Portal del cliente ----------
export const portalApi = {
  vincular: (d) => api.post('/portal/vincular', d).then(datos),
  cliente: () => api.get('/portal/cliente').then(datos),
  vehiculos: () => api.get('/portal/vehiculos').then(datos),
  vehiculo: (id) => api.get(`/portal/vehiculos/${id}`).then(datos)
}