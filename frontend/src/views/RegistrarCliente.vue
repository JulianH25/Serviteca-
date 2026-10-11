<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { clientesApi, mensajeError } from '@/services/api'
import { formatearRut, rutValido, telefonoValido, correoValido } from '@/utils/validaciones'

const router = useRouter()
const form = reactive({ nombre: '', rut: '', telefono: '', correo: '' })
const tocado = reactive({ rut: false, telefono: false, correo: false })
const enviando = ref(false)
const error = ref('')

const errores = computed(() => ({
  rut: !rutValido(form.rut) ? 'RUT inválido (revisa el dígito verificador)' : '',
  telefono: !telefonoValido(form.telefono) ? 'Ingresa un teléfono válido' : '',
  correo: !correoValido(form.correo) ? 'Correo inválido' : ''
}))

const formValido = computed(
  () => form.nombre.trim() && !errores.value.rut && !errores.value.telefono && !errores.value.correo
)

function alSalirRut() {
  tocado.rut = true
  form.rut = formatearRut(form.rut)
}

async function guardar() {
  Object.keys(tocado).forEach((k) => (tocado[k] = true))
  if (!formValido.value) return

  enviando.value = true
  error.value = ''
  try {
    const cliente = await clientesApi.crear({
      nombre: form.nombre.trim(),
      rut: formatearRut(form.rut),
      telefono: form.telefono.trim(),
      correo: form.correo.trim() || null
    })
    router.push(`/clientes/${cliente.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo registrar el cliente')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <h1>Registrar cliente</h1>
  <p class="subtitulo">Después podrás asociarle uno o más vehículos</p>

  <form class="card" novalidate @submit.prevent="guardar">
    <div class="form-grid">
      <div class="campo">
        <label for="nombre">Nombre completo *</label>
        <input id="nombre" v-model="form.nombre" maxlength="120" required />
      </div>

      <div class="campo">
        <label for="rut">RUT *</label>
        <input
          id="rut"
          v-model="form.rut"
          placeholder="12.345.678-9"
          maxlength="12"
          :class="{ invalido: tocado.rut && errores.rut }"
          @blur="alSalirRut"
        />
        <small v-if="tocado.rut && errores.rut" class="error">{{ errores.rut }}</small>
      </div>

      <div class="campo">
        <label for="telefono">Teléfono *</label>
        <input
          id="telefono"
          v-model="form.telefono"
          type="tel"
          placeholder="+56 9 1234 5678"
          maxlength="20"
          :class="{ invalido: tocado.telefono && errores.telefono }"
          @blur="tocado.telefono = true"
        />
        <small v-if="tocado.telefono && errores.telefono" class="error">
          {{ errores.telefono }}
        </small>
      </div>

      <div class="campo">
        <label for="correo">Correo</label>
        <input
          id="correo"
          v-model="form.correo"
          type="email"
          maxlength="120"
          :class="{ invalido: tocado.correo && errores.correo }"
          @blur="tocado.correo = true"
        />
        <small v-if="tocado.correo && errores.correo" class="error">{{ errores.correo }}</small>
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando">
        {{ enviando ? 'Guardando...' : 'Guardar cliente' }}
      </button>
      <button type="button" class="btn btn-secundario" @click="router.back()">Cancelar</button>
    </div>
  </form>
</template>
