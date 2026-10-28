<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  vehiculosApi,
  serviciosApi,
  productosApi,
  ordenesApi,
  mensajeError
} from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'

const route = useRoute()
const router = useRouter()

const vehiculo = ref(null)
const busqueda = ref('')
const resultados = ref([])
const buscando = ref(false)

const catalogoServicios = ref([])
const catalogoProductos = ref([])
const servicios = ref([])
const productos = ref([])
const selServicio = ref('')
const selProducto = ref('')

const form = reactive({ kmIngreso: '', observaciones: '' })
const enviando = ref(false)
const error = ref('')

// ---------- Vehículo ----------
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
  form.kmIngreso = v.kilometraje ?? ''
  busqueda.value = ''
  resultados.value = []
}

// ---------- Servicios y productos ----------
function agregarServicio() {
  if (!selServicio.value) return
  const s = catalogoServicios.value.find((x) => x.id === selServicio.value)
  if (!s) return
  const existente = servicios.value.find((l) => l.servicioId === s.id)
  if (existente) existente.cantidad++
  else {
    servicios.value.push({
      servicioId: s.id,
      nombre: s.nombre,
      cantidad: 1,
      precioUnitario: s.precioBase
    })
  }
  selServicio.value = ''
}

function agregarProducto() {
  if (!selProducto.value) return
  const p = catalogoProductos.value.find((x) => x.id === selProducto.value)
  if (!p) return
  const existente = productos.value.find((l) => l.productoId === p.id)
  if (existente) existente.cantidad++
  else {
    productos.value.push({
      productoId: p.id,
      nombre: p.nombre,
      stock: p.stockActual,
      cantidad: 1,
      precioUnitario: p.precioVenta
    })
  }
  selProducto.value = ''
}

const subtotal = (l) => (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0)
const total = computed(
  () =>
    servicios.value.reduce((s, l) => s + subtotal(l), 0) +
    productos.value.reduce((s, l) => s + subtotal(l), 0)
)

const problema = computed(() => {
  if (!vehiculo.value) return 'Selecciona un vehículo'
  if (!servicios.value.length) return 'Agrega al menos un servicio'
  const km = form.kmIngreso
  if (km !== '' && km !== null && (!Number.isInteger(Number(km)) || Number(km) < 0)) {
    return 'Kilometraje inválido'
  }
  for (const l of [...servicios.value, ...productos.value]) {
    if (!Number.isInteger(Number(l.cantidad)) || Number(l.cantidad) < 1) {
      return `Cantidad inválida en ${l.nombre}`
    }
    if (
      l.precioUnitario === '' ||
      !Number.isInteger(Number(l.precioUnitario)) ||
      Number(l.precioUnitario) < 0
    ) {
      return `Precio inválido en ${l.nombre}`
    }
  }
  for (const p of productos.value) {
    if (Number(p.cantidad) > p.stock) {
      return `Stock insuficiente de ${p.nombre} (disponible: ${p.stock})`
    }
  }
  return ''
})

