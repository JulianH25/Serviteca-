import axios from 'axios'
import { auth0 } from '@/services/auth0'

// Cliente HTTP único para hablar con el backend (Express).
// La URL se puede cambiar con VITE_API_URL en frontend/.env
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
})

// Agrega el token de Auth0 a cada petición
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
    if (e.response?.status === 401) {
      auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })
    }
    return Promise.reject(e)
  }
)

// Devuelve el mensaje de error que manda el backend, o uno genérico
export function mensajeError(e, porDefecto = 'Ocurrió un error') {
  if (!e.response) return 'No se pudo conectar con el servidor. ¿Está corriendo el backend?'
  return e.response.data?.error || porDefecto
}

// ---------- Clientes ----------
export const clientesApi = {
  listar: (q = '') => api.get('/clientes', { params: { q } }).then((r) => r.data),
  obtener: (id) => api.get(`/clientes/${id}`).then((r) => r.data),
  crear: (datos) => api.post('/clientes', datos).then((r) => r.data)
}

// ---------- Vehículos ----------
export const vehiculosApi = {
  listar: (q = '') => api.get('/vehiculos', { params: { q } }).then((r) => r.data),
  porCliente: (clienteId) => api.get(`/vehiculos/cliente/${clienteId}`).then((r) => r.data),
  historial: (id) => api.get(`/vehiculos/${id}/historial`).then((r) => r.data),
  crear: (datos) => api.post('/vehiculos', datos).then((r) => r.data)
}