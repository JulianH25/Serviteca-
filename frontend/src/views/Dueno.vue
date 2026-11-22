<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'

const local = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const hoy = new Date()
const desde = ref(local(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
const hasta = ref(local(hoy))
const datos = ref(null)
const cargando = ref(false)
const error = ref('')

const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
const fechaHora = (f) => new Date(f).toLocaleString('es-CL')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const { data } = await api.get('/dueno/resumen', {
      params: { desde: desde.value, hasta: hasta.value }
    })
    datos.value = data
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo cargar el panel'
  } finally {
    cargando.value = false
  }
}

const maxDia = computed(() => Math.max(1, ...(datos.value?.ingresos.porDia.map((d) => d.monto) ?? [1])))
const estados = ['RECEPCIONADO', 'EN_PROCESO', 'TERMINADO', 'ENTREGADO', 'CANCELADO']

onMounted(cargar)
</script>

<template>
  <div class="dueno">
    <header class="top">
      <h1>Panel del dueño</h1>
      <div class="filtros">
        <label>Desde <input type="date" v-model="desde" /></label>
        <label>Hasta <input type="date" v-model="hasta" /></label>
        <button @click="cargar" :disabled="cargando">{{ cargando ? 'Cargando...' : 'Actualizar' }}</button>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="datos">
      <section class="kpis">
        <div class="kpi"><span>Ingresos (pagos)</span><strong>{{ clp(datos.ingresos.total) }}</strong><small>{{ datos.ingresos.cantidadPagos }} pagos</small></div>
        <div class="kpi"><span>Ganancia estimada</span><strong>{{ clp(datos.ventas.ganancia) }}</strong><small>Margen {{ datos.ventas.margen }}%</small></div>
        <div class="kpi"><span>Ventas del período</span><strong>{{ clp(datos.ventas.total) }}</strong><small>{{ datos.ventas.ordenes }} órdenes</small></div>
        <div class="kpi warn"><span>Por cobrar</span><strong>{{ clp(datos.porCobrar.total) }}</strong><small>{{ datos.porCobrar.ordenes }} órdenes con saldo</small></div>
        <div class="kpi"><span>Ticket promedio</span><strong>{{ clp(datos.ingresos.ticketPromedio) }}</strong></div>
        <div class="kpi"><span>Valor inventario (costo)</span><strong>{{ clp(datos.inventario.valorCosto) }}</strong><small>{{ datos.inventario.stockBajo }} con stock bajo</small></div>
      </section>

      <section class="grid">
        <div class="card">
          <h2>Ingresos por día</h2>
          <p v-if="!datos.ingresos.porDia.length" class="vacio">Sin pagos en el período</p>
          <div class="barras">
            <div v-for="d in datos.ingresos.porDia" :key="d.fecha" class="barra" :title="`${d.fecha}: ${clp(d.monto)}`">
              <div class="relleno" :style="{ height: (d.monto / maxDia) * 100 + '%' }"></div>
              <small>{{ d.fecha.slice(5) }}</small>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>Pagos por método</h2>
          <table>
            <tbody>
              <tr v-for="(monto, metodo) in datos.ingresos.porMetodo" :key="metodo">
                <td>{{ metodo }}</td><td class="num">{{ clp(monto) }}</td>
              </tr>
              <tr v-if="!Object.keys(datos.ingresos.porMetodo).length"><td class="vacio">Sin pagos</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Desglose de ventas</h2>
          <table>
            <tbody>
              <tr><td>Servicios</td><td class="num">{{ clp(datos.ventas.servicios) }}</td></tr>
              <tr><td>Productos</td><td class="num">{{ clp(datos.ventas.productos) }}</td></tr>
              <tr><td>Costo de productos</td><td class="num">- {{ clp(datos.ventas.costoProductos) }}</td></tr>
              <tr class="total"><td>Ganancia</td><td class="num">{{ clp(datos.ventas.ganancia) }}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Órdenes por estado</h2>
          <table>
            <tbody>
              <tr v-for="e in estados" :key="e"><td>{{ e }}</td><td class="num">{{ datos.ordenesPorEstado[e] ?? 0 }}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Servicios más vendidos</h2>
          <table>
            <tbody>
              <tr v-for="s in datos.topServicios" :key="s.nombre"><td>{{ s.nombre }} <small>x{{ s.cantidad }}</small></td><td class="num">{{ clp(s.monto) }}</td></tr>
              <tr v-if="!datos.topServicios.length"><td class="vacio">Sin datos</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Productos más vendidos</h2>
          <table>
            <tbody>
              <tr v-for="p in datos.topProductos" :key="p.nombre"><td>{{ p.nombre }} <small>x{{ p.cantidad }}</small></td><td class="num">{{ clp(p.monto) }}</td></tr>
              <tr v-if="!datos.topProductos.length"><td class="vacio">Sin datos</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Últimos pagos</h2>
        <div class="scroll">
          <table class="tabla">
            <thead>
              <tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th>Patente</th><th>Método</th><th>Registrado por</th><th class="num">Monto</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in datos.ultimosPagos" :key="p.id">
                <td>{{ fechaHora(p.fecha) }}</td>
                <td>{{ p.comprobante ?? '-' }}</td>
                <td>{{ p.cliente ?? '-' }}</td>
                <td>{{ p.patente ?? '-' }}</td>
                <td>{{ p.metodo }}</td>
                <td>{{ p.registradoPor ?? '-' }}</td>
                <td class="num">{{ clp(p.monto) }}</td>
              </tr>
              <tr v-if="!datos.ultimosPagos.length"><td colspan="7" class="vacio">Sin pagos en el período</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dueno { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
.top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.filtros { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
.filtros input { padding: .35rem; margin-left: .25rem; }
.filtros button { padding: .45rem 1rem; cursor: pointer; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: .25rem; }
.kpi span { color: #6b7280; font-size: .85rem; }
.kpi strong { font-size: 1.5rem; }
.kpi small { color: #6b7280; }
.kpi.warn strong { color: #b45309; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 1rem; }
.card h2 { font-size: 1rem; margin: 0 0 .75rem; }
table { width: 100%; border-collapse: collapse; }
td, th { padding: .4rem .5rem; border-bottom: 1px solid #f3f4f6; text-align: left; }
.num { text-align: right; white-space: nowrap; }
.total td { font-weight: 700; border-top: 2px solid #e5e7eb; }
.vacio { color: #9ca3af; text-align: center; }
.scroll { overflow-x: auto; }
.barras { display: flex; align-items: flex-end; gap: 4px; height: 160px; overflow-x: auto; }
.barra { flex: 1; min-width: 22px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
.relleno { width: 100%; background: #2563eb; border-radius: 4px 4px 0 0; min-height: 2px; }
.barra small { font-size: .65rem; color: #6b7280; }
.error { color: #b91c1c; }
</style>