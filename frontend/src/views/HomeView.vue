<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'
import { resumenApi, mensajeError } from '@/services/api'

const { user } = useAuth0()
const resumen = ref({ ordenesActivas: '—', stockBajo: '—', clientes: '—', vehiculos: '—' })
const error = ref('')

onMounted(async () => {
  try {
    resumen.value = await resumenApi.obtener()
  } catch (e) {
    error.value = mensajeError(e)
  }
})
</script>

<template>
  <h1>Bienvenido</h1>
  <p class="subtitulo">Sesión iniciada como {{ user?.email }}</p>

  <div class="resumen">
    <RouterLink to="/ordenes" class="card dato">
      <span class="numero">{{ resumen.ordenesActivas }}</span>
      <span>Órdenes activas</span>
    </RouterLink>
    <RouterLink to="/productos?stockBajo=true" class="card dato" :class="{ alerta: resumen.stockBajo > 0 }">
      <span class="numero">{{ resumen.stockBajo }}</span>
      <span>Productos con stock bajo</span>
    </RouterLink>
    <RouterLink to="/clientes" class="card dato">
      <span class="numero">{{ resumen.clientes }}</span>
      <span>Clientes registrados</span>
    </RouterLink>
    <RouterLink to="/vehiculos" class="card dato">
      <span class="numero">{{ resumen.vehiculos }}</span>
      <span>Vehículos registrados</span>
    </RouterLink>
  </div>

  <p v-if="error" class="alerta alerta-error">{{ error }}</p>

  <div class="card">
    <h2>Acciones rápidas</h2>
    <div class="acciones" style="margin-top: 0">
      <RouterLink to="/ordenes/nueva" class="btn btn-primario">+ Nueva orden</RouterLink>
      <RouterLink to="/clientes/nuevo" class="btn btn-secundario">+ Registrar cliente</RouterLink>
      <RouterLink to="/vehiculos/nuevo" class="btn btn-secundario">+ Registrar vehículo</RouterLink>
      <RouterLink to="/productos/nuevo" class="btn btn-secundario">+ Nuevo producto</RouterLink>
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

.dato.alerta .numero {
  color: #b91c1c;
}

.numero {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
}
</style>