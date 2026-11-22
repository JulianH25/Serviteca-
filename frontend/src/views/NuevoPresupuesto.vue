<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  vehiculosApi,
  serviciosApi,
  productosApi,
  presupuestosApi,
  mensajeError
} from '@/services/api'
import { formatearPesos, formatearFecha } from '@/utils/validaciones'
import { desglosarIva, totalLineas } from '@/utils/presupuestos'

const route = useRoute()
const router = useRouter()

const error = ref('')
const enviando = ref(false)

// ---------- 1. Vehículo ----------
const vehiculo = ref(null)
const busqueda = ref('')
const resultados = ref([])
const buscando = ref(false)

let timer
watch(busqueda, () => {
  clearTimeout(timer)
  const q = busqueda.value.trim()
  if (!q) {
    resultados.value = []
    return
  }
  timer = setTimeout(async () => {
    buscando.value = true
    try {
      resultados.value = (await vehiculosApi.listar(q)).slice(0, 8)
    } catch (e) {
      error.value = mensajeError(e, 'No se pudo buscar el vehículo')
    } finally {
      buscando.value = false
    }
  }, 300)
})

function elegirVehiculo(v) {
  vehiculo.value = v
  busqueda.value = ''
  resultados.value = []
}

// ---------- 2. Detalle ----------
const catalogoServicios = ref([])
const catalogoProductos = ref([])
const selServicio = ref('')
const selProducto = ref('')
const lineas = ref([])

function agregarServicio() {
  const s = catalogoServicios.value.find((x) => x.id === selServicio.value)
  if (!s) return
  const existente = lineas.value.find((l) => l.servicioId === s.id)
  if (existente) existente.cantidad++
  else {
    lineas.value.push({
      tipo: 'Servicio',
      servicioId: s.id,
      productoId: null,
      descripcion: s.nombre,
      cantidad: 1,
      precioUnitario: s.precioBase
    })
  }
  selServicio.value = ''
}

function agregarProducto() {
  const p = catalogoProductos.value.find((x) => x.id === selProducto.value)
  if (!p) return
  const existente = lineas.value.find((l) => l.productoId === p.id)
  if (existente) existente.cantidad++
  else {
    lineas.value.push({
      tipo: 'Producto',
      servicioId: null,
      productoId: p.id,
      descripcion: p.nombre,
      stock: p.stockActual,
      cantidad: 1,
      precioUnitario: p.precioVenta
    })
  }
  selProducto.value = ''
}

const subtotal = (l) => (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0)

// ---------- 3. Totales ----------
const validezDias = ref(15)
const montos = computed(() => desglosarIva(totalLineas(lineas.value)))

const vence = computed(() => {
  const f = new Date()
  f.setDate(f.getDate() + Number(validezDias.value))
  return f
})

const problema = computed(() => {
  if (!vehiculo.value) return 'Selecciona el vehículo a cotizar'
  if (!lineas.value.length) return 'Agrega al menos un servicio o producto'
  for (const l of lineas.value) {
    if (!Number.isInteger(Number(l.cantidad)) || Number(l.cantidad) < 1) {
      return `Cantidad inválida en ${l.descripcion}`
    }
    if (l.precioUnitario === '' || !Number.isInteger(Number(l.precioUnitario)) || Number(l.precioUnitario) < 0) {
      return `Precio inválido en ${l.descripcion}`
    }
  }
  return ''
})

// Si el usuario corrige lo que faltaba, el mensaje de error anterior se borra
watch([vehiculo, lineas], () => (error.value = ''), { deep: true })

async function guardar() {
  if (problema.value) {
    error.value = problema.value
    return
  }
  enviando.value = true
  error.value = ''
  try {
    const p = await presupuestosApi.crear({
      vehiculoId: vehiculo.value.id,
      validezDias: Number(validezDias.value),
      detalle: lineas.value.map((l) => ({
        servicioId: l.servicioId,
        productoId: l.productoId,
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario)
      }))
    })
    router.push(`/presupuestos/${p.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo crear el presupuesto')
  } finally {
    enviando.value = false
  }
}

onMounted(async () => {
  try {
    const [srv, prod] = await Promise.all([
      serviciosApi.listar(true),
      productosApi.listar({ activos: true })
    ])
    catalogoServicios.value = srv
    catalogoProductos.value = prod
    if (route.query.vehiculoId) {
      elegirVehiculo(await vehiculosApi.historial(route.query.vehiculoId))
    }
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los datos')
  }
})
</script>

<template>
  <RouterLink to="/presupuestos" class="volver">← Volver a presupuestos</RouterLink>
  <h1>Nuevo presupuesto</h1>
  <p class="subtitulo">Cotiza los trabajos antes de abrir la orden. No descuenta stock.</p>

  <form novalidate @submit.prevent="guardar">
    <div class="card">
      <h2>1. Vehículo</h2>

      <div v-if="vehiculo" class="elegido">
        <div>
          <span class="patente">{{ vehiculo.patente }}</span>
          <strong>{{ vehiculo.marca }} {{ vehiculo.modelo }}</strong>
          <small v-if="vehiculo.cliente" class="desc"> · {{ vehiculo.cliente.nombre }}</small>
        </div>
        <button type="button" class="btn btn-secundario" @click="vehiculo = null">Cambiar</button>
      </div>

      <template v-else>
        <input
          v-model="busqueda"
          class="buscador"
          placeholder="Buscar por patente, marca, RUT o nombre del dueño..."
          aria-label="Buscar vehículo"
        />
        <p v-if="buscando" class="desc">Buscando...</p>
        <ul v-if="resultados.length" class="resultados">
          <li v-for="v in resultados" :key="v.id">
            <button type="button" @click="elegirVehiculo(v)">
              <span class="patente">{{ v.patente }}</span>
              {{ v.marca }} {{ v.modelo }}
              <small class="desc">· {{ v.cliente?.nombre }}</small>
            </button>
          </li>
        </ul>
        <p v-else-if="busqueda.trim() && !buscando" class="desc">
          No se encontró. <RouterLink to="/vehiculos/nuevo">Registrar vehículo</RouterLink>
        </p>
      </template>
    </div>

    <div class="card">
      <h2>2. Trabajos y repuestos</h2>
      <div class="agregar">
        <select v-model="selServicio" aria-label="Servicio">
          <option value="">Agregar servicio...</option>
          <option v-for="s in catalogoServicios" :key="s.id" :value="s.id">
            {{ s.nombre }} — {{ formatearPesos(s.precioBase) }}
          </option>
        </select>
        <button type="button" class="btn btn-secundario" :disabled="!selServicio" @click="agregarServicio">
          Agregar
        </button>
      </div>
      <div class="agregar">
        <select v-model="selProducto" aria-label="Producto">
          <option value="">Agregar producto...</option>
          <option v-for="p in catalogoProductos" :key="p.id" :value="p.id">
            {{ p.nombre }} — {{ formatearPesos(p.precioVenta) }} (stock: {{ p.stockActual }})
          </option>
        </select>
        <button type="button" class="btn btn-secundario" :disabled="!selProducto" @click="agregarProducto">
          Agregar
        </button>
      </div>

      <div v-if="lineas.length" class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Detalle</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th class="der">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in lineas" :key="`${l.tipo}-${l.servicioId ?? l.productoId}`">
              <td>
                {{ l.descripcion }}
                <small class="desc tipo">{{ l.tipo }}</small>
                <small v-if="l.productoId && Number(l.cantidad) > l.stock" class="aviso">
                  Hoy hay {{ l.stock }} en bodega
                </small>
              </td>
              <td>
                <input v-model.number="l.cantidad" type="number" min="1" class="num" aria-label="Cantidad" />
              </td>
              <td>
                <input v-model.number="l.precioUnitario" type="number" min="0" class="num ancho" aria-label="Precio unitario" />
              </td>
              <td class="der">{{ formatearPesos(subtotal(l)) }}</td>
              <td><button type="button" class="quitar" @click="lineas.splice(i, 1)">Quitar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="vacio">Agrega los servicios y productos que quieres cotizar.</p>
    </div>

    <div class="card">
      <h2>3. Resumen</h2>
      <div class="resumen">
        <div class="campo validez">
          <label for="validez">Validez del presupuesto</label>
          <select id="validez" v-model.number="validezDias">
            <option :value="7">7 días</option>
            <option :value="15">15 días</option>
            <option :value="30">30 días</option>
          </select>
          <small>Vence el {{ formatearFecha(vence) }}</small>
        </div>

        <dl class="montos">
          <div><dt>Neto</dt><dd>{{ formatearPesos(montos.neto) }}</dd></div>
          <div><dt>IVA (19%)</dt><dd>{{ formatearPesos(montos.iva) }}</dd></div>
          <div class="final"><dt>Total</dt><dd>{{ formatearPesos(montos.total) }}</dd></div>
        </dl>
      </div>
      <small class="desc">Los precios del catálogo incluyen IVA; aquí se muestra el desglose.</small>

      <p v-if="error" class="alerta alerta-error">{{ error }}</p>
      <div class="acciones">
        <button type="submit" class="btn btn-primario" :disabled="enviando">
          {{ enviando ? 'Guardando...' : 'Crear presupuesto' }}
        </button>
        <button type="button" class="btn btn-secundario" @click="router.back()">Cancelar</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.volver {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.desc {
  color: var(--muted);
}
.elegido {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.resultados {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  max-width: 560px;
}
.resultados button {
  width: 100%;
  text-align: left;
  font: inherit;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 0.6rem 0.75rem;
  cursor: pointer;
}
.resultados li:last-child button {
  border-bottom: none;
}
.resultados button:hover {
  background: var(--bg);
}
.agregar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  max-width: 640px;
}
.agregar select {
  flex: 1;
  min-width: 0;
}
.num {
  width: 80px;
}
.num.ancho {
  width: 120px;
}
.der {
  text-align: right;
  white-space: nowrap;
}
.tipo {
  display: block;
  font-size: 0.75rem;
}
.aviso {
  display: block;
  color: #b45309;
  font-size: 0.8rem;
}
.quitar {
  background: none;
  border: none;
  color: var(--danger);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.resumen {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.validez {
  max-width: 220px;
}
.montos {
  margin: 0;
  min-width: 240px;
}
.montos div {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.3rem 0;
}
.montos dt {
  color: var(--muted);
}
.montos dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.montos .final {
  border-top: 1px solid var(--border);
  margin-top: 0.3rem;
  padding-top: 0.6rem;
  font-size: 1.3rem;
  font-weight: 700;
}
.montos .final dt {
  color: var(--text);
}
</style>
