<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'

const local = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoy = new Date()
const desde = ref(local(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
const hasta = ref(local(hoy))
const metodo = ref('')
const pagos = ref([])
const cargando = ref(false)
const error = ref('')

const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
const fechaHora = (f) => new Date(f).toLocaleString('es-CL')
const total = computed(() => pagos.value.reduce((s, p) => s + p.monto, 0))

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const { data } = await api.get('/dueno/pagos', {
      params: { desde: desde.value, hasta: hasta.value, metodo: metodo.value || undefined }
    })
    pagos.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudieron cargar los pagos'
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <div class="d-pag">
    <h1>Pagos recibidos</h1>

    <div class="d-filtros">
      <label>Desde <input type="date" v-model="desde" /></label>
      <label>Hasta <input type="date" v-model="hasta" /></label>
      <label>
        Método
        <select v-model="metodo">
          <option value="">Todos</option>
          <option>EFECTIVO</option>
          <option>DEBITO</option>
          <option>CREDITO</option>
          <option>TRANSFERENCIA</option>
        </select>
      </label>
      <button @click="cargar" :disabled="cargando">{{ cargando ? 'Cargando...' : 'Buscar' }}</button>
    </div>

    <p v-if="error" class="d-error">{{ error }}</p>

    <div class="d-kpis">
      <div class="d-kpi"><span>Total recibido</span><strong>{{ clp(total) }}</strong></div>
      <div class="d-kpi"><span>Cantidad de pagos</span><strong>{{ pagos.length }}</strong></div>
    </div>

    <div class="d-card d-scroll">
      <table class="d-tabla">
        <thead>
          <tr>
            <th>Fecha</th><th>Comprobante</th><th>Orden</th><th>Patente</th><th>Cliente</th>
            <th>RUT</th><th>Método</th><th>Registrado por</th><th class="num">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pagos" :key="p.id">
            <td>{{ fechaHora(p.fecha) }}</td>
            <td>{{ p.comprobante?.numero ?? '-' }}</td>
            <td>#{{ p.orden?.id }}</td>
            <td>{{ p.orden?.vehiculo?.patente ?? '-' }}</td>
            <td>{{ p.orden?.vehiculo?.cliente?.nombre ?? '-' }}</td>
            <td>{{ p.orden?.vehiculo?.cliente?.rut ?? '-' }}</td>
            <td>{{ p.metodo }}</td>
            <td>{{ p.usuario?.nombre ?? p.usuario?.email ?? '-' }}</td>
            <td class="num">{{ clp(p.monto) }}</td>
          </tr>
          <tr v-if="!pagos.length"><td colspan="9" class="d-vacio">Sin pagos en el período</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>