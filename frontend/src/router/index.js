import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
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

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiereAuth = to.matched.some((r) => r.meta.requiereAuth)
  if (requiereAuth && !authStore.session) return { name: 'login' }
  if (to.name === 'login' && authStore.session) return { name: 'home' }
})

export default router
