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

// ---------- Resumen ----------
export const resumenApi = {
  obtener: () => api.get('/resumen').then((r) => r.data)
}

// ---------- Clientes ----------
export const clientesApi = {
  listar: (q = '') => api.get('/clientes', { params: { q } }).then((r) => r.data),
  obtener: (id) => api.get(`/clientes/${id}`).then((r) => r.data),
  porRut: (rut) => api.get(`/clientes/rut/${encodeURIComponent(rut)}`).then((r) => r.data),
  crear: (datos) => api.post('/clientes', datos).then((r) => r.data)
}

// ---------- Vehículos ----------
export const vehiculosApi = {
  listar: (q = '') => api.get('/vehiculos', { params: { q } }).then((r) => r.data),
  porCliente: (rut) => api.get(`/vehiculos/cliente/${encodeURIComponent(rut)}`).then((r) => r.data),
  historial: (id) => api.get(`/vehiculos/${id}/historial`).then((r) => r.data),
  crear: (datos) => api.post('/vehiculos', datos).then((r) => r.data)
}

// ---------- Portal del cliente ----------
export const portalApi = {
  vincular: (datos) => api.post('/portal/vincular', datos).then((r) => r.data),
  cliente: () => api.get('/portal/cliente').then((r) => r.data),
  vehiculos: () => api.get('/portal/vehiculos').then((r) => r.data),
  vehiculo: (id) => api.get(`/portal/vehiculos/${id}`).then((r) => r.data)
}