<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ordenesApi, mensajeError } from '@/services/api'
import { formatearFecha, formatearPesos } from '@/utils/validaciones'
import { ESTADOS } from '@/utils/ordenes'
import EstadoBadge from '@/components/EstadoBadge.vue'

const router = useRouter()
const ordenes = ref([])
const busqueda = ref('')
const estado = ref('')
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    ordenes.value = await ordenesApi.listar({
      q: busqueda.value.trim(),
      estado: estado.value || undefined
    })
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar las órdenes')
  } finally {
    cargando.value = false
  }
}

let timer
watch([busqueda, estado], () => {
  clearTimeout(timer)
  timer = setTimeout(cargar, 300)
})

onMounted(cargar)
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Órdenes de trabajo</h1>
      <p class="subtitulo">Busca por patente, cliente, RUT o N° de orden</p>
    </div>
    <RouterLink to="/ordenes/nueva" class="btn btn-primario">+ Nueva orden</RouterLink>
  </div>

  <div class="card">
    <div class="filtros">
      <input v-model="busqueda" class="buscador" placeholder="Ej: BBCL23" />
      <select v-model="estado">
        <option value="">Todos los estados</option>
        <option v-for="e in ESTADOS" :key="e.valor" :value="e.valor">{{ e.texto }}</option>
      </select>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Ingreso</th>
            <th>Vehículo</th>
            <th>Cliente</th>
            <th>Estado</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="6" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!ordenes.length">
            <td colspan="6" class="vacio">No hay órdenes para mostrar</td>
          </tr>
          <tr
            v-for="o in ordenes"
            v-else
            :key="o.id"
            class="fila"
            @click="router.push(`/ordenes/${o.id}`)"
          >
            <td>
              <strong>#{{ o.id }}</strong>
            </td>
            <td>{{ formatearFecha(o.fechaIngreso) }}</td>
            <td>
              <span class="patente">{{ o.vehiculo.patente }}</span>
              {{ o.vehiculo.marca }} {{ o.vehiculo.modelo }}
            </td>
            <td>{{ o.vehiculo.cliente?.nombre }}</td>
            <td><EstadoBadge :estado="o.estado" /></td>
            <td>{{ formatearPesos(o.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.filtros .buscador {
  flex: 1;
  min-width: 220px;
  margin-bottom: 0;
}
.fila {
  cursor: pointer;
}
</style>