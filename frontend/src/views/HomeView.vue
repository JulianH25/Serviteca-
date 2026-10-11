<script setup>
import { useAuth0 } from '@auth0/auth0-vue'

const { user, logout } = useAuth0()

function salir() {
  logout({ logoutParams: { returnTo: window.location.origin + '/login' } })
}
</script>

<template>
  <div>
    <h2>Serviteca</h2>
    <p>Sesión: {{ user?.email }}</p>
    <router-link to="/vehiculos/nuevo">Registrar vehículo</router-link>
    <button @click="salir">Cerrar sesión</button>
  </div>
</template>