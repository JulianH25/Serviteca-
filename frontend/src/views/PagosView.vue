<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { pagosApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'
import { fechaHora } from '@/utils/ordenes'
import { METODOS_PAGO, etiquetaMetodo, hoyIso } from '@/utils/presupuestos'

const desde = ref(hoyIso())
const hasta = ref(hoyIso())
const pagos = ref([])
const cargando = ref(true)
const error = ref('')

const rangoInvalido = computed(() => desde.value && hasta.value && desde.value > hasta.value)

const totalGeneral = computed(() => pagos.value.reduce((s, p) => s + p.monto, 0))

// Total recibido por cada método (útil para cuadrar la caja)
const porMetodo = computed(() =>
  METODOS_PAGO.map((m) => ({
    ...m,
    total: pagos.value.filter((p) => p.metodo === m.valor).reduce((s, p) => s + p.monto, 0)
  })).filter((m) => m.total > 0)
)

async function cargar() {
  if (rangoInvalido.value) return
  cargando.value = true
  error.value = ''
  try {
    pagos.value = await pagosApi.listar({ desde: desde.value, hasta: hasta.value })
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los pagos')
  } finally {
    cargando.value = false
  }
}

function soloHoy() {
  desde.value = hoyIso()
  hasta.value = hoyIso()
}

watch([desde, hasta], cargar)
onMounted(cargar)
</script>

<template>
  <h1>Pagos</h1>
  <p class="subtitulo">Pagos recibidos y sus comprobantes</p>

  <div class="card">
    <div class="filtros">
      <div class="campo">
        <label for="desde">Desde</label>
        <input id="desde" v-model="desde" type="date" />
      </div>
      <div class="campo">
        <label for="hasta">Hasta</label>
        <input id="hasta" v-model="hasta" type="date" :class="{ invalido: rangoInvalido }" />
      </div>
      <button type="button" class="btn btn-secundario" @click="soloHoy">Hoy</button>
    </div>
    <p v-if="rangoInvalido" class="alerta alerta-error">La fecha "desde" no puede ser posterior a "hasta".</p>

    <div class="totales">
      <div class="total-principal">
        <span>Total recibido</span>
        <strong>{{ formatearPesos(totalGeneral) }}</strong>
        <small>{{ pagos.length }} {{ pagos.length === 1 ? 'pago' : 'pagos' }}</small>
      </div>
      <div v-for="m in porMetodo" :key="m.valor" class="total-metodo">
        <span>{{ m.texto }}</span>
        <strong>{{ formatearPesos(m.total) }}</strong>
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Comprobante</th>
            <th>Orden</th>
            <th>Vehículo</th>
            <th>Cliente</th>
            <th>Método</th>
            <th class="der">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="7" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!pagos.length">
            <td colspan="7" class="vacio">No hay pagos registrados en estas fechas.</td>
          </tr>
          <tr v-for="p in pagos" v-else :key="p.id">
            <td class="nowrap">{{ fechaHora(p.fecha) }}</td>
            <td>
              <RouterLink v-if="p.comprobante" :to="`/comprobantes/${p.comprobante.id}`">
                {{ p.comprobante.numero }}
              </RouterLink>
            </td>
            <td>
              <RouterLink :to="`/ordenes/${p.ordenId}`">#{{ p.ordenId }}</RouterLink>
            </td>
            <td><span class="patente">{{ p.orden?.vehiculo?.patente }}</span></td>
            <td>{{ p.orden?.vehiculo?.cliente?.nombre ?? '—' }}</td>
            <td>{{ etiquetaMetodo(p.metodo) }}</td>
            <td class="der">{{ formatearPesos(p.monto) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.filtros .campo {
  width: 170px;
}
.totales {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}
.totales > div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  min-width: 150px;
}
.totales span,
.totales small {
  font-size: 0.8rem;
  color: var(--muted);
}
.totales strong {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}
.total-principal {
  background: var(--bg);
}
.total-principal strong {
  font-size: 1.5rem;
}
.nowrap {
  white-space: nowrap;
}
.der {
  text-align: right;
  white-space: nowrap;
}
</style>
