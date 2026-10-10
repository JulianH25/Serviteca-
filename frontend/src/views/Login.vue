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
    error.value =
      e.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos'
        : e.message || 'No se pudo iniciar sesión'
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="pantalla">
    <div class="caja">
      <div class="marca">
        <span class="logo">S</span>
        <h1>Serviteca</h1>
      </div>
      <p class="subtitulo">Ingresa con tu cuenta para continuar</p>

      <form @submit.prevent="handleLogin">
        <div class="campo">
          <label for="email">Correo</label>
          <input id="email" v-model="email" type="email" autocomplete="email" required />
        </div>
        <div class="campo">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="alerta alerta-error">{{ error }}</p>

        <button type="submit" class="btn btn-primario" :disabled="cargando">
          {{ cargando ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--sidebar);
}

.caja {
  background: var(--surface);
  border-radius: 12px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
}

.marca {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.marca h1 {
  margin: 0;
}

.logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn {
  justify-content: center;
  width: 100%;
  margin-top: 0.5rem;
}
</style>
