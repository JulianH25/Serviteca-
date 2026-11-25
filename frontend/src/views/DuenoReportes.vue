<script setup>
import { ref, watch } from 'vue'
import { reportesApi, mensajeError } from '@/services/api'
import { hoyIso } from '@/utils/presupuestos'

const clp = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-CL') : '—')

const TABS = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'ganancias', texto: 'Ganancias' },
  { id: 'servicios', texto: 'Servicios' },
  { id: 'productos', texto: 'Productos' },
  { id: 'rotacion', texto: 'Rotación' },
  { id: 'clientes', texto: 'Clientes' },
  { id: 'general', texto: 'General' }
]
const RANGOS = [
  { id: 'mes', texto: 'Este mes' },
  { id: 'mesAnt', texto: 'Mes anterior' },
  { id: '30', texto: 'Últimos 30 días' },
  { id: 'anio', texto: 'Este año' }
]

const hoy = new Date()
const desde = ref(hoyIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
const hasta = ref(hoyIso(hoy))
const tab = ref('resumen')
const datos = ref(null)
const cargando = ref(false)
const error = ref('')

function aplicarRango(id) {
  const h = new Date()
  let d
  let f = h
  if (id === 'mes') d = new Date(h.getFullYear(), h.getMonth(), 1)
  else if (id === 'mesAnt') {
    d = new Date(h.getFullYear(), h.getMonth() - 1, 1)
    f = new Date(h.getFullYear(), h.getMonth(), 0)
  } else if (id === '30') d = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 29)
  else d = new Date(h.getFullYear(), 0, 1)
  desde.value = hoyIso(d)
  hasta.value = hoyIso(f)
}

let secuencia = 0
async function cargar() {
  if (!desde.value || !hasta.value || desde.value > hasta.value) {
    error.value = 'La fecha "desde" no puede ser posterior a "hasta".'
    return
  }
  const mia = ++secuencia
  cargando.value = true
  error.value = ''
  datos.value = null
  try {
    const r = await reportesApi[tab.value]({ desde: desde.value, hasta: hasta.value })
    if (mia === secuencia) datos.value = r
  } catch (e) {
    if (mia === secuencia) error.value = mensajeError(e, 'No se pudo generar el reporte')
  } finally {
    if (mia === secuencia) cargando.value = false
  }
}
watch([tab, desde, hasta], cargar, { immediate: true })

// ---------- Helpers de presentación ----------
const maxVentas = () => Math.max(1, ...(datos.value?.serie?.map((p) => p.ventas) ?? [1]))
const etiqueta = (p) => (p.length === 7 ? p : p.slice(5))
function delta(v) {
  if (v === null || v === undefined) return { texto: 'sin base de comparación', clase: '' }
  if (v === 0) return { texto: '= vs período anterior', clase: '' }
  return {
    texto: `${v > 0 ? '▲' : '▼'} ${Math.abs(v)}% vs período anterior`,
    clase: v > 0 ? 'r-sube' : 'r-baja'
  }
}
const METODOS = { EFECTIVO: 'Efectivo', DEBITO: 'Débito', CREDITO: 'Crédito', TRANSFERENCIA: 'Transferencia' }
const CLASES = {
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
  SIN_MOVIMIENTO: 'Sin movimiento',
  AGOTADO: 'Agotado'
}
const ESTADOS_ORDEN = {
  RECEPCIONADO: 'Recepcionado',
  EN_PROCESO: 'En proceso',
  TERMINADO: 'Terminado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado'
}
const pct = (n) => (n === null || n === undefined ? '—' : `${n}%`)

// ---------- Exportar CSV ----------
function descargarCsv(nombre, columnas, filas) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lineas = [
    columnas.map((c) => esc(c.titulo)).join(';'),
    ...filas.map((f) => columnas.map((c) => esc(f[c.campo])).join(';'))
  ]
  const blob = new Blob(['\ufeff' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${nombre}_${desde.value}_${hasta.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportar() {
  const d = datos.value
  if (!d) return
  const t = tab.value

  if (t === 'resumen') {
    descargarCsv('resumen', [
      { titulo: 'Período', campo: 'periodo' },
      { titulo: 'Ventas', campo: 'ventas' },
      { titulo: 'Ganancia', campo: 'ganancia' },
      { titulo: 'Cobrado', campo: 'cobrado' }
    ], d.serie)
  } else if (t === 'ganancias') {
    descargarCsv('ganancias', [
      { titulo: 'Orden', campo: 'id' },
      { titulo: 'Fecha', campo: 'fecha' },
      { titulo: 'Patente', campo: 'patente' },
      { titulo: 'Cliente', campo: 'cliente' },
      { titulo: 'Total', campo: 'total' },
      { titulo: 'Costo', campo: 'costo' },
      { titulo: 'Ganancia', campo: 'ganancia' },
      { titulo: 'Margen %', campo: 'margen' }
    ], d.detalle)
  } else if (t === 'servicios') {
    descargarCsv('servicios', [
      { titulo: 'Servicio', campo: 'nombre' },
      { titulo: 'Cantidad', campo: 'cantidad' },
      { titulo: 'Órdenes', campo: 'ordenes' },
      { titulo: 'Monto', campo: 'monto' },
      { titulo: 'Precio promedio', campo: 'precioPromedio' },
      { titulo: '% del total', campo: 'participacion' }
    ], d.ranking)
  } else if (t === 'productos') {
    descargarCsv('productos', [
      { titulo: 'Producto', campo: 'nombre' },
      { titulo: 'Categoría', campo: 'categoria' },
      { titulo: 'Unidades', campo: 'cantidad' },
      { titulo: 'Ventas', campo: 'monto' },
      { titulo: 'Costo', campo: 'costo' },
      { titulo: 'Ganancia', campo: 'ganancia' },
      { titulo: 'Margen %', campo: 'margen' }
    ], d.ranking)
  } else if (t === 'rotacion') {
    descargarCsv('rotacion', [
      { titulo: 'Producto', campo: 'nombre' },
      { titulo: 'Categoría', campo: 'categoria' },
      { titulo: 'Stock actual', campo: 'stockActual' },
      { titulo: 'Stock mínimo', campo: 'stockMinimo' },
      { titulo: 'Vendidas', campo: 'vendidas' },
      { titulo: 'Rotación', campo: 'rotacion' },
      { titulo: 'Cobertura (días)', campo: 'cobertura' },
      { titulo: 'Clasificación', campo: 'clase' },
      { titulo: 'Reponer', campo: 'reponer' },
      { titulo: 'Valor stock', campo: 'valorStock' }
    ], d.productos)
  } else if (t === 'clientes') {
    descargarCsv('clientes', [
      { titulo: 'Cliente', campo: 'nombre' },
      { titulo: 'RUT', campo: 'rut' },
      { titulo: 'Órdenes', campo: 'ordenes' },
      { titulo: 'Vehículos', campo: 'vehiculos' },
      { titulo: 'Total', campo: 'total' },
      { titulo: 'Pagado', campo: 'pagado' },
      { titulo: 'Saldo', campo: 'saldo' },
      { titulo: 'Última visita', campo: 'ultimaVisita' }
    ], d.ranking)
  } else if (t === 'general') {
    descargarCsv('general_personal', [
      { titulo: 'Trabajador', campo: 'nombre' },
      { titulo: 'Órdenes', campo: 'ordenes' },
      { titulo: 'Entregadas', campo: 'entregadas' },
      { titulo: 'Ventas', campo: 'ventas' }
    ], d.personal)
  }
}
</script>

<template>
  <div class="d-pag">
    <h1>Reportes y analítica</h1>

    <div class="d-filtros">
      <label>Desde <input v-model="desde" type="date" /></label>
      <label>Hasta <input v-model="hasta" type="date" /></label>
      <button v-for="r in RANGOS" :key="r.id" type="button" @click="aplicarRango(r.id)">
        {{ r.texto }}
      </button>
      <button type="button" :disabled="!datos" @click="exportar">Exportar CSV</button>
    </div>

    <nav class="r-tabs">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        :class="{ on: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.texto }}
      </button>
    </nav>

    <p v-if="error" class="d-error">{{ error }}</p>
    <p v-if="cargando">Generando reporte...</p>

    <!-- ===== RESUMEN ===== -->
    <template v-if="datos && tab === 'resumen'">
      <div class="d-kpis">
        <div class="d-kpi">
          <span>Ventas (IVA incl.)</span><strong>{{ clp(datos.kpis.ventas) }}</strong>
          <small :class="delta(datos.variacion.ventas).clase">{{ delta(datos.variacion.ventas).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Ganancia estimada</span><strong>{{ clp(datos.kpis.ganancia) }}</strong>
          <small :class="delta(datos.variacion.ganancia).clase">{{ delta(datos.variacion.ganancia).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Margen</span><strong>{{ datos.kpis.margen }}%</strong>
          <small>Neto de IVA: {{ clp(datos.kpis.gananciaNeta) }}</small>
        </div>
        <div class="d-kpi">
          <span>Cobrado</span><strong>{{ clp(datos.kpis.cobrado) }}</strong>
          <small :class="delta(datos.variacion.cobrado).clase">{{ delta(datos.variacion.cobrado).texto }}</small>
        </div>
        <div class="d-kpi warn">
          <span>Por cobrar</span><strong>{{ clp(datos.kpis.porCobrar) }}</strong>
          <small>de las órdenes del período</small>
        </div>
        <div class="d-kpi">
          <span>Ticket promedio</span><strong>{{ clp(datos.kpis.ticketPromedio) }}</strong>
          <small :class="delta(datos.variacion.ticketPromedio).clase">{{ delta(datos.variacion.ticketPromedio).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Órdenes</span><strong>{{ datos.kpis.ordenes }}</strong>
          <small :class="delta(datos.variacion.ordenes).clase">{{ delta(datos.variacion.ordenes).texto }}</small>
        </div>
      </div>

      <div class="d-dos">
        <div class="d-card">
          <h2>Ventas por {{ datos.periodo.agrupacion === 'mes' ? 'mes' : 'día' }}</h2>
          <p v-if="!datos.serie.length" class="d-vacio">Sin movimiento en el período</p>
          <div class="r-barras">
            <div
              v-for="p in datos.serie"
              :key="p.periodo"
              class="r-barra"
              :title="`${p.periodo}: ventas ${clp(p.ventas)} · ganancia ${clp(p.ganancia)} · cobrado ${clp(p.cobrado)}`"
            >
              <div class="r-col" :style="{ height: (p.ventas / maxVentas()) * 100 + '%' }">
                <div
                  class="r-gan"
                  :style="{ height: p.ventas ? Math.max(0, p.ganancia / p.ventas) * 100 + '%' : '0%' }"
                ></div>
              </div>
              <small>{{ etiqueta(p.periodo) }}</small>
            </div>
          </div>
          <small class="r-leyenda"><i class="r-c1"></i> Ventas <i class="r-c2"></i> Ganancia</small>
        </div>

        <div class="d-card">
          <h2>Desglose</h2>
          <table class="d-tabla">
            <tbody>
              <tr><td>Servicios</td><td class="num">{{ clp(datos.kpis.ventasServicios) }}</td></tr>
              <tr><td>Productos</td><td class="num">{{ clp(datos.kpis.ventasProductos) }}</td></tr>
              <tr><td>Costo de productos</td><td class="num">- {{ clp(datos.kpis.costoProductos) }}</td></tr>
              <tr><td>IVA contenido en ventas</td><td class="num">{{ clp(datos.kpis.iva) }}</td></tr>
            </tbody>
          </table>
          <h2 style="margin-top: 1rem">Pagos por método</h2>
          <table class="d-tabla">
            <tbody>
              <tr v-for="(monto, m) in datos.porMetodo" :key="m">
                <td>{{ METODOS[m] ?? m }}</td><td class="num">{{ clp(monto) }}</td>
              </tr>
              <tr v-if="!Object.keys(datos.porMetodo).length"><td class="d-vacio">Sin pagos</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ===== GANANCIAS ===== -->
    <template v-if="datos && tab === 'ganancias'">
      <div class="d-kpis">
        <div class="d-kpi">
          <span>Ventas (IVA incl.)</span><strong>{{ clp(datos.kpis.ventas) }}</strong>
          <small :class="delta(datos.variacion.ventas).clase">{{ delta(datos.variacion.ventas).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Costo de productos</span><strong>{{ clp(datos.kpis.costoProductos) }}</strong>
        </div>
        <div class="d-kpi">
          <span>Ganancia bruta</span><strong>{{ clp(datos.kpis.ganancia) }}</strong>
          <small :class="delta(datos.variacion.ganancia).clase">{{ delta(datos.variacion.ganancia).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Ganancia neta de IVA</span><strong>{{ clp(datos.kpis.gananciaNeta) }}</strong>
          <small :class="delta(datos.variacion.gananciaNeta).clase">{{ delta(datos.variacion.gananciaNeta).texto }}</small>
        </div>
        <div class="d-kpi">
          <span>Margen</span><strong>{{ datos.kpis.margen }}%</strong>
          <small :class="delta(datos.variacion.margen).clase">{{ delta(datos.variacion.margen).texto }}</small>
        </div>
        <div class="d-kpi warn">
          <span>Por cobrar</span><strong>{{ clp(datos.kpis.porCobrar) }}</strong>
          <small>Cobrado en el período: {{ clp(datos.kpis.cobrado) }}</small>
        </div>
      </div>

      <div class="d-dos">
        <div class="d-card">
          <h2>Ganancia por {{ datos.periodo.agrupacion === 'mes' ? 'mes' : 'día' }}</h2>
          <p v-if="!datos.serie.length" class="d-vacio">Sin movimiento en el período</p>
          <div class="r-barras">
            <div
              v-for="p in datos.serie"
              :key="p.periodo"
              class="r-barra"
              :title="`${p.periodo}: ventas ${clp(p.ventas)} · costo ${clp(p.costo)} · ganancia ${clp(p.ganancia)} (${p.margen}%)`"
            >
              <div class="r-col" :style="{ height: (p.ventas / maxVentas()) * 100 + '%' }">
                <div
                  class="r-gan"
                  :style="{ height: p.ventas ? Math.max(0, p.ganancia / p.ventas) * 100 + '%' : '0%' }"
                ></div>
              </div>
              <small>{{ etiqueta(p.periodo) }}</small>
            </div>
          </div>
          <small class="r-leyenda"><i class="r-c1"></i> Ventas <i class="r-c2"></i> Ganancia</small>
        </div>

        <div class="d-card">
          <h2>De dónde viene la ganancia</h2>
          <table class="d-tabla">
            <thead>
              <tr><th></th><th class="num">Ventas</th><th class="num">Costo</th><th class="num">Ganancia</th><th class="num">Margen</th></tr>
            </thead>
            <tbody>
              <tr v-for="(f, k) in datos.fuentes" :key="k">
                <td>{{ k === 'servicios' ? 'Servicios' : 'Productos' }}</td>
                <td class="num">{{ clp(f.ventas) }}</td>
                <td class="num">{{ clp(f.costo) }}</td>
                <td class="num d-pos">{{ clp(f.ganancia) }}</td>
                <td class="num">{{ f.margen }}%</td>
              </tr>
            </tbody>
          </table>
          <small class="r-nota">Los servicios no tienen costo registrado, por eso se consideran 100% ganancia (sin descontar mano de obra).</small>
          <h2 style="margin-top: 1rem">IVA</h2>
          <table class="d-tabla">
            <tbody>
              <tr><td>Ventas netas</td><td class="num">{{ clp(datos.kpis.ventasNetas) }}</td></tr>
              <tr><td>IVA contenido</td><td class="num">{{ clp(datos.kpis.iva) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="d-dos">
        <div class="d-card d-scroll">
          <h2>Órdenes más rentables</h2>
          <table class="d-tabla">
            <thead>
              <tr><th>Orden</th><th>Vehículo</th><th class="num">Total</th><th class="num">Ganancia</th><th class="num">Margen</th></tr>
            </thead>
            <tbody>
              <tr v-for="o in datos.topOrdenes" :key="o.id">
                <td>#{{ o.id }}</td>
                <td>{{ o.patente ?? '—' }}<br /><small>{{ o.cliente }}</small></td>
                <td class="num">{{ clp(o.total) }}</td>
                <td class="num d-pos">{{ clp(o.ganancia) }}</td>
                <td class="num">{{ o.margen }}%</td>
              </tr>
              <tr v-if="!datos.topOrdenes.length"><td colspan="5" class="d-vacio">Sin órdenes</td></tr>
            </tbody>
          </table>
        </div>
        <div class="d-card d-scroll">
          <h2>Órdenes con menor margen (con productos)</h2>
          <table class="d-tabla">
            <thead>
              <tr><th>Orden</th><th>Vehículo</th><th class="num">Total</th><th class="num">Costo</th><th class="num">Margen</th></tr>
            </thead>
            <tbody>
              <tr v-for="o in datos.margenBajo" :key="o.id">
                <td>#{{ o.id }}</td>
                <td>{{ o.patente ?? '—' }}</td>
                <td class="num">{{ clp(o.total) }}</td>
                <td class="num">{{ clp(o.costo) }}</td>
                <td class="num d-neg">{{ o.margen }}%</td>
              </tr>
              <tr v-if="!datos.margenBajo.length"><td colspan="5" class="d-vacio">Sin datos</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ===== SERVICIOS ===== -->
    <template v-if="datos && tab === 'servicios'">
      <div class="d-kpis">
        <div class="d-kpi"><span>Facturado en servicios</span><strong>{{ clp(datos.total) }}</strong></div>
        <div class="d-kpi"><span>Servicios realizados</span><strong>{{ datos.unidades }}</strong></div>
        <div class="d-kpi">
          <span>Más vendido</span><strong>{{ datos.ranking[0]?.nombre ?? '—' }}</strong>
        </div>
      </div>
      <div class="d-card d-scroll">
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Servicio</th><th class="num">Cant.</th><th class="num">Órdenes</th>
              <th class="num">Precio prom.</th><th class="num">Monto</th><th>Participación</th><th class="num">vs anterior</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in datos.ranking" :key="s.id">
              <td>{{ s.nombre }}</td>
              <td class="num">{{ s.cantidad }}</td>
              <td class="num">{{ s.ordenes }}</td>
              <td class="num">{{ clp(s.precioPromedio) }}</td>
              <td class="num">{{ clp(s.monto) }}</td>
              <td>
                <div class="r-prog"><div :style="{ width: s.participacion + '%' }"></div></div>
                <small>{{ s.participacion }}%</small>
              </td>
              <td class="num" :class="delta(s.variacion).clase">
                {{ s.variacion === null ? '—' : (s.variacion > 0 ? '+' : '') + s.variacion + '%' }}
              </td>
            </tr>
            <tr v-if="!datos.ranking.length"><td colspan="7" class="d-vacio">Sin servicios en el período</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== PRODUCTOS ===== -->
    <template v-if="datos && tab === 'productos'">
      <div class="d-kpis">
        <div class="d-kpi"><span>Ventas de productos</span><strong>{{ clp(datos.totales.monto) }}</strong></div>
        <div class="d-kpi"><span>Ganancia en productos</span><strong>{{ clp(datos.totales.ganancia) }}</strong></div>
        <div class="d-kpi"><span>Unidades vendidas</span><strong>{{ datos.totales.unidades }}</strong></div>
        <div class="d-kpi warn">
          <span>Capital sin rotación</span><strong>{{ clp(datos.capitalInmovilizado) }}</strong>
          <small>{{ datos.sinMovimiento.length }} productos sin ventas</small>
        </div>
      </div>

      <div class="d-card d-scroll">
        <h2>Ranking de productos</h2>
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Producto</th><th>Categoría</th><th class="num">Unid.</th><th class="num">Ventas</th>
              <th class="num">Costo</th><th class="num">Ganancia</th><th class="num">Margen</th><th class="num">vs anterior</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in datos.ranking" :key="p.id">
              <td>{{ p.nombre }}</td>
              <td>{{ p.categoria }}</td>
              <td class="num">{{ p.cantidad }}</td>
              <td class="num">{{ clp(p.monto) }}</td>
              <td class="num">{{ clp(p.costo) }}</td>
              <td class="num d-pos">{{ clp(p.ganancia) }}</td>
              <td class="num">{{ p.margen }}%</td>
              <td class="num" :class="delta(p.variacion).clase">
                {{ p.variacion === null ? '—' : (p.variacion > 0 ? '+' : '') + p.variacion + '%' }}
              </td>
            </tr>
            <tr v-if="!datos.ranking.length"><td colspan="8" class="d-vacio">Sin ventas de productos</td></tr>
          </tbody>
        </table>
      </div>

      <div class="d-dos">
        <div class="d-card">
          <h2>Por categoría</h2>
          <table class="d-tabla">
            <thead><tr><th>Categoría</th><th class="num">Unid.</th><th class="num">Ventas</th><th class="num">Ganancia</th></tr></thead>
            <tbody>
              <tr v-for="c in datos.porCategoria" :key="c.categoria">
                <td>{{ c.categoria }}</td><td class="num">{{ c.cantidad }}</td>
                <td class="num">{{ clp(c.monto) }}</td><td class="num">{{ clp(c.ganancia) }}</td>
              </tr>
              <tr v-if="!datos.porCategoria.length"><td colspan="4" class="d-vacio">Sin datos</td></tr>
            </tbody>
          </table>
        </div>
        <div class="d-card">
          <h2>Stock bajo ({{ datos.stockBajo.length }})</h2>
          <table class="d-tabla">
            <thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th></tr></thead>
            <tbody>
              <tr v-for="p in datos.stockBajo" :key="p.id">
                <td>{{ p.nombre }}</td><td class="num d-neg">{{ p.stockActual }}</td><td class="num">{{ p.stockMinimo }}</td>
              </tr>
              <tr v-if="!datos.stockBajo.length"><td colspan="3" class="d-vacio">Todo en orden</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="d-card d-scroll">
        <h2>Sin ventas en el período (stock parado)</h2>
        <table class="d-tabla">
          <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Stock</th><th class="num">Valor a costo</th></tr></thead>
          <tbody>
            <tr v-for="p in datos.sinMovimiento" :key="p.id">
              <td>{{ p.nombre }}</td><td>{{ p.categoria }}</td>
              <td class="num">{{ p.stockActual }}</td><td class="num">{{ clp(p.valorCosto) }}</td>
            </tr>
            <tr v-if="!datos.sinMovimiento.length"><td colspan="4" class="d-vacio">Todo el stock tuvo rotación</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== ROTACIÓN ===== -->
    <template v-if="datos && tab === 'rotacion'">
      <div class="d-kpis">
        <div class="d-kpi">
          <span>Valor del inventario (costo)</span><strong>{{ clp(datos.resumen.valorInventario) }}</strong>
          <small>{{ datos.resumen.productos }} productos activos</small>
        </div>
        <div class="d-kpi">
          <span>Rotación del inventario</span><strong>{{ datos.resumen.rotacionGlobal }}x</strong>
          <small>costo vendido / valor del stock en {{ datos.dias }} días</small>
        </div>
        <div class="d-kpi">
          <span>Rotación promedio</span><strong>{{ datos.resumen.rotacionPromedio }}x</strong>
          <small>de productos con ventas</small>
        </div>
        <div class="d-kpi warn">
          <span>Capital sin rotación</span><strong>{{ clp(datos.resumen.capitalInmovilizado) }}</strong>
          <small>{{ datos.resumen.conteo.SIN_MOVIMIENTO }} productos sin ventas</small>
        </div>
        <div class="d-kpi warn">
          <span>Por reponer</span><strong>{{ datos.resumen.porReponer }}</strong>
          <small>{{ datos.resumen.conteo.AGOTADO }} agotados</small>
        </div>
      </div>

      <div class="d-card">
        <h2>Clasificación</h2>
        <div class="d-chips">
          <span v-for="(n, c) in datos.resumen.conteo" :key="c" class="d-chip">
            <span class="r-cl" :class="`r-cl-${c}`">{{ CLASES[c] }}</span> {{ n }}
          </span>
        </div>
        <small class="r-nota">Alta: stock para 30 días o menos · Media: 31-90 días · Baja: más de 90 días. Rotación = unidades vendidas / stock promedio del período.</small>
      </div>

      <div class="d-card d-scroll">
        <h2>Detalle por producto</h2>
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Producto</th><th>Categoría</th><th class="num">Stock</th><th class="num">Vendidas</th>
              <th class="num">Rotación</th><th class="num">Cobertura</th><th>Clase</th>
              <th class="num">Reponer</th><th class="num">Valor stock</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in datos.productos" :key="p.id">
              <td>{{ p.nombre }}</td>
              <td>{{ p.categoria }}</td>
              <td class="num" :class="{ 'd-neg': p.stockActual <= p.stockMinimo }">{{ p.stockActual }}</td>
              <td class="num">{{ p.vendidas }}</td>
              <td class="num">{{ p.rotacion }}x</td>
              <td class="num">{{ p.cobertura === null ? '—' : p.cobertura + ' d' }}</td>
              <td><span class="r-cl" :class="`r-cl-${p.clase}`">{{ CLASES[p.clase] }}</span></td>
              <td class="num"><b v-if="p.reponer">{{ p.reponer }}</b><span v-else>—</span></td>
              <td class="num">{{ clp(p.valorStock) }}</td>
            </tr>
            <tr v-if="!datos.productos.length"><td colspan="9" class="d-vacio">Sin productos</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== CLIENTES ===== -->
    <template v-if="datos && tab === 'clientes'">
      <div class="d-kpis">
        <div class="d-kpi"><span>Clientes activos</span><strong>{{ datos.resumen.activos }}</strong><small>con órdenes en el período</small></div>
        <div class="d-kpi"><span>Clientes nuevos</span><strong>{{ datos.resumen.nuevos }}</strong><small>registrados en el período</small></div>
        <div class="d-kpi"><span>Recurrentes</span><strong>{{ datos.resumen.recurrentes }}</strong><small>{{ datos.resumen.tasaRecurrencia }}% (2+ órdenes)</small></div>
        <div class="d-kpi"><span>Gasto promedio</span><strong>{{ clp(datos.resumen.gastoPromedio) }}</strong></div>
        <div class="d-kpi warn"><span>Saldo pendiente</span><strong>{{ clp(datos.resumen.saldoPendiente) }}</strong></div>
      </div>
      <div class="d-card d-scroll">
        <h2>Mejores clientes</h2>
        <table class="d-tabla">
          <thead>
            <tr>
              <th>Cliente</th><th>RUT</th><th class="num">Órdenes</th><th class="num">Autos</th>
              <th class="num">Total</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Última visita</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in datos.ranking" :key="c.id">
              <td>{{ c.nombre }}</td>
              <td>{{ c.rut ?? '—' }}</td>
              <td class="num">{{ c.ordenes }}</td>
              <td class="num">{{ c.vehiculos }}</td>
              <td class="num">{{ clp(c.total) }}</td>
              <td class="num d-pos">{{ clp(c.pagado) }}</td>
              <td class="num d-neg">{{ clp(c.saldo) }}</td>
              <td>{{ fecha(c.ultimaVisita) }}</td>
            </tr>
            <tr v-if="!datos.ranking.length"><td colspan="8" class="d-vacio">Sin clientes en el período</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== GENERAL ===== -->
    <template v-if="datos && tab === 'general'">
      <div class="d-kpis">
        <div class="d-kpi"><span>Órdenes</span><strong>{{ datos.ordenes.total }}</strong><small>{{ datos.ordenes.entregadas }} entregadas</small></div>
        <div class="d-kpi">
          <span>Tiempo promedio de entrega</span>
          <strong>{{ datos.ordenes.tiempoPromedioHoras === null ? '—' : datos.ordenes.tiempoPromedioHoras + ' h' }}</strong>
        </div>
        <div class="d-kpi"><span>Cancelaciones</span><strong>{{ pct(datos.ordenes.tasaCancelacion) }}</strong></div>
        <div class="d-kpi"><span>Cobrado</span><strong>{{ clp(datos.pagos.cobrado) }}</strong><small>{{ datos.pagos.cantidad }} pagos</small></div>
        <div class="d-kpi"><span>Clientes nuevos</span><strong>{{ datos.clientesNuevos }}</strong></div>
        <div class="d-kpi">
          <span>Aprobación de presupuestos</span><strong>{{ pct(datos.presupuestos.tasaAprobacion) }}</strong>
          <small>{{ datos.presupuestos.total }} emitidos · {{ clp(datos.presupuestos.montoCotizado) }}</small>
        </div>
      </div>

      <div class="d-dos">
        <div class="d-card">
          <h2>Órdenes por estado</h2>
          <table class="d-tabla">
            <tbody>
              <tr v-for="(e, k) in ESTADOS_ORDEN" :key="k">
                <td>{{ e }}</td><td class="num">{{ datos.ordenes.porEstado[k] ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="d-card">
          <h2>Pagos por método</h2>
          <table class="d-tabla">
            <tbody>
              <tr v-for="m in datos.pagos.porMetodo" :key="m.metodo">
                <td>{{ METODOS[m.metodo] ?? m.metodo }} <small>({{ m.cantidad }})</small></td>
                <td class="num">{{ clp(m.monto) }}</td>
              </tr>
              <tr v-if="!datos.pagos.porMetodo.length"><td class="d-vacio">Sin pagos</td></tr>
            </tbody>
          </table>
        </div>
        <div class="d-card">
          <h2>Presupuestos</h2>
          <table class="d-tabla">
            <tbody>
              <tr v-for="(n, e) in datos.presupuestos.porEstado" :key="e"><td>{{ e }}</td><td class="num">{{ n }}</td></tr>
              <tr class="total"><td>Convertidos en orden</td><td class="num">{{ pct(datos.presupuestos.tasaConversion) }}</td></tr>
              <tr v-if="!datos.presupuestos.total"><td class="d-vacio">Sin presupuestos</td></tr>
            </tbody>
          </table>
        </div>
        <div class="d-card">
          <h2>Inventario</h2>
          <table class="d-tabla">
            <tbody>
              <tr><td>Valor a costo</td><td class="num">{{ clp(datos.inventario.valorCosto) }}</td></tr>
              <tr><td>Valor a precio de venta</td><td class="num">{{ clp(datos.inventario.valorVenta) }}</td></tr>
              <tr><td>Con stock bajo</td><td class="num">{{ datos.inventario.stockBajo }}</td></tr>
              <tr><td>Agotados</td><td class="num">{{ datos.inventario.agotados }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="d-card d-scroll">
        <h2>Rendimiento del personal</h2>
        <table class="d-tabla">
          <thead>
            <tr><th>Trabajador</th><th class="num">Órdenes</th><th class="num">Entregadas</th><th class="num">Ventas</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in datos.personal" :key="p.id">
              <td>{{ p.nombre }}</td>
              <td class="num">{{ p.ordenes }}</td>
              <td class="num">{{ p.entregadas }}</td>
              <td class="num">{{ clp(p.ventas) }}</td>
            </tr>
            <tr v-if="!datos.personal.length"><td colspan="4" class="d-vacio">Sin órdenes en el período</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.r-tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; flex-wrap: wrap; }
.r-tabs button {
  padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: #fff;
  border-radius: 6px; cursor: pointer; font: inherit;
}
.r-tabs button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
.r-sube { color: #15803d; }
.r-baja { color: #b91c1c; }
.d-kpi small { color: #6b7280; }
.d-kpi small.r-sube { color: #15803d; }
.d-kpi small.r-baja { color: #b91c1c; }
.r-barras { display: flex; align-items: flex-end; gap: 4px; height: 180px; overflow-x: auto; }
.r-barra { flex: 1; min-width: 24px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
.r-col { width: 100%; background: #93c5fd; border-radius: 4px 4px 0 0; min-height: 2px; display: flex; align-items: flex-end; }
.r-gan { width: 100%; background: #2563eb; border-radius: 4px 4px 0 0; }
.r-barra small { font-size: 0.65rem; color: #6b7280; }
.r-leyenda { display: block; margin-top: 0.5rem; color: #6b7280; }
.r-leyenda i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 0.25rem 0 0.75rem; }
.r-c1 { background: #93c5fd; }
.r-c2 { background: #2563eb; }
.r-prog { width: 120px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.r-prog div { height: 100%; background: #2563eb; }
.r-nota { display: block; margin-top: 0.5rem; color: #6b7280; }
.r-cl { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
.r-cl-ALTA { background: #dcfce7; color: #166534; }
.r-cl-MEDIA { background: #fef3c7; color: #92400e; }
.r-cl-BAJA { background: #ffedd5; color: #9a3412; }
.r-cl-SIN_MOVIMIENTO { background: #fee2e2; color: #991b1b; }
.r-cl-AGOTADO { background: #e5e7eb; color: #374151; }
.total td { font-weight: 700; border-top: 2px solid #e5e7eb; }
</style>