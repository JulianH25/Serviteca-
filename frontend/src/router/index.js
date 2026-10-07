import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Login from '@/views/Login.vue'
import HomeView from '@/views/HomeView.vue'
import RegistrarVehiculo from '@/views/RegistrarVehiculo.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    { path: '/', name: 'home', component: HomeView, meta: { requiereAuth: true } },
    { path: '/vehiculos/nuevo', name: 'vehiculo-nuevo', component: RegistrarVehiculo, meta: { requiereAuth: true } }
  ]
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiereAuth && !authStore.session) return { name: 'login' }
  if (to.name === 'login' && authStore.session) return { name: 'home' }
})

export default router