<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { pagosApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'
import { fechaHora, nombreUsuario } from '@/utils/ordenes'
import { METODOS_PAGO, etiquetaMetodo, resumenPagos, validarMonto } from '@/utils/presupuestos'

// Se usa dentro del detalle de la orden. Carga sus propios datos para no depender
// de que GET /ordenes/:id incluya los pagos.
const props = defineProps({
  ordenId: { type: [String, Number], required: true },
  estado: { type: String, required: true },
  totalOrden: { type: Number, default: 0 }
})

const pagos = ref([])
const totalBackend = ref(null)
const cargando = ref(true)
const error = ref('')
const exito = ref(null)

const monto = ref('')
const metodo = ref('EFECTIVO')
const guardando = ref(false)
const intento = ref(false)

const resumen = computed(() => resumenPagos(totalBackend.value ?? props.totalOrden, pagos.value))
const cancelada = computed(() => props.estado === 'CANCELADO')
const puedePagar = computed(() => !cancelada.value && resumen.value.saldo > 0)
const errorMonto = computed(() => validarMonto(monto.value, resumen.value.saldo))

async function cargar() {
  try {
    const data = await pagosApi.deOrden(props.ordenId)
    pagos.value = data.pagos ?? []
    totalBackend.value = typeof data.total === 'number' ? data.total : null
    if (monto.value === '') monto.value = resumen.value.saldo || ''
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los pagos')
  } finally {
    cargando.value = false
  }
}

async function registrar() {
  intento.value = true
  error.value = ''
  exito.value = null
  if (errorMonto.value) return
  guardando.value = true
  try {
    const pago = await pagosApi.registrar(props.ordenId, {
      monto: Number(monto.value),
      metodo: metodo.value
    })
    exito.value = pago
    intento.value = false
    monto.value = ''
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo registrar el pago')
  } finally {
    guardando.value = false
  }
}

// Si se agregan servicios o productos a la orden, el total cambia
watch(
  () => props.totalOrden,
  () => cargar()
)

onMounted(cargar)
</script>

<template>
  <div class="card">
    <div class="titulo">
      <h2>Pagos</h2>
      <span v-if="resumen.pagadoCompleto" class="etiqueta pagada">Pagada</span>
      <span v-else-if="resumen.pagado > 0" class="etiqueta parcial">Pago parcial</span>
    </div>

    <p v-if="cargando" class="desc">Cargando pagos...</p>

    <template v-else>
      <dl class="resumen">
        <div>
          <dt>Total de la orden</dt>
          <dd>{{ formatearPesos(resumen.total) }}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{{ formatearPesos(resumen.pagado) }}</dd>
        </div>
        <div>
          <dt>Saldo pendiente</dt>
          <dd :class="{ pendiente: resumen.saldo > 0 }">{{ formatearPesos(resumen.saldo) }}</dd>
        </div>
      </dl>

      <div v-if="pagos.length" class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Método</th>
              <th>Recibido por</th>
              <th>Comprobante</th>
              <th class="der">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pagos" :key="p.id">
              <td class="nowrap">{{ fechaHora(p.fecha) }}</td>
              <td>{{ etiquetaMetodo(p.metodo) }}</td>
              <td>{{ nombreUsuario(p.usuario) }}</td>
              <td>
                <RouterLink v-if="p.comprobante" :to="`/comprobantes/${p.comprobante.id}`">
                  {{ p.comprobante.numero }}
                </RouterLink>
                <span v-else class="desc">—</span>
              </td>
              <td class="der">{{ formatearPesos(p.monto) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="desc">Todavía no se registran pagos para esta orden.</p>

      <form v-if="puedePagar" class="registrar" novalidate @submit.prevent="registrar">
        <div class="campo">
          <label for="monto">Monto a pagar</label>
          <input
            id="monto"
            v-model.number="monto"
            type="number"
            min="1"
            :max="resumen.saldo"
            :class="{ invalido: intento && errorMonto }"
          />
          <small v-if="intento && errorMonto" class="error">{{ errorMonto }}</small>
          <small v-else>Puede ser un abono; el saldo queda pendiente</small>
        </div>
        <div class="campo">
          <label for="metodo">Método de pago</label>
          <select id="metodo" v-model="metodo">
            <option v-for="m in METODOS_PAGO" :key="m.valor" :value="m.valor">{{ m.texto }}</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primario" :disabled="guardando">
          {{ guardando ? 'Registrando...' : 'Registrar pago' }}
        </button>
      </form>
      <p v-else-if="cancelada" class="desc nota">La orden está cancelada: no se pueden registrar pagos.</p>
    </template>

    <p v-if="exito" class="alerta alerta-exito">
      Pago de {{ formatearPesos(exito.monto) }} registrado.
      <RouterLink v-if="exito.comprobante" :to="`/comprobantes/${exito.comprobante.id}`">
        Ver comprobante {{ exito.comprobante.numero }}
      </RouterLink>
    </p>
    <p v-if="error" class="alerta alerta-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.titulo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.titulo h2 {
  margin: 0;
}
.etiqueta {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
}
.pagada {
  background: #dcfce7;
  color: #166534;
}
.parcial {
  background: #fef3c7;
  color: #92400e;
}
.desc {
  color: var(--muted);
}
.resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin: 0 0 1.25rem;
}
.resumen dt {
  font-size: 0.8rem;
  color: var(--muted);
}
.resumen dd {
  margin: 0.2rem 0 0;
  font-size: 1.2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.resumen dd.pendiente {
  color: var(--primary-dark);
}
.nowrap {
  white-space: nowrap;
}
.der {
  text-align: right;
  white-space: nowrap;
}
.registrar {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
}
.registrar .campo {
  flex: 1;
  min-width: 180px;
}
.registrar .btn {
  margin-top: 1.55rem;
}
.nota {
  margin: 1rem 0 0;
}
</style>
