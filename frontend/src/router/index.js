import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { auth0 } from '@/services/auth0'
import AppLayout from '@/components/AppLayout.vue'
import Login from '@/views/Login.vue'
import HomeView from '@/views/HomeView.vue'
import ClientesView from '@/views/ClientesView.vue'
import RegistrarCliente from '@/views/RegistrarCliente.vue'
import ClienteDetalle from '@/views/ClienteDetalle.vue'
import VehiculosView from '@/views/VehiculosView.vue'
import RegistrarVehiculo from '@/views/RegistrarVehiculo.vue'
import VehiculoHistorial from '@/views/VehiculoHistorial.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    {
      path: '/',
      component: AppLayout,
      meta: { requiereAuth: true },
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
        }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

// Espera a que Auth0 termine de cargar (incluye el callback de login)
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

router.beforeEach(async (to) => {
  await esperarAuth0()
  const autenticado = auth0.isAuthenticated.value
  const requiereAuth = to.matched.some((r) => r.meta.requiereAuth)
  if (requiereAuth && !autenticado) return { name: 'login' }
  if (to.name === 'login' && autenticado) return { name: 'home' }
})

export default router