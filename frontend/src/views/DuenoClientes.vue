<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'

const q = ref('')
const lista = ref([])
const detalle = ref(null)
const seleccionado = ref(null)
const cargando = ref(false)
const cargandoDetalle = ref(false)
const error = ref('')

const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-CL') : '-')

async function cargar() {
  cargando.value = true
  error.value = ''
  detalle.value = null
  seleccionado.value = null
  try {
    const { data } = await api.get('/dueno/clientes', { params: { q: q.value || undefined } })
    lista.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudieron cargar los clientes'
  } finally {
    cargando.value = false
  }
}

async function abrir(c) {
  seleccionado.value = c.id
  cargandoDetalle.value = true
  error.value = ''
  try {
    const { data } = await api.get(`/dueno/clientes/${c.id}`)
    detalle.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo cargar el cliente'
  } finally {
    cargandoDetalle.value = false
  }
}

async function validar(c) {
  const rut = window.prompt(`RUT de ${c.nombre}`)
  if (!rut) return
  try {
    await api.patch(`/clientes/${c.id}/validar`, { rut })
    await cargar()
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo validar el cliente'
  }
}

onMounted(cargar)
</script>

<template>
  <div class="d-pag">
    <h1>Clientes</h1>

    <div class="d-filtros">
      <label>Buscar <input v-model="q" placeholder="Nombre, RUT, teléfono o correo" @keyup.enter="cargar" /></label>
      <button @click="cargar" :disabled="cargando">{{ cargando ? 'Cargando...' : 'Buscar' }}</button>
    </div>

    <p v-if="error" class="d-error">{{ error }}</p>

    <div class="d-card d-scroll">
      <table class="d-tabla">
        <thead>
          <tr>
            <th>Nombre</th><th>RUT</th><th>Teléfono</th><th>Correo</th><th>Cuenta portal</th>
            <th class="num">Autos</th><th class="num">Órdenes</th>
            <th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Accion</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in lista" :key="c.id" class="click" :class="{ sel: seleccionado === c.id }" @click="abrir(c)">
            <td>{{ c.nombre }}</td>
            <td>{{ c.rut }}</td>
            <td>{{ c.telefono }}</td>
            <td>{{ c.correo ?? '-' }}</td>
            <td>{{ c.cuentaPortal ?? 'Sin cuenta' }}</td>
            <td class="num">{{ c.vehiculos }}</td>
            <td class="num">{{ c.ordenes }}</td>
            <td class="num">{{ clp(c.total) }}</td>
            <td class="num d-pos">{{ clp(c.pagado) }}</td>
            <td class="num d-neg">{{ clp(c.saldo) }}</td>
            <td><button v-if="c.estadoValidacion === 'PENDIENTE'" @click.stop="validar(c)">Validar RUT</button></td>
          </tr>
          <tr v-if="!lista.length"><td colspan="11" class="d-vacio">Sin clientes</td></tr>
        </tbody>
      </table>
      <p style="font-size: .8rem; color: #6b7280">Haz clic en un cliente para ver el detalle.</p>
    </div>

    <p v-if="cargandoDetalle">Cargando detalle...</p>

    <template v-if="detalle && !cargandoDetalle">
      <div class="d-card">
        <h2>{{ detalle.nombre }}</h2>
        <div class="d-datos">
          <div class="d-dato">RUT<b>{{ detalle.rut }}</b></div>
          <div class="d-dato">Teléfono<b>{{ detalle.telefono }}</b></div>
          <div class="d-dato">Correo<b>{{ detalle.correo ?? '-' }}</b></div>
          <div class="d-dato">Cuenta portal<b>{{ detalle.cuentaPortal ?? 'Sin cuenta' }}</b></div>
          <div class="d-dato">Cliente desde<b>{{ fecha(detalle.creadoEn) }}</b></div>
          <div class="d-dato">Total facturado<b>{{ clp(detalle.resumen.total) }}</b></div>
          <div class="d-dato">Pagado<b class="d-pos">{{ clp(detalle.resumen.pagado) }}</b></div>
          <div class="d-dato">Saldo<b class="d-neg">{{ clp(detalle.resumen.saldo) }}</b></div>
        </div>
      </div>

      <div v-for="v in detalle.vehiculos" :key="v.id" class="d-card d-scroll">
        <h2>
          {{ v.patente }} · {{ v.marca }} {{ v.modelo }} {{ v.anio }}
          <small v-if="v.kilometraje != null">({{ v.kilometraje }} km)</small>
        </h2>
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Orden</th><th>Fecha</th><th>Estado</th><th>Atendido por</th><th>Servicios</th><th>Pagos</th>
              <th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in v.ordenes" :key="o.id">
              <td>#{{ o.id }}</td>
              <td>{{ fecha(o.fechaIngreso) }}</td>
              <td><span class="d-badge">{{ o.estado }}</span></td>
              <td>{{ o.mecanico?.nombre ?? o.mecanico?.email ?? '-' }}</td>
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
            <tr v-if="!v.ordenes.length"><td colspan="9" class="d-vacio">Sin órdenes</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
