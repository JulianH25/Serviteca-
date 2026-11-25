<script setup>
import { reactive, ref, computed } from 'vue'
import { useAuth0 } from '@auth0/auth0-vue'
import { portalApi, mensajeError } from '@/services/api'
import { formatearRut, rutValido, mensajeRut } from '@/utils/validaciones'

const { user, logout } = useAuth0()

const form = reactive({ rut: '', email: '', codigo: '' })
const tocado = reactive({ rut: false, email: false, codigo: false })
const paso = ref('datos')
const codigoDesarrollo = ref('')
const enviando = ref(false)
const error = ref('')

const errores = computed(() => ({
  rut: !rutValido(form.rut) ? mensajeRut(form.rut) : '',
  email: !/^\S+@\S+\.\S+$/.test(form.email) ? 'Ingresa un correo válido' : '',
  codigo: !/^\d{6}$/.test(form.codigo) ? 'Ingresa el código de 6 dígitos' : ''
}))

function alSalirRut() {
  tocado.rut = true
  form.rut = formatearRut(form.rut)
}

async function vincular() {
  tocado.rut = true
  tocado.email = true
  if (errores.value.rut || errores.value.email) return

  enviando.value = true
  error.value = ''
  try {
    const respuesta = await portalApi.solicitarCodigo({ rut: formatearRut(form.rut), email: form.email })
    codigoDesarrollo.value = respuesta.codigoDesarrollo ?? ''
    paso.value = 'codigo'
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo vincular la cuenta')
  } finally {
    enviando.value = false
  }
}

async function verificar() {
  tocado.codigo = true
  if (errores.value.codigo) return
  enviando.value = true
  error.value = ''
  try {
    await portalApi.verificarCodigo({ rut: formatearRut(form.rut), email: form.email, codigo: form.codigo })
    window.location.href = '/portal'
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo verificar la cuenta')
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

      <template v-if="paso === 'datos'">
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

      <div class="campo">
        <label for="email">Correo registrado *</label>
        <input id="email" v-model.trim="form.email" type="email" autocomplete="email" :class="{ invalido: tocado.email && errores.email }" @blur="tocado.email = true" />
        <small v-if="tocado.email && errores.email" class="error">{{ errores.email }}</small>
      </div>
      </template>

      <div v-else class="campo">
        <p v-if="codigoDesarrollo" class="codigo-desarrollo">Código de desarrollo: <strong>{{ codigoDesarrollo }}</strong></p>
        <p>Te enviamos un código de 6 dígitos al correo ingresado. Tiene una validez de 10 minutos.</p>
        <label for="codigo">Código de verificación *</label>
        <input id="codigo" v-model.trim="form.codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" :class="{ invalido: tocado.codigo && errores.codigo }" @blur="tocado.codigo = true" />
        <small v-if="tocado.codigo && errores.codigo" class="error">{{ errores.codigo }}</small>
      </div>

      <p v-if="error" class="alerta alerta-error">{{ error }}</p>

      <div class="acciones">
        <button v-if="paso === 'datos'" type="submit" class="btn btn-primario" :disabled="enviando">
          {{ enviando ? 'Enviando código...' : 'Enviar código' }}
        </button>
        <button v-else type="button" class="btn btn-primario" :disabled="enviando" @click="verificar">
          {{ enviando ? 'Verificando...' : 'Verificar cuenta' }}
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
