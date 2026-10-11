<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { clientesApi, mensajeError } from '@/services/api'
import { formatearFecha } from '@/utils/validaciones'

const props = defineProps({ id: { type: String, required: true } })

const cliente = ref(null)
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    cliente.value = await clientesApi.obtener(props.id)
  } catch (e) {
    error.value = mensajeError(e, 'No se encontró el cliente')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <RouterLink to="/clientes" class="volver">← Volver a clientes</RouterLink>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="error" class="alerta alerta-error">{{ error }}</p>

  <template v-else-if="cliente">
    <div class="encabezado">
      <div>
        <h1>{{ cliente.nombre }}</h1>
        <p class="subtitulo">Cliente desde {{ formatearFecha(cliente.creadoEn) }}</p>
      </div>
      <RouterLink
        :to="{ path: '/vehiculos/nuevo', query: { clienteId: cliente.id } }"
        class="btn btn-primario"
      >
        + Agregar vehículo
      </RouterLink>
    </div>

    <div class="card">
      <h2>Datos del cliente</h2>
      <dl class="datos">
        <div>
          <dt>RUT</dt>
          <dd>{{ cliente.rut }}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{{ cliente.telefono }}</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{{ cliente.correo || '—' }}</dd>
        </div>
      </dl>
    </div>

    <div class="card">
      <h2>Vehículos ({{ cliente.vehiculos?.length || 0 }})</h2>
      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Patente</th>
              <th>Marca / modelo</th>
              <th>Año</th>
              <th>Kilometraje</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!cliente.vehiculos?.length">
              <td colspan="5" class="vacio">Este cliente aún no tiene vehículos asociados</td>
            </tr>
            <tr v-for="v in cliente.vehiculos" :key="v.id">
              <td><span class="patente">{{ v.patente }}</span></td>
              <td>{{ v.marca }} {{ v.modelo }}</td>
              <td>{{ v.anio }}</td>
              <td>{{ v.kilometraje ? `${v.kilometraje.toLocaleString('es-CL')} km` : '—' }}</td>
              <td>
                <RouterLink :to="`/vehiculos/${v.id}/historial`">Ver historial →</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
</template>

<style scoped>
.volver {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
</style>
