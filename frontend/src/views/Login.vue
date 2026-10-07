<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const password = ref('')
const error = ref('')
const cargando = ref(false)
const router = useRouter()
const authStore = useAuthStore()

async function handleLogin() {
  error.value = ''
  cargando.value = true
  try {
    await authStore.iniciarSesion(email.value, password.value)
    router.push('/')
    } catch (e) {
    console.error(e)
    error.value = e.message || 'Credenciales inválidas'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="login">
    <h2>Iniciar sesión</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="Correo" required />
      <input v-model="password" type="password" placeholder="Contraseña" required />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  </div>
</template>