<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const { loginWithRedirect, isLoading } = useAuth0()

const mensaje = ref('')
if (sessionStorage.getItem('serviteca_error') === 'no_autorizado') {
  mensaje.value = 'Tu cuenta no está autorizada para usar el sistema. Contacta al administrador.'
}
sessionStorage.removeItem('serviteca_error')

function ingresar() {
  sessionStorage.setItem('serviteca_zona', 'personal')
  loginWithRedirect({ authorizationParams: { prompt: 'login' } })
}
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <h1>Serviteca</h1>
      <p class="subtitulo">Acceso para el personal</p>

      <p v-if="mensaje" class="alerta alerta-error">{{ mensaje }}</p>

      <div class="acciones">
        <button type="button" class="btn btn-primario" :disabled="isLoading" @click="ingresar">
          {{ isLoading ? 'Cargando...' : 'Ingresar' }}
        </button>
      </div>

      <p class="cambio">¿Eres cliente? <RouterLink to="/portal/login">Ingresa al portal</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  margin-bottom: 0;
}

.cambio {
  margin: 1.5rem 0 0;
  font-size: 0.9rem;
  color: var(--muted);
}
</style>