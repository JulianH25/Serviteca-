<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { vehiculosApi, mensajeError } from '@/services/api'
import { formatearFecha, formatearPesos } from '@/utils/validaciones'

const props = defineProps({ id: { type: String, required: true } })

const vehiculo = ref(null)
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    vehiculo.value = await vehiculosApi.historial(props.id)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el historial')
  } finally {
    cargando.value = false
  }
})

function totalOrden(orden) {
  const servicios = (orden.ordenServicios || []).reduce(
    (s, x) => s + x.cantidad * x.precioUnitario,
    0
  )
  const productos = (orden.ordenProductos || []).reduce(
    (s, x) => s + x.cantidad * x.precioUnitario,
    0
  )
  return servicios + productos
}
</script>

<template>
  <RouterLink to="/vehiculos" class="volver">← Volver a vehículos</RouterLink>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="error" class="alerta alerta-error">{{ error }}</p>

  <template v-else-if="vehiculo">
    <div class="encabezado">
      <div>
        <RouterLink :to="`/ordenes/nueva?vehiculoId=${vehiculo.id}`" class="btn btn-primario">
          + Nueva orden
        </RouterLink>
        <h1>
          <span class="patente">{{ vehiculo.patente }}</span>
          {{ vehiculo.marca }} {{ vehiculo.modelo }}
        </h1>
        <p class="subtitulo">
          Año {{ vehiculo.anio }} · Registrado el {{ formatearFecha(vehiculo.creadoEn) }}
          <template v-if="vehiculo.cliente">
            · Dueño:
            <RouterLink :to="`/clientes/${vehiculo.cliente.id}`">{{ vehiculo.cliente.nombre }}</RouterLink>
          </template>
        </p>
      </div>
    </div>

    <div class="card">
      <h2>Historial de servicios</h2>

      <p v-if="!vehiculo.ordenesTrabajo?.length" class="vacio">
        Este vehículo todavía no tiene servicios registrados.
      </p>

      <ol v-else class="linea-tiempo">
        <li v-for="o in vehiculo.ordenesTrabajo" :key="o.id">
          <div class="fecha">{{ formatearFecha(o.fechaIngreso) }}</div>
          <div class="detalle">
            <div class="fila-titulo">
              <strong>Orden #{{ o.id }}</strong>
              <span class="estado">{{ o.estado }}</span>
            </div>
            <ul class="servicios">
              <li v-for="s in o.ordenServicios" :key="s.id">
                {{ s.servicio?.nombre }}
                <span v-if="s.cantidad > 1">× {{ s.cantidad }}</span>
              </li>
            </ul>
            <small>
              <template v-if="o.kmIngreso">{{ o.kmIngreso.toLocaleString('es-CL') }} km · </template>
              Total {{ formatearPesos(totalOrden(o)) }}
            </small>
            <p v-if="o.observaciones" class="obs">{{ o.observaciones }}</p>
          </div>
        </li>
      </ol>
    </div>
  </template>
</template>

<style scoped>
.volver {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

h1 .patente {
  font-size: 1.1rem;
  vertical-align: middle;
  margin-right: 0.4rem;
}

.linea-tiempo {
  list-style: none;
  padding: 0;
  margin: 0;
}

.linea-tiempo > li {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.fecha {
  color: var(--muted);
  font-size: 0.9rem;
}

.fila-titulo {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.estado {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--bg);
}

.servicios {
  margin: 0.4rem 0;
  padding-left: 1.1rem;
}

.obs {
  color: var(--muted);
  font-style: italic;
  margin: 0.4rem 0 0;
}

@media (max-width: 600px) {
  .linea-tiempo > li {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>