<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { comprobantesApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'
import { fechaHora, nombreUsuario, totalLineas } from '@/utils/ordenes'
import { desglosarIva, etiquetaMetodo } from '@/utils/presupuestos'

const props = defineProps({ id: { type: String, required: true } })

const comprobante = ref(null)
const cargando = ref(true)
const error = ref('')

const orden = computed(() => comprobante.value?.orden)
const pago = computed(() => comprobante.value?.pago)

const lineas = computed(() => [
  ...(orden.value?.ordenServicios ?? []).map((s) => ({ ...s, nombre: s.servicio?.nombre })),
  ...(orden.value?.ordenProductos ?? []).map((p) => ({ ...p, nombre: p.producto?.nombre }))
])

const totalOrden = computed(() => orden.value?.total ?? totalLineas(lineas.value))
const montos = computed(() => desglosarIva(totalOrden.value))

function imprimir() {
  window.print()
}

onMounted(async () => {
  try {
    comprobante.value = await comprobantesApi.obtener(props.id)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el comprobante')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <p v-if="cargando">Cargando...</p>
  <p v-else-if="!comprobante" class="alerta alerta-error">{{ error }}</p>

  <template v-else>
    <div class="encabezado no-imprimir">
      <RouterLink :to="`/ordenes/${orden.id}`">← Volver a la orden #{{ orden.id }}</RouterLink>
      <button class="btn btn-primario" @click="imprimir">Imprimir / PDF</button>
    </div>

    <article class="card documento">
      <header class="doc-cabecera">
        <div>
          <p class="doc-marca">Serviteca</p>
          <p class="desc">Comprobante de pago</p>
        </div>
        <div class="doc-numero">
          <strong>{{ comprobante.numero }}</strong>
          <span>{{ fechaHora(comprobante.fechaEmision) }}</span>
        </div>
      </header>

      <dl class="datos doc-datos">
        <div>
          <dt>Cliente</dt>
          <dd>{{ orden.vehiculo.cliente?.nombre ?? '—' }}</dd>
        </div>
        <div>
          <dt>RUT</dt>
          <dd>{{ orden.vehiculo.cliente?.rut ?? '—' }}</dd>
        </div>
        <div>
          <dt>Vehículo</dt>
          <dd>
            <span class="patente">{{ orden.vehiculo.patente }}</span>
            {{ orden.vehiculo.marca }} {{ orden.vehiculo.modelo }}
          </dd>
        </div>
        <div>
          <dt>Orden de trabajo</dt>
          <dd>#{{ orden.id }}</dd>
        </div>
      </dl>

      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Detalle de la orden</th>
              <th class="der">Cant.</th>
              <th class="der">Precio unit.</th>
              <th class="der">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lineas" :key="`${l.servicioId ? 's' : 'p'}${l.id}`">
              <td>{{ l.nombre }}</td>
              <td class="der">{{ l.cantidad }}</td>
              <td class="der">{{ formatearPesos(l.precioUnitario) }}</td>
              <td class="der">{{ formatearPesos(l.cantidad * l.precioUnitario) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="cierre">
        <dl class="montos">
          <div><dt>Neto</dt><dd>{{ formatearPesos(montos.neto) }}</dd></div>
          <div><dt>IVA (19%)</dt><dd>{{ formatearPesos(montos.iva) }}</dd></div>
          <div class="linea"><dt>Total de la orden</dt><dd>{{ formatearPesos(montos.total) }}</dd></div>
        </dl>

        <dl class="montos pago">
          <div class="destacado">
            <dt>Este pago</dt>
            <dd>{{ formatearPesos(pago.monto) }}</dd>
          </div>
          <div><dt>Método</dt><dd>{{ etiquetaMetodo(pago.metodo) }}</dd></div>
          <div v-if="orden.pagado !== undefined">
            <dt>Total pagado</dt>
            <dd>{{ formatearPesos(orden.pagado) }}</dd>
          </div>
          <div v-if="orden.saldo !== undefined">
            <dt>Saldo pendiente</dt>
            <dd>{{ formatearPesos(orden.saldo) }}</dd>
          </div>
        </dl>
      </div>

      <p class="doc-pie desc">
        Recibido por {{ nombreUsuario(pago.usuario) }}. Este comprobante no reemplaza a la boleta o
        factura electrónica.
      </p>
    </article>
  </template>
</template>

<style scoped>
.desc {
  color: var(--muted);
}
.encabezado {
  align-items: center;
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
  font-size: 1.15rem;
  font-family: ui-monospace, Menlo, monospace;
}
.doc-datos {
  margin-bottom: 1.25rem;
}
.der {
  text-align: right;
  white-space: nowrap;
}
.cierre {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.montos {
  margin: 0;
  min-width: 240px;
  flex: 1;
  max-width: 320px;
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
.montos .linea {
  border-top: 1px solid var(--border);
  margin-top: 0.3rem;
  padding-top: 0.6rem;
  font-weight: 700;
}
.pago {
  background: var(--bg);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
}
.pago .destacado {
  font-size: 1.25rem;
  font-weight: 700;
}
.pago .destacado dt {
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
