<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ordenesApi, serviciosApi, productosApi, mensajeError } from '@/services/api'
import { formatearFecha, formatearPesos } from '@/utils/validaciones'
import { ESTADOS, ESTADOS_CERRADOS, fechaHora, nombreUsuario } from '@/utils/ordenes'
import EstadoBadge from '@/components/EstadoBadge.vue'

const props = defineProps({ id: { type: String, required: true } })

const orden = ref(null)
const cargando = ref(true)
const error = ref('')
const accionando = ref(false)

const catalogoServicios = ref([])
const catalogoProductos = ref([])
const nuevoEstado = ref('')
const selServicio = ref('')
const cantServicio = ref(1)
const selProducto = ref('')
const cantProducto = ref(1)

const cerrada = computed(() => ESTADOS_CERRADOS.includes(orden.value?.estado))
const estadosDisponibles = computed(() => ESTADOS.filter((e) => e.valor !== orden.value?.estado))

async function cargarCatalogos() {
  try {
    const [srv, prod] = await Promise.all([
      serviciosApi.listar(true),
      productosApi.listar({ activos: true })
    ])
    catalogoServicios.value = srv
    catalogoProductos.value = prod
  } catch (e) {
    // los catálogos solo se usan para agregar ítems
  }
}

async function ejecutar(fn, fallo) {
  accionando.value = true
  error.value = ''
  try {
    orden.value = await fn()
    if (!cerrada.value) await cargarCatalogos()
  } catch (e) {
    error.value = mensajeError(e, fallo)
  } finally {
    accionando.value = false
  }
}

function cambiarEstado() {
  if (!nuevoEstado.value) return
  if (
    nuevoEstado.value === 'CANCELADO' &&
    !window.confirm('¿Cancelar la orden? Se devolverá el stock de los productos.')
  ) {
    return
  }
  if (
    nuevoEstado.value === 'ENTREGADO' &&
    !window.confirm('Al marcar la orden como entregada ya no podrá modificarse. ¿Continuar?')
  ) {
    return
  }
  ejecutar(() => ordenesApi.cambiarEstado(props.id, nuevoEstado.value), 'No se pudo cambiar el estado')
  nuevoEstado.value = ''
}

function agregarServicio() {
  if (!selServicio.value) return
  ejecutar(
    () =>
      ordenesApi.agregarServicio(props.id, {
        servicioId: selServicio.value,
        cantidad: Number(cantServicio.value) || 1
      }),
    'No se pudo agregar el servicio'
  )
  selServicio.value = ''
  cantServicio.value = 1
}

function agregarProducto() {
  if (!selProducto.value) return
  ejecutar(
    () =>
      ordenesApi.agregarProducto(props.id, {
        productoId: selProducto.value,
        cantidad: Number(cantProducto.value) || 1
      }),
    'No se pudo agregar el producto'
  )
  selProducto.value = ''
  cantProducto.value = 1
}

onMounted(async () => {
  try {
    orden.value = await ordenesApi.obtener(props.id)
    if (!cerrada.value) await cargarCatalogos()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar la orden')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <RouterLink to="/ordenes" class="volver">← Volver a órdenes</RouterLink>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="!orden" class="alerta alerta-error">{{ error }}</p>

  <template v-else>
    <div class="encabezado">
      <div>
        <h1>
          Orden #{{ orden.id }}
          <EstadoBadge :estado="orden.estado" />
        </h1>
        <p class="subtitulo">
          <span class="patente">{{ orden.vehiculo.patente }}</span>
          {{ orden.vehiculo.marca }} {{ orden.vehiculo.modelo }}
          <template v-if="orden.vehiculo.cliente">
            ·
            <RouterLink :to="`/clientes/${orden.vehiculo.cliente.id}`">
              {{ orden.vehiculo.cliente.nombre }}
            </RouterLink>
          </template>
        </p>
      </div>
      <RouterLink :to="`/vehiculos/${orden.vehiculo.id}/historial`" class="btn btn-secundario">
        Historial del vehículo
      </RouterLink>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="card">
      <h2>Datos de la orden</h2>
      <dl class="datos">
        <div>
          <dt>Ingreso</dt>
          <dd>{{ fechaHora(orden.fechaIngreso) }}</dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>{{ orden.fechaEntrega ? fechaHora(orden.fechaEntrega) : '—' }}</dd>
        </div>
        <div>
          <dt>Km de ingreso</dt>
          <dd>{{ orden.kmIngreso ? `${orden.kmIngreso.toLocaleString('es-CL')} km` : '—' }}</dd>
        </div>
        <div>
          <dt>Registrada por</dt>
          <dd>{{ nombreUsuario(orden.usuario) }}</dd>
        </div>
        <div>
          <dt>Observaciones</dt>
          <dd>{{ orden.observaciones || '—' }}</dd>
        </div>
      </dl>

      <div v-if="!cerrada" class="agregar">
        <select v-model="nuevoEstado">
          <option value="">Cambiar estado a...</option>
          <option v-for="e in estadosDisponibles" :key="e.valor" :value="e.valor">
            {{ e.texto }}
          </option>
        </select>
        <button
          type="button"
          class="btn btn-primario"
          :disabled="accionando || !nuevoEstado"
          @click="cambiarEstado"
        >
          Actualizar estado
        </button>
      </div>
      <p v-else class="desc">Esta orden está cerrada y no admite cambios.</p>
    </div>

    <div class="card">
      <h2>Trabajos realizados</h2>
      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!orden.ordenServicios.length">
              <td colspan="4" class="vacio">Sin servicios registrados</td>
            </tr>
            <tr v-for="s in orden.ordenServicios" :key="s.id">
              <td>{{ s.servicio?.nombre }}</td>
              <td>{{ s.cantidad }}</td>
              <td>{{ formatearPesos(s.precioUnitario) }}</td>
              <td>{{ formatearPesos(s.cantidad * s.precioUnitario) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!cerrada" class="agregar">
        <select v-model="selServicio">
          <option value="">Agregar servicio...</option>
          <option v-for="s in catalogoServicios" :key="s.id" :value="s.id">
            {{ s.nombre }} — {{ formatearPesos(s.precioBase) }}
          </option>
        </select>
        <input v-model.number="cantServicio" type="number" min="1" class="num" />
        <button
          type="button"
          class="btn btn-secundario"
          :disabled="accionando || !selServicio"
          @click="agregarServicio"
        >
          Agregar
        </button>
      </div>
    </div>

    <div class="card">
      <h2>Productos utilizados</h2>
      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!orden.ordenProductos.length">
              <td colspan="4" class="vacio">Sin productos registrados</td>
            </tr>
            <tr v-for="p in orden.ordenProductos" :key="p.id">
              <td>{{ p.producto?.nombre }}</td>
              <td>{{ p.cantidad }}</td>
              <td>{{ formatearPesos(p.precioUnitario) }}</td>
              <td>{{ formatearPesos(p.cantidad * p.precioUnitario) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!cerrada" class="agregar">
        <select v-model="selProducto">
          <option value="">Agregar producto...</option>
          <option
            v-for="p in catalogoProductos"
            :key="p.id"
            :value="p.id"
            :disabled="p.stockActual < 1"
          >
            {{ p.nombre }} — {{ formatearPesos(p.precioVenta) }} (stock: {{ p.stockActual }})
          </option>
        </select>
        <input v-model.number="cantProducto" type="number" min="1" class="num" />
        <button
          type="button"
          class="btn btn-secundario"
          :disabled="accionando || !selProducto"
          @click="agregarProducto"
        >
          Agregar
        </button>
      </div>

      <p class="total">Total: {{ formatearPesos(orden.total) }}</p>
    </div>

    <div class="card">
      <h2>Seguimiento de estados</h2>
      <ol class="historial">
        <li v-for="h in orden.estadosHistorial" :key="h.id">
          <EstadoBadge :estado="h.estado" />
          <span class="desc">
            {{ fechaHora(h.fecha) }} · {{ nombreUsuario(h.usuario) }}
          </span>
        </li>
      </ol>
      <small class="desc">Ingresó el {{ formatearFecha(orden.fechaIngreso) }}</small>
    </div>
  </template>
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
.agregar {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.agregar select {
  flex: 1;
  min-width: 200px;
}
.num {
  width: 80px;
}
.total {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 1rem 0 0;
  text-align: right;
}
.historial {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}
.historial li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}
</style>