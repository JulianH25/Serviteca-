<script setup>
import { reactive, ref, computed } from 'vue'
import { useAuth0 } from '@auth0/auth0-vue'
import { portalApi, mensajeError } from '@/services/api'
import { formatearRut, rutValido, mensajeRut } from '@/utils/validaciones'

const { user, logout } = useAuth0()

const form = reactive({ rut: '' })
const tocado = reactive({ rut: false })
const enviando = ref(false)
const error = ref('')

const errores = computed(() => ({
  rut: !rutValido(form.rut) ? mensajeRut(form.rut) : ''
}))

function alSalirRut() {
  tocado.rut = true
  form.rut = formatearRut(form.rut)
}

async function vincular() {
  tocado.rut = true
  if (errores.value.rut) return

  enviando.value = true
  error.value = ''
  try {
    await portalApi.vincular({ rut: formatearRut(form.rut) })
    // Recarga completa para que el sistema reconozca la cuenta como cliente
    window.location.href = '/portal'
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo vincular la cuenta')
  } finally {
    enviando.value = false
  }
}

function salir() {
  logout({ logoutParams: { returnTo: `${window.location.origin}/portal/login` } })
}
</script>

<template>
  <div class="vincular-wrap">
    <form class="card vincular-card" novalidate @submit.prevent="vincular">
      <h1>Vincula tu cuenta</h1>
      <p class="subtitulo">
        Sesión iniciada como {{ user?.email }}. Ingresa tu RUT para ver los vehículos asociados a él.
      </p>

      <div class="campo">
        <label for="rut">Tu RUT *</label>
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

      <p v-if="error" class="alerta alerta-error">{{ error }}</p>

      <div class="acciones">
        <button type="submit" class="btn btn-primario" :disabled="enviando">
          {{ enviando ? 'Verificando...' : 'Vincular cuenta' }}
        </button>
        <button type="button" class="btn btn-secundario" @click="salir">Cerrar sesión</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.vincular-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.vincular-card {
  width: 100%;
  max-width: 440px;
  margin-bottom: 0;
}
</style>