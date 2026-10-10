<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { vehiculosApi, mensajeError } from '@/services/api'

const vehiculos = ref([])
const busqueda = ref('')
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    vehiculos.value = await vehiculosApi.listar(busqueda.value.trim())
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los vehículos')
  } finally {
    cargando.value = false
  }
}

let timer
watch(busqueda, () => {
  clearTimeout(timer)
  timer = setTimeout(cargar, 300)
})

onMounted(cargar)
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Vehículos</h1>
      <p class="subtitulo">Busca por patente, marca o modelo</p>
    </div>
    <RouterLink to="/vehiculos/nuevo" class="btn btn-primario">+ Nuevo vehículo</RouterLink>
  </div>

  <div class="card">
    <input v-model="busqueda" class="buscador" placeholder="Ej: BBCL23" />

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Patente</th>
            <th>Marca / modelo</th>
            <th>Año</th>
            <th>Dueño</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="5" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!vehiculos.length">
            <td colspan="5" class="vacio">No se encontraron vehículos</td>
          </tr>
          <tr v-for="v in vehiculos" v-else :key="v.id">
            <td><span class="patente">{{ v.patente }}</span></td>
            <td>{{ v.marca }} {{ v.modelo }}</td>
            <td>{{ v.anio }}</td>
            <td>
              <RouterLink v-if="v.cliente" :to="`/clientes/${v.cliente.id}`">
                {{ v.cliente.nombre }}
              </RouterLink>
            </td>
            <td>
              <RouterLink :to="`/vehiculos/${v.id}/historial`">Historial →</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
