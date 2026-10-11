<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'
import { clientesApi, vehiculosApi, mensajeError } from '@/services/api'

const { user } = useAuth0()
const totalClientes = ref('—')
const totalVehiculos = ref('—')
const error = ref('')

onMounted(async () => {
  try {
    const [clientes, vehiculos] = await Promise.all([clientesApi.listar(), vehiculosApi.listar()])
    totalClientes.value = clientes.length
    totalVehiculos.value = vehiculos.length
  } catch (e) {
    error.value = mensajeError(e)
  }
})
</script>

<template>
  <h1>Bienvenido</h1>
  <p class="subtitulo">Sesión iniciada como {{ user?.email }}</p>

  <div class="resumen">
    <RouterLink to="/clientes" class="card dato">
      <span class="numero">{{ totalClientes }}</span>
      <span>Clientes registrados</span>
    </RouterLink>
    <RouterLink to="/vehiculos" class="card dato">
      <span class="numero">{{ totalVehiculos }}</span>
      <span>Vehículos registrados</span>
    </RouterLink>
  </div>

  <p v-if="error" class="alerta alerta-error">{{ error }}</p>

  <div class="card">
    <h2>Acciones rápidas</h2>
    <div class="acciones" style="margin-top: 0">
      <RouterLink to="/clientes/nuevo" class="btn btn-primario">+ Registrar cliente</RouterLink>
      <RouterLink to="/vehiculos/nuevo" class="btn btn-secundario">+ Registrar vehículo</RouterLink>
      <RouterLink to="/vehiculos" class="btn btn-secundario">Buscar por patente</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.dato {
  display: flex;
  flex-direction: column;
  color: var(--muted);
  margin-bottom: 1rem;
}

.dato:hover {
  border-color: var(--primary);
}

.numero {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
}
</style>

