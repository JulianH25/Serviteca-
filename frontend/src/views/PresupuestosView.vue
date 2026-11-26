<script setup>
import { ref, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { presupuestosApi, mensajeError } from '@/services/api'
import { formatearPesos, formatearFecha } from '@/utils/validaciones'
import {
  ESTADOS_PRESUPUESTO,
  estadoPresupuesto,
  fechaLocal,
  fechaVencimiento
} from '@/utils/presupuestos'
import PresupuestoBadge from '@/components/PresupuestoBadge.vue'

const presupuestos = ref([])
const busqueda = ref('')
const estado = ref('')
const cargando = ref(true)
const error = ref('')

async function eliminarPresupuesto(presupuesto) {
  if (!window.confirm(`¿Eliminar el presupuesto #${presupuesto.id}? Esta acción no se puede deshacer.`)) return
  try {
    await presupuestosApi.eliminar(presupuesto.id)
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo eliminar el presupuesto')
  }
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const params = {}
    if (busqueda.value.trim()) params.q = busqueda.value.trim()
    // VENCIDO no existe en la base de datos: se piden los PENDIENTE y se filtran aquí
    if (estado.value) params.estado = estado.value === 'VENCIDO' ? 'PENDIENTE' : estado.value
    const lista = await presupuestosApi.listar(params)
    presupuestos.value = estado.value
      ? lista.filter((p) => estadoPresupuesto(p) === estado.value)
      : lista
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los presupuestos')
  } finally {
    cargando.value = false
  }
}

let timer
watch(busqueda, () => {
  clearTimeout(timer)
  timer = setTimeout(cargar, 300)
})
watch(estado, cargar)
onMounted(cargar)
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Presupuestos</h1>
      <p class="subtitulo">Cotizaciones para el cliente antes de abrir una orden de trabajo</p>
    </div>
    <RouterLink to="/presupuestos/nuevo" class="btn btn-primario">+ Nuevo presupuesto</RouterLink>
  </div>

  <div class="card">
    <div class="filtros">
      <input v-model="busqueda" class="buscador" placeholder="Buscar por patente, cliente o N°..." />
      <select v-model="estado" aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        <option v-for="e in ESTADOS_PRESUPUESTO" :key="e.valor" :value="e.valor">
          {{ e.texto }}
        </option>
      </select>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Fecha</th>
            <th>Vehículo</th>
            <th>Cliente</th>
            <th>Vence</th>
            <th>Estado</th>
            <th class="der">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="8" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!presupuestos.length">
            <td colspan="8" class="vacio">
              <template v-if="busqueda || estado">Ningún presupuesto coincide con el filtro.</template>
              <template v-else>
                Aún no hay presupuestos. Crea el primero con <strong>+ Nuevo presupuesto</strong>.
              </template>
            </td>
          </tr>
          <tr v-for="p in presupuestos" v-else :key="p.id">
            <td>
              <RouterLink :to="`/presupuestos/${p.id}`">#{{ p.id }}</RouterLink>
            </td>
            <td>{{ formatearFecha(fechaLocal(p.fecha)) }}</td>
            <td>
              <span class="patente">{{ p.vehiculo?.patente }}</span>
              {{ p.vehiculo?.marca }} {{ p.vehiculo?.modelo }}
            </td>
            <td>{{ p.vehiculo?.cliente?.nombre ?? '—' }}</td>
            <td>{{ formatearFecha(fechaVencimiento(p)) }}</td>
            <td>
              <PresupuestoBadge :estado="estadoPresupuesto(p)" />
              <RouterLink v-if="p.ordenId" :to="`/ordenes/${p.ordenId}`" class="orden">
                Orden #{{ p.ordenId }}
              </RouterLink>
            </td>
            <td class="der">{{ formatearPesos(p.total) }}</td>
            <td>
              <button
                class="btn-eliminar"
                type="button"
                :disabled="p.ordenId"
                :title="p.ordenId ? 'El presupuesto convertido no se puede eliminar' : ''"
                @click.stop="eliminarPresupuesto(p)"
              >
                Eliminar
              </button>
            </td>
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
  margin: 0;
  flex: 1;
  min-width: 220px;
}
.filtros select {
  width: auto;
}
.der {
  text-align: right;
  white-space: nowrap;
}
.btn-eliminar {
  border: 0;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
  font: inherit;
}
.btn-eliminar:disabled {
  color: var(--muted);
  cursor: not-allowed;
}
.orden {
  display: block;
  font-size: 0.8rem;
  margin-top: 0.2rem;
}
</style>
