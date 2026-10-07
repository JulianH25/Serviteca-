<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()

async function salir() {
  await authStore.cerrarSesion()
  router.push('/login')
}
</script>

<template>
  <div>
    <h2>Serviteca</h2>
    <p>Sesión: {{ authStore.user?.email }}</p>
    <router-link to="/vehiculos/nuevo">Registrar vehículo</router-link>
    <button @click="salir">Cerrar sesión</button>
  </div>
</template>