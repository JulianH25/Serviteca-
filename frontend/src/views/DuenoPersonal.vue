<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'

const desde = ref('')
const hasta = ref('')
const lista = ref([])
const detalle = ref(null)
const seleccionado = ref(null)
const cargando = ref(false)
const cargandoDetalle = ref(false)
const error = ref('')

const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-CL') : '-')
const params = () => ({ desde: desde.value || undefined, hasta: hasta.value || undefined })

async function cargar() {
  cargando.value = true
  error.value = ''
  detalle.value = null
  seleccionado.value = null
  try {
    const { data } = await api.get('/dueno/personal', { params: params() })
    lista.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo cargar el personal'
  } finally {
    cargando.value = false
  }
}

async function abrir(p) {
  seleccionado.value = p.id
  cargandoDetalle.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/dueno/personal/${encodeURIComponent(p.id)}`, { params: params() })
    detalle.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo cargar el detalle'
  } finally {
    cargandoDetalle.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <div class="d-pag">
    <h1>Personal y trabajo realizado</h1>

    <div class="d-filtros">
      <label>Desde <input type="date" v-model="desde" /></label>
      <label>Hasta <input type="date" v-model="hasta" /></label>
      <button @click="cargar" :disabled="cargando">{{ cargando ? 'Cargando...' : 'Filtrar' }}</button>
    </div>

    <p v-if="error" class="d-error">{{ error }}</p>

    <div class="d-card d-scroll">
      <table class="d-tabla">
        <thead>
          <tr>
            <th>Trabajador</th><th>Rol</th><th class="num">Órdenes</th><th class="num">Activas</th>
            <th class="num">Clientes</th><th class="num">Autos</th>
            <th class="num">Vendido</th><th class="num">Cobrado</th><th class="num">Por cobrar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in lista" :key="p.id" class="click" :class="{ sel: seleccionado === p.id }" @click="abrir(p)">
            <td>{{ p.nombre ?? p.email }}<br /><small>{{ p.email }}</small></td>
            <td><span class="d-badge">{{ p.rol }}</span></td>
            <td class="num">{{ p.ordenes }}</td>
            <td class="num">{{ p.activas }}</td>
            <td class="num">{{ p.clientes }}</td>
            <td class="num">{{ p.vehiculos }}</td>
            <td class="num">{{ clp(p.vendido) }}</td>
            <td class="num d-pos">{{ clp(p.cobrado) }}</td>
            <td class="num d-neg">{{ clp(p.porCobrar) }}</td>
          </tr>
          <tr v-if="!lista.length"><td colspan="9" class="d-vacio">Sin personal registrado</td></tr>
        </tbody>
      </table>
      <p style="font-size: .8rem; color: #6b7280">Haz clic en un trabajador para ver el detalle.</p>
    </div>

    <p v-if="cargandoDetalle">Cargando detalle...</p>

    <template v-if="detalle && !cargandoDetalle">
      <div class="d-kpis">
        <div class="d-kpi"><span>Trabajador</span><strong>{{ detalle.perfil.nombre ?? detalle.perfil.email }}</strong></div>
        <div class="d-kpi"><span>Órdenes</span><strong>{{ detalle.resumen.ordenes }}</strong></div>
        <div class="d-kpi"><span>Vendido</span><strong>{{ clp(detalle.resumen.vendido) }}</strong></div>
        <div class="d-kpi"><span>Cobrado</span><strong>{{ clp(detalle.resumen.cobrado) }}</strong></div>
        <div class="d-kpi warn"><span>Por cobrar</span><strong>{{ clp(detalle.resumen.porCobrar) }}</strong></div>
      </div>

      <div class="d-dos">
        <div class="d-card">
          <h2>Clientes que atiende ({{ detalle.clientes.length }})</h2>
          <table class="d-tabla">
            <thead><tr><th>Nombre</th><th>RUT</th><th>Teléfono</th><th>Correo</th></tr></thead>
            <tbody>
              <tr v-for="c in detalle.clientes" :key="c.id">
                <td>{{ c.nombre }}</td><td>{{ c.rut }}</td><td>{{ c.telefono }}</td><td>{{ c.correo ?? '-' }}</td>
              </tr>
              <tr v-if="!detalle.clientes.length"><td colspan="4" class="d-vacio">Sin clientes</td></tr>
            </tbody>
          </table>
        </div>

        <div class="d-card">
          <h2>Autos que maneja ({{ detalle.vehiculos.length }})</h2>
          <table class="d-tabla">
            <thead><tr><th>Patente</th><th>Vehículo</th><th>Dueño</th></tr></thead>
            <tbody>
              <tr v-for="v in detalle.vehiculos" :key="v.id">
                <td>{{ v.patente }}</td><td>{{ v.marca }} {{ v.modelo }} {{ v.anio }}</td><td>{{ v.cliente }}</td>
              </tr>
              <tr v-if="!detalle.vehiculos.length"><td colspan="3" class="d-vacio">Sin autos</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="d-card d-scroll">
        <h2>Órdenes, servicios y pagos</h2>
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Orden</th><th>Fecha</th><th>Estado</th><th>Auto</th><th>Cliente</th><th>Servicios</th><th>Pagos</th>
              <th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in detalle.ordenes" :key="o.id">
              <td>#{{ o.id }}</td>
              <td>{{ fecha(o.fechaIngreso) }}</td>
              <td><span class="d-badge">{{ o.estado }}</span></td>
              <td>{{ o.vehiculo?.patente }}<br /><small>{{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }}</small></td>
              <td>{{ o.vehiculo?.cliente?.nombre }}</td>
              <td>
                <div v-for="(s, i) in o.servicios" :key="'s' + i">{{ s.nombre }} x{{ s.cantidad }}</div>
                <div v-for="(p, i) in o.productos" :key="'p' + i"><small>{{ p.nombre }} x{{ p.cantidad }}</small></div>
              </td>
              <td>
                <div v-for="p in o.pagos" :key="p.id"><small>{{ fecha(p.fecha) }} · {{ p.metodo }} · {{ clp(p.monto) }}</small></div>
                <span v-if="!o.pagos.length">-</span>
              </td>
              <td class="num">{{ clp(o.total) }}</td>
              <td class="num d-pos">{{ clp(o.pagado) }}</td>
              <td class="num d-neg">{{ clp(o.saldo) }}</td>
            </tr>
            <tr v-if="!detalle.ordenes.length"><td colspan="10" class="d-vacio">Sin órdenes</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>