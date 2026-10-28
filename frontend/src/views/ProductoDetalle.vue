<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { productosApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'
import { fechaHora, nombreUsuario } from '@/utils/ordenes'

const props = defineProps({ id: { type: String, required: true } })

const producto = ref(null)
const cargando = ref(true)
const error = ref('')
const ok = ref('')
const enviando = ref(false)

const mov = reactive({ tipo: 'ENTRADA', cantidad: 1, motivo: '' })
const edicion = reactive({ costo: 0, precioVenta: 0, stockMinimo: 0 })

const stockBajo = computed(
  () => producto.value && producto.value.stockActual <= producto.value.stockMinimo
)

async function cargar() {
  try {
    const p = await productosApi.obtener(props.id)
    producto.value = p
    edicion.costo = p.costo
    edicion.precioVenta = p.precioVenta
    edicion.stockMinimo = p.stockMinimo
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el producto')
  } finally {
    cargando.value = false
  }
}

async function ejecutar(fn, mensajeOk, mensajeFallo) {
  enviando.value = true
  error.value = ''
  ok.value = ''
  try {
    await fn()
    await cargar()
    ok.value = mensajeOk
  } catch (e) {
    error.value = mensajeError(e, mensajeFallo)
  } finally {
    enviando.value = false
  }
}

function registrarMovimiento() {
  if (!Number.isInteger(Number(mov.cantidad)) || Number(mov.cantidad) < 1) {
    error.value = 'Ingresa una cantidad válida (entero, 1 o más)'
    return
  }
  ejecutar(
    async () => {
      await productosApi.movimiento(props.id, {
        tipo: mov.tipo,
        cantidad: Number(mov.cantidad),
        motivo: mov.motivo.trim()
      })
      mov.cantidad = 1
      mov.motivo = ''
    },
    'Movimiento registrado',
    'No se pudo registrar el movimiento'
  )
}

function guardarDatos() {
  ejecutar(
    () =>
      productosApi.actualizar(props.id, {
        costo: Number(edicion.costo),
        precioVenta: Number(edicion.precioVenta),
        stockMinimo: Number(edicion.stockMinimo)
      }),
    'Datos actualizados',
    'No se pudieron guardar los cambios'
  )
}

function alternarActivo() {
  ejecutar(
    () => productosApi.actualizar(props.id, { activo: !producto.value.activo }),
    producto.value.activo ? 'Producto desactivado' : 'Producto activado',
    'No se pudo cambiar el estado'
  )
}

onMounted(cargar)
</script>

<template>
  <RouterLink to="/productos" class="volver">← Volver al inventario</RouterLink>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="!producto" class="alerta alerta-error">{{ error }}</p>

  <template v-else>
    <div class="encabezado">
      <div>
        <h1>{{ producto.nombre }}</h1>
        <p class="subtitulo">
          {{ producto.codigo || 'Sin código' }} · {{ producto.categoria?.nombre || 'Sin categoría' }}
          <template v-if="!producto.activo"> · Inactivo</template>
        </p>
      </div>
      <button type="button" class="btn btn-secundario" @click="alternarActivo">
        {{ producto.activo ? 'Desactivar' : 'Activar' }}
      </button>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>
    <p v-if="ok" class="alerta alerta-ok">{{ ok }}</p>
    <p v-if="stockBajo" class="alerta alerta-error">
      ⚠ Stock bajo: quedan {{ producto.stockActual }} (mínimo {{ producto.stockMinimo }})
    </p>

    <div class="grilla">
      <div class="card">
        <h2>Stock actual</h2>
        <p class="stock" :class="{ bajo: stockBajo }">{{ producto.stockActual }}</p>

        <h2>Registrar movimiento</h2>
        <form class="mov" @submit.prevent="registrarMovimiento">
          <select v-model="mov.tipo">
            <option value="ENTRADA">Entrada (compra / reposición)</option>
            <option value="SALIDA">Salida (merma / uso)</option>
          </select>
          <input v-model.number="mov.cantidad" type="number" min="1" placeholder="Cantidad" />
          <input v-model="mov.motivo" maxlength="200" placeholder="Motivo (opcional)" />
          <button type="submit" class="btn btn-primario" :disabled="enviando">Registrar</button>
        </form>
      </div>

      <div class="card">
        <h2>Datos del producto</h2>
        <form class="mov" @submit.prevent="guardarDatos">
          <label>Costo (CLP)</label>
          <input v-model.number="edicion.costo" type="number" min="0" />
          <label>Precio de venta (CLP)</label>
          <input v-model.number="edicion.precioVenta" type="number" min="0" />
          <label>Stock mínimo (alerta)</label>
          <input v-model.number="edicion.stockMinimo" type="number" min="0" />
          <button type="submit" class="btn btn-secundario" :disabled="enviando">
            Guardar cambios
          </button>
        </form>
        <small class="desc">Precio actual de venta: {{ formatearPesos(producto.precioVenta) }}</small>
      </div>
    </div>

    <div class="card">
      <h2>Últimos movimientos</h2>
      <div class="tabla-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Motivo</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!producto.movimientosInventario?.length">
              <td colspan="5" class="vacio">Sin movimientos registrados</td>
            </tr>
            <tr v-for="m in producto.movimientosInventario" :key="m.id">
              <td>{{ fechaHora(m.fecha) }}</td>
              <td>
                <span :class="m.tipo === 'ENTRADA' ? 'entrada' : 'salida'">{{ m.tipo }}</span>
              </td>
              <td>{{ m.cantidad }}</td>
              <td>
                {{ m.motivo || '—' }}
                <RouterLink v-if="m.ordenId" :to="`/ordenes/${m.ordenId}`"> (ver orden)</RouterLink>
              </td>
              <td>{{ nombreUsuario(m.usuario) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
</template>

<style scoped>
.volver {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}
.stock {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}
.stock.bajo {
  color: #b91c1c;
}
.mov {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mov label {
  font-size: 0.85rem;
  color: var(--muted);
}
.desc {
  display: block;
  margin-top: 0.75rem;
  color: var(--muted);
}
.entrada {
  color: #166534;
  font-weight: 700;
}
.salida {
  color: #b91c1c;
  font-weight: 700;
}
.alerta-ok {
  background: #dcfce7;
  color: #166534;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}
</style>