<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clientesApi, vehiculosApi, mensajeError } from '@/services/api'
import { limpiarPatente, patenteValida } from '@/utils/validaciones'

const route = useRoute()
const router = useRouter()
const form = reactive({ clienteId: '', patente: '', marca: '', modelo: '', anio: '', kilometraje: '' })
const clienteEncontrado = ref(null)
const tocado = reactive({ patente: false, anio: false })
const enviando = ref(false)
const cargando = ref(true)
const error = ref('')
const anioActual = new Date().getFullYear()

const errores = computed(() => ({
  patente: !patenteValida(form.patente) ? 'Patente invalida (ej: BBCL23 o AB1234)' : '',
  anio:
    !Number.isInteger(Number(form.anio)) || form.anio < 1950 || form.anio > anioActual + 1
      ? 'Anio invalido'
      : ''
}))

const formValido = computed(
  () =>
    clienteEncontrado.value &&
    form.marca.trim() &&
    form.modelo.trim() &&
    !errores.value.patente &&
    !errores.value.anio
)

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
      clienteId: Number(form.clienteId),
      patente: limpiarPatente(form.patente),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anio: Number(form.anio),
      kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje)
    })
    router.push(`/clientes/${clienteEncontrado.value.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo registrar el vehiculo')
  } finally {
    enviando.value = false
  }
}

onMounted(async () => {
  try {
    form.clienteId = route.query.clienteId
    if (!form.clienteId) {
      error.value = 'Primero registra o selecciona un cliente desde la pantalla Clientes.'
      return
    }
    clienteEncontrado.value = await clientesApi.obtener(form.clienteId)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el cliente')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <h1>Registrar vehiculo</h1>
  <p class="subtitulo">El vehiculo se asociara al cliente seleccionado</p>

  <p v-if="cargando">Cargando cliente...</p>
  <form v-else class="card" novalidate @submit.prevent="guardar">
    <div v-if="clienteEncontrado" class="card cliente-resumen">
      <strong>{{ clienteEncontrado.nombre }}</strong>
      <span>{{ clienteEncontrado.telefono }}</span>
    </div>

    <div class="form-grid">
      <div class="campo">
        <label for="patente">Patente *</label>
        <input id="patente" v-model="form.patente" maxlength="8" @blur="alSalirPatente" />
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
        <label for="anio">Anio *</label>
        <input id="anio" v-model="form.anio" type="number" @blur="tocado.anio = true" />
        <small v-if="tocado.anio && errores.anio" class="error">{{ errores.anio }}</small>
      </div>
      <div class="campo">
        <label for="kilometraje">Kilometraje</label>
        <input id="kilometraje" v-model="form.kilometraje" type="number" min="0" />
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>
    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando || !clienteEncontrado">
        {{ enviando ? 'Guardando...' : 'Guardar vehiculo' }}
      </button>
      <button type="button" class="btn btn-secundario" @click="router.back()">Cancelar</button>
    </div>
  </form>
</template>

<style scoped>
.cliente-resumen { display: flex; gap: 1rem; margin-bottom: 1rem; }
.cliente-resumen span { color: var(--muted); }
</style>