async function guardar() {
  if (problema.value) {
    error.value = problema.value
    return
  }
  enviando.value = true
  error.value = ''
  try {
    const orden = await ordenesApi.crear({
      vehiculoId: vehiculo.value.id,
      kmIngreso: form.kmIngreso === '' ? null : Number(form.kmIngreso),
      observaciones: form.observaciones.trim(),
      servicios: servicios.value.map((l) => ({
        servicioId: l.servicioId,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario)
      })),
      productos: productos.value.map((l) => ({
        productoId: l.productoId,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario)
      }))
    })
    router.push(`/ordenes/${orden.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo crear la orden')
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
    error.value = mensajeError(e, 'No se pudieron cargar los datos de la orden')
  }
})
</script>

<template>
  <RouterLink to="/ordenes" class="volver">← Volver a órdenes</RouterLink>
  <h1>Nueva orden de trabajo</h1>
  <p class="subtitulo">Los productos agregados descuentan stock al guardar la orden</p>

  <form novalidate @submit.prevent="guardar">
    <!-- Vehículo -->
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
          placeholder="Buscar por patente, marca, modelo, RUT o nombre del dueño..."
        />
        <p v-if="buscando" class="desc">Buscando...</p>
        <ul v-if="resultados.length" class="resultados">
          <li v-for="v in resultados" :key="v.id" @click="elegirVehiculo(v)">
            <span class="patente">{{ v.patente }}</span>
            {{ v.marca }} {{ v.modelo }}
            <small class="desc">· {{ v.cliente?.nombre }}</small>
          </li>
        </ul>
      </template>

      <div v-if="vehiculo" class="form-grid">
        <div class="campo">
          <label for="km">Kilometraje de ingreso</label>
          <input id="km" v-model="form.kmIngreso" type="number" min="0" />
        </div>
        <div class="campo">
          <label for="obs">Observaciones</label>
          <input id="obs" v-model="form.observaciones" placeholder="Falla reportada, detalles..." />
        </div>
      </div>
    </div>

    <!-- Servicios -->
    <div class="card">
      <h2>2. Servicios *</h2>
      <div class="agregar">
        <select v-model="selServicio">
          <option value="">Selecciona un servicio...</option>
          <option v-for="s in catalogoServicios" :key="s.id" :value="s.id">
            {{ s.nombre }} — {{ formatearPesos(s.precioBase) }}
          </option>
        </select>
        <button type="button" class="btn btn-secundario" @click="agregarServicio">Agregar</button>
      </div>

      <div v-if="servicios.length" class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in servicios" :key="l.servicioId">
              <td>{{ l.nombre }}</td>
              <td><input v-model.number="l.cantidad" type="number" min="1" class="num" /></td>
              <td>
                <input v-model.number="l.precioUnitario" type="number" min="0" class="num ancho" />
              </td>
              <td>{{ formatearPesos(subtotal(l)) }}</td>
              <td><a href="#" @click.prevent="servicios.splice(i, 1)">Quitar</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Productos -->
    <div class="card">
      <h2>3. Productos (opcional)</h2>
      <div class="agregar">
        <select v-model="selProducto">
          <option value="">Selecciona un producto...</option>
          <option
            v-for="p in catalogoProductos"
            :key="p.id"
            :value="p.id"
            :disabled="p.stockActual < 1"
          >
            {{ p.nombre }} — {{ formatearPesos(p.precioVenta) }} (stock: {{ p.stockActual }})
          </option>
        </select>
        <button type="button" class="btn btn-secundario" @click="agregarProducto">Agregar</button>
      </div>

      <div v-if="productos.length" class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in productos" :key="l.productoId">
              <td>
                {{ l.nombre }}
                <small class="desc">(stock: {{ l.stock }})</small>
              </td>
              <td>
                <input
                  v-model.number="l.cantidad"
                  type="number"
                  min="1"
                  :max="l.stock"
                  class="num"
                />
              </td>
              <td>
                <input v-model.number="l.precioUnitario" type="number" min="0" class="num ancho" />
              </td>
              <td>{{ formatearPesos(subtotal(l)) }}</td>
              <td><a href="#" @click.prevent="productos.splice(i, 1)">Quitar</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <p class="total">Total: {{ formatearPesos(total) }}</p>
      <p v-if="error" class="alerta alerta-error">{{ error }}</p>
      <div class="acciones">
        <button type="submit" class="btn btn-primario" :disabled="enviando">
          {{ enviando ? 'Guardando...' : 'Crear orden' }}
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
  margin-bottom: 1rem;
}
.resultados {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.resultados li {
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.resultados li:last-child {
  border-bottom: none;
}
.resultados li:hover {
  background: var(--bg);
}
.agregar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
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
.total {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 1rem;
}
</style>