<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clientesApi, vehiculosApi, mensajeError } from '@/services/api'
import {
  formatearRut,
  rutValido,
  mensajeRut,
  limpiarPatente,
  patenteValida
} from '@/utils/validaciones'

const route = useRoute()
const router = useRouter()

const form = reactive({
  clienteRut: '',
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  kilometraje: ''
})
const tocado = reactive({ clienteRut: false, patente: false, anio: false })
const clienteEncontrado = ref(null)
const buscandoCliente = ref(false)
const errorCliente = ref('')
const enviando = ref(false)
const error = ref('')

const anioActual = new Date().getFullYear()

const errores = computed(() => ({
  clienteRut: !rutValido(form.clienteRut) ? mensajeRut(form.clienteRut) : '',
  patente: !patenteValida(form.patente) ? 'Patente inválida (ej: BBCL23 o AB1234)' : '',
  anio:
    !Number.isInteger(Number(form.anio)) || form.anio < 1950 || form.anio > anioActual + 1
      ? 'Año inválido'
      : ''
}))

const formValido = computed(
  () =>
    form.marca.trim() &&
    form.modelo.trim() &&
    !errores.value.clienteRut &&
    !errores.value.patente &&
    !errores.value.anio &&
    clienteEncontrado.value
)

async function buscarCliente() {
  clienteEncontrado.value = null
  errorCliente.value = ''
  if (errores.value.clienteRut) return
  buscandoCliente.value = true
  try {
    clienteEncontrado.value = await clientesApi.porRut(form.clienteRut)
  } catch (e) {
    errorCliente.value = mensajeError(e, 'No se pudo buscar el cliente')
  } finally {
    buscandoCliente.value = false
  }
}

async function alSalirRut() {
  tocado.clienteRut = true
  form.clienteRut = formatearRut(form.clienteRut)
  await buscarCliente()
}

function alSalirPatente() {
  tocado.patente = true
  form.patente = limpiarPatente(form.patente)
}

async function guardar() {
  Object.keys(tocado).forEach((k) => (tocado[k] = true))
  if (!formValido.value) return

  enviando.value = true
  error.value = ''
  try {
    await vehiculosApi.crear({
      clienteRut: formatearRut(form.clienteRut),
      patente: limpiarPatente(form.patente),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anio: Number(form.anio),
      kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje)
    })
    router.push(`/clientes/${clienteEncontrado.value.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo registrar el vehículo')
  } finally {
    enviando.value = false
  }
}

onMounted(() => {
  if (route.query.clienteRut) {
    form.clienteRut = formatearRut(route.query.clienteRut)
    tocado.clienteRut = true
    buscarCliente()
  }
})
</script>

<template>
  <h1>Registrar vehículo</h1>
  <p class="subtitulo">El vehículo se asocia al cliente mediante su RUT</p>

  <form class="card" novalidate @submit.prevent="guardar">
    <div class="form-grid">
      <div class="campo">
        <label for="clienteRut">RUT del cliente *</label>
        <input
          id="clienteRut"
          v-model="form.clienteRut"
          placeholder="12.345.678-9"
          maxlength="12"
          :class="{ invalido: (tocado.clienteRut && errores.clienteRut) || errorCliente }"
          @blur="alSalirRut"
        />
        <small v-if="tocado.clienteRut && errores.clienteRut" class="error">
          {{ errores.clienteRut }}
        </small>
        <small v-else-if="buscandoCliente">Buscando cliente...</small>
        <small v-else-if="errorCliente" class="error">{{ errorCliente }}</small>
        <small v-else-if="clienteEncontrado">Cliente: {{ clienteEncontrado.nombre }}</small>
      </div>

      <div class="campo">
        <label for="patente">Patente *</label>
        <input
          id="patente"
          v-model="form.patente"
          placeholder="BBCL23"
          maxlength="8"
          :class="{ invalido: tocado.patente && errores.patente }"
          @blur="alSalirPatente"
        />
        <small v-if="tocado.patente && errores.patente" class="error">{{ errores.patente }}</small>
      </div>

      <div class="campo">
        <label for="marca">Marca *</label>
        <input id="marca" v-model="form.marca" maxlength="50" required />
      </div>

      <div class="campo">
        <label for="modelo">Modelo *</label>
        <input id="modelo" v-model="form.modelo" maxlength="50" required />
      </div>

      <div class="campo">
        <label for="anio">Año *</label>
        <input
          id="anio"
          v-model="form.anio"
          type="number"
          :class="{ invalido: tocado.anio && errores.anio }"
          @blur="tocado.anio = true"
        />
        <small v-if="tocado.anio && errores.anio" class="error">{{ errores.anio }}</small>
      </div>

      <div class="campo">
        <label for="kilometraje">Kilometraje</label>
        <input id="kilometraje" v-model="form.kilometraje" type="number" min="0" />
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando">
        {{ enviando ? 'Guardando...' : 'Guardar vehículo' }}
      </button>
      <button type="button" class="btn btn-secundario" @click="router.back()">Cancelar</button>
    </div>
  </form>
</template>