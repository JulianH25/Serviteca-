import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { auth0 } from '@/services/auth0'
import { api } from '@/services/api'
import AppLayout from '@/components/AppLayout.vue'
import PortalLayout from '@/components/PortalLayout.vue'
import Login from '@/views/Login.vue'
import HomeView from '@/views/HomeView.vue'
import ClientesView from '@/views/ClientesView.vue'
import RegistrarCliente from '@/views/RegistrarCliente.vue'
import ClienteDetalle from '@/views/ClienteDetalle.vue'
import VehiculosView from '@/views/VehiculosView.vue'
import RegistrarVehiculo from '@/views/RegistrarVehiculo.vue'
import VehiculoHistorial from '@/views/VehiculoHistorial.vue'
import OrdenesView from '@/views/OrdenesView.vue'
import NuevaOrden from '@/views/NuevaOrden.vue'
import OrdenDetalle from '@/views/OrdenDetalle.vue'
import ServiciosView from '@/views/ServiciosView.vue'
import ProductosView from '@/views/ProductosView.vue'
import RegistrarProducto from '@/views/RegistrarProducto.vue'
import ProductoDetalle from '@/views/ProductoDetalle.vue'
import PortalLogin from '@/views/PortalLogin.vue'
import PortalVincular from '@/views/PortalVincular.vue'
import PortalInicio from '@/views/PortalInicio.vue'
import PortalVehiculo from '@/views/PortalVehiculo.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },

    // ---------- Portal del cliente ----------
    { path: '/portal/login', name: 'portal-login', component: PortalLogin, meta: { zona: 'portal' } },
    {
      path: '/portal/vincular',
      name: 'portal-vincular',
      component: PortalVincular,
      meta: { zona: 'portal', requiereAuth: true }
    },
    {
      path: '/portal',
      component: PortalLayout,
      meta: { zona: 'portal', requiereAuth: true },
      children: [
        { path: '', name: 'portal-inicio', component: PortalInicio },
        { path: 'vehiculos/:id', name: 'portal-vehiculo', component: PortalVehiculo, props: true }
      ]
    },

    // ---------- Panel del personal ----------
    {
      path: '/',
      component: AppLayout,
      meta: { zona: 'personal', requiereAuth: true },
      children: [
        { path: '', name: 'home', component: HomeView },
        { path: 'clientes', name: 'clientes', component: ClientesView },
        { path: 'clientes/nuevo', name: 'cliente-nuevo', component: RegistrarCliente },
        { path: 'clientes/:id', name: 'cliente-detalle', component: ClienteDetalle, props: true },
        { path: 'vehiculos', name: 'vehiculos', component: VehiculosView },
        { path: 'vehiculos/nuevo', name: 'vehiculo-nuevo', component: RegistrarVehiculo },
        {
          path: 'vehiculos/:id/historial',
          name: 'vehiculo-historial',
          component: VehiculoHistorial,
          props: true
        },
        { path: 'ordenes', name: 'ordenes', component: OrdenesView },
        { path: 'ordenes/nueva', name: 'orden-nueva', component: NuevaOrden },
        { path: 'ordenes/:id', name: 'orden-detalle', component: OrdenDetalle, props: true },
        { path: 'servicios', name: 'servicios', component: ServiciosView },
        { path: 'productos', name: 'productos', component: ProductosView },
        { path: 'productos/nuevo', name: 'producto-nuevo', component: RegistrarProducto },
        { path: 'productos/:id', name: 'producto-detalle', component: ProductoDetalle, props: true }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

function esperarAuth0() {
  if (!auth0.isLoading.value) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(
      auth0.isLoading,
      (cargando) => {
        if (!cargando) {
          stop()
          resolve()
        }
      },
      { immediate: true }
    )
  })
}

// undefined = sin consultar · null = cuenta sin perfil · 'cliente' · rol de personal
let rolActual

function rechazarPersonalNoAutorizado() {
  sessionStorage.setItem('serviteca_error', 'no_autorizado')
  auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })
}

router.beforeEach(async (to) => {
  await esperarAuth0()
  const autenticado = auth0.isAuthenticated.value
  const esPortal = to.meta.zona === 'portal'

  if (!autenticado) {
    rolActual = undefined
    if (!to.meta.requiereAuth) return
    return { name: esPortal ? 'portal-login' : 'login' }
  }

  if (rolActual === undefined) {
    try {
      const { data } = await api.get('/me')
      rolActual = data.rol ?? null
    } catch (e) {
      const status = e.response?.status
      if (status === 401 || status === 403) return false
      return // backend caído: las vistas mostrarán el error
    }
  }

  // Cuenta autenticada en Auth0 pero sin perfil en el sistema
  if (rolActual === null) {
    if (sessionStorage.getItem('serviteca_zona') === 'personal') {
      rechazarPersonalNoAutorizado()
      return false
    }
    return to.name === 'portal-vincular' ? undefined : { name: 'portal-vincular' }
  }

  // Cliente: solo el portal
  if (rolActual === 'cliente') {
    if (!esPortal || to.name === 'portal-login' || to.name === 'portal-vincular') {
      return { name: 'portal-inicio' }
    }
    return
  }

  // Personal: solo el panel
  if (esPortal || to.name === 'login') return { name: 'home' }
})

export default router