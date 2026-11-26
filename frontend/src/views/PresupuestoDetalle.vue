<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { presupuestosApi, mensajeError } from '@/services/api'
import { formatearPesos, formatearFecha } from '@/utils/validaciones'
import { nombreUsuario } from '@/utils/ordenes'
import {
  desglosarIva,
  totalLineas,
  estadoPresupuesto,
  fechaLocal,
  fechaVencimiento
} from '@/utils/presupuestos'
import PresupuestoBadge from '@/components/PresupuestoBadge.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const presupuesto = ref(null)
const cargando = ref(true)
const error = ref('')
const exito = ref('')
const accionando = ref(false)

const estado = computed(() => (presupuesto.value ? estadoPresupuesto(presupuesto.value) : ''))

// El backend guarda subtotal (neto), IVA y total. Si por algún motivo vinieran en 0,
// se recalculan desde el detalle para no mostrar un documento vacío.
const montos = computed(() => {
  const p = presupuesto.value
  if (p.total) return { neto: p.subtotal, iva: p.iva, total: p.total }
  return desglosarIva(totalLineas(p.detalle))
})

async function cargar() {
  try {
    presupuesto.value = await presupuestosApi.obtener(props.id)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el presupuesto')
  } finally {
    cargando.value = false
  }
}

async function cambiarEstado(nuevo) {
  const texto = nuevo === 'APROBADO' ? 'aprobado' : 'rechazado'
  if (nuevo === 'RECHAZADO' && !window.confirm('¿Marcar el presupuesto como rechazado por el cliente?')) return
  accionando.value = true
  error.value = ''
  exito.value = ''
  try {
    await presupuestosApi.cambiarEstado(props.id, nuevo)
    exito.value = `Presupuesto marcado como ${texto}`
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cambiar el estado')
  } finally {
    accionando.value = false
  }
}

async function convertirEnOrden() {
  if (!window.confirm('Se creará una orden de trabajo con este detalle y se descontará el stock de los productos. ¿Continuar?')) return
  accionando.value = true
  error.value = ''
  try {
    const { ordenId } = await presupuestosApi.convertirEnOrden(props.id)
    router.push(`/ordenes/${ordenId}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo crear la orden')
    accionando.value = false
  }
}

function imprimir() {
  window.print()
}

onMounted(cargar)
</script>

<template>
  <RouterLink to="/presupuestos" class="volver no-imprimir">← Volver a presupuestos</RouterLink>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="!presupuesto" class="alerta alerta-error">{{ error }}</p>

  <template v-else>
    <div class="encabezado no-imprimir">
      <div>
        <h1>
          Presupuesto #{{ presupuesto.id }}
          <PresupuestoBadge :estado="estado" />
        </h1>
        <p class="subtitulo">
          Emitido el {{ formatearFecha(fechaLocal(presupuesto.fecha)) }} por
          {{ nombreUsuario(presupuesto.usuario) }}
        </p>
      </div>
      <div class="botones">
        <template v-if="estado === 'PENDIENTE'">
          <button class="btn btn-primario" :disabled="accionando" @click="cambiarEstado('APROBADO')">
            Cliente aprobó
          </button>
          <button class="btn btn-secundario" :disabled="accionando" @click="cambiarEstado('RECHAZADO')">
            Cliente rechazó
          </button>
        </template>
        <button
          v-if="estado === 'APROBADO' && !presupuesto.ordenId"
          class="btn btn-primario"
          :disabled="accionando"
          @click="convertirEnOrden"
        >
          Crear orden de trabajo
        </button>
        <RouterLink v-if="presupuesto.ordenId" :to="`/ordenes/${presupuesto.ordenId}`" class="btn btn-secundario">
          Ver orden #{{ presupuesto.ordenId }}
        </RouterLink>
        <button class="btn btn-secundario" @click="imprimir">Imprimir / PDF</button>
      </div>
    </div>

    <p v-if="estado === 'VENCIDO'" class="alerta alerta-aviso no-imprimir">
      Este presupuesto venció el {{ formatearFecha(fechaVencimiento(presupuesto)) }}.
      Si el cliente sigue interesado, crea uno nuevo con los precios actuales.
    </p>
    <p v-if="exito" class="alerta alerta-exito no-imprimir">{{ exito }}</p>
    <p v-if="error" class="alerta alerta-error no-imprimir">{{ error }}</p>

    <!-- Documento: es lo que sale al imprimir -->
    <article class="card documento">
      <header class="doc-cabecera">
        <div>
          <p class="doc-marca">Serviteca</p>
          <p class="desc">Presupuesto de servicios</p>
        </div>
        <div class="doc-numero">
          <strong>N° {{ presupuesto.id }}</strong>
          <span>Fecha: {{ formatearFecha(fechaLocal(presupuesto.fecha)) }}</span>
          <span>Válido hasta: {{ formatearFecha(fechaVencimiento(presupuesto)) }}</span>
        </div>
      </header>

      <dl class="datos doc-datos">
        <div>
          <dt>Cliente</dt>
          <dd>{{ presupuesto.vehiculo.cliente?.nombre ?? '—' }}</dd>
        </div>
        <div>
          <dt>RUT</dt>
          <dd>{{ presupuesto.vehiculo.cliente?.rut ?? '—' }}</dd>
        </div>
        <div>
          <dt>Vehículo</dt>
          <dd>
            <span class="patente">{{ presupuesto.vehiculo.patente }}</span>
            {{ presupuesto.vehiculo.marca }} {{ presupuesto.vehiculo.modelo }}
          </dd>
        </div>
      </dl>

      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Detalle</th>
              <th class="der">Cant.</th>
              <th class="der">Precio unit.</th>
              <th class="der">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in presupuesto.detalle" :key="d.id">
              <td>{{ d.descripcion }}</td>
              <td class="der">{{ d.cantidad }}</td>
              <td class="der">{{ formatearPesos(d.precioUnitario) }}</td>
              <td class="der">{{ formatearPesos(d.cantidad * d.precioUnitario) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="montos">
        <div><dt>Neto</dt><dd>{{ formatearPesos(montos.neto) }}</dd></div>
        <div><dt>IVA (19%)</dt><dd>{{ formatearPesos(montos.iva) }}</dd></div>
        <div class="final"><dt>Total</dt><dd>{{ formatearPesos(montos.total) }}</dd></div>
      </dl>

      <p class="doc-pie desc">
        Valores en pesos chilenos, IVA incluido. Precios sujetos a disponibilidad de repuestos.
      </p>
    </article>
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
.botones {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.alerta-aviso {
  background: #fff7ed;
  color: #9a3412;
}
.doc-cabecera {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 2px solid var(--text);
}
.doc-cabecera p {
  margin: 0;
}
.doc-marca {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--primary);
}
.doc-numero {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  font-size: 0.9rem;
}
.doc-numero strong {
  font-size: 1.1rem;
}
.doc-datos {
  margin-bottom: 1.25rem;
}
.der {
  text-align: right;
  white-space: nowrap;
}
.montos {
  margin: 1rem 0 0 auto;
  max-width: 300px;
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
  font-size: 1.25rem;
  font-weight: 700;
}
.montos .final dt {
  color: var(--text);
}
.doc-pie {
  margin: 1.5rem 0 0;
  font-size: 0.8rem;
}
@media (max-width: 600px) {
  .doc-numero {
    align-items: flex-start;
  }
}
</style>
