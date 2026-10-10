import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

// Cliente HTTP único para hablar con el backend (Express).
// La URL se puede cambiar con VITE_API_URL en frontend/.env
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
})

// Agrega el token de Supabase a cada petición
api.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  const token = authStore.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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
