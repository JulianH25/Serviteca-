<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi, mensajeError } from '@/services/api'
import { formatearFecha } from '@/utils/validaciones'

const cliente = ref(null)
const vehiculos = ref([])
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [datosCliente, listaVehiculos] = await Promise.all([
      portalApi.cliente(),
      portalApi.vehiculos()
    ])
    cliente.value = datosCliente
    vehiculos.value = listaVehiculos
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar tus vehículos')
  } finally {
    cargando.value = false
  }
})

function etiquetaEstado(estado) {
  return String(estado ?? '').replaceAll('_', ' ').toLowerCase()
}
</script>

<template>
  <h1>Mis vehículos</h1>
  <p class="subtitulo">
    Consulta el estado y el historial de servicios de tus vehículos
    <template v-if="cliente"> · Cliente desde {{ formatearFecha(cliente.creadoEn) }}</template>
  </p>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="error" class="alerta alerta-error">{{ error }}</p>
  <div v-else-if="!vehiculos.length" class="card vacio">No tienes vehículos registrados.</div>

  <div v-else class="grilla">
    <RouterLink
      v-for="v in vehiculos"
      :key="v.id"
      :to="`/portal/vehiculos/${v.id}`"
      class="card vehiculo"
    >
      <span class="patente">{{ v.patente }}</span>
      <strong class="nombre">{{ v.marca }} {{ v.modelo }}</strong>
      <span class="detalle">
        {{ v.anio }}<template v-if="v.kilometraje"> · {{ v.kilometraje.toLocaleString('es-CL') }} km</template>
      </span>
      <small class="detalle">Registrado el {{ formatearFecha(v.creadoEn) }}</small>

      <div v-if="v.ordenesTrabajo?.length" class="ultima">
        <span class="estado">{{ etiquetaEstado(v.ordenesTrabajo[0].estado) }}</span>
        <small>Último ingreso: {{ formatearFecha(v.ordenesTrabajo[0].fechaIngreso) }}</small>
      </div>
      <small v-else class="detalle">Sin servicios registrados</small>
    </RouterLink>
  </div>
</template>

<style scoped>
.grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.vehiculo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--text);
  margin-bottom: 0;
}

.vehiculo:hover {
  border-color: var(--primary);
}

.nombre {
  font-size: 1.05rem;
}

.detalle {
  color: var(--muted);
}

.ultima {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.ultima small {
  color: var(--muted);
}

.estado {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: #fff7ed;
  color: var(--primary-dark);
  text-transform: capitalize;
}
</style>