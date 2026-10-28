<script setup>
import { RouterLink } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const { loginWithRedirect, isLoading } = useAuth0()

function entrar(registro) {
  sessionStorage.setItem('serviteca_zona', 'portal')
  loginWithRedirect({
    authorizationParams: registro ? { screen_hint: 'signup' } : {}
  })
}
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <h1>Portal de clientes</h1>
      <p class="subtitulo">Consulta el estado y el historial de tus vehículos</p>

      <div class="acciones">
        <button type="button" class="btn btn-primario" :disabled="isLoading" @click="entrar(false)">
          Iniciar sesión
        </button>
        <button type="button" class="btn btn-secundario" :disabled="isLoading" @click="entrar(true)">
          Crear cuenta
        </button>
      </div>

      <p class="cambio">¿Trabajas en la serviteca? <RouterLink to="/login">Acceso del personal</RouterLink></p>
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
  max-width: 420px;
  margin-bottom: 0;
}

.cambio {
  margin: 1.5rem 0 0;
  font-size: 0.9rem;
  color: var(--muted);
}
</style>