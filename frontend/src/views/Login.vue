<script setup>
import { useAuth0 } from '@auth0/auth0-vue'

const { loginWithRedirect, isLoading } = useAuth0()
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <h1>Serviteca</h1>
      <p class="subtitulo">Inicia sesión para continuar</p>

      <div class="acciones">
        <button
          type="button"
          class="btn btn-primario"
          :disabled="isLoading"
          @click="loginWithRedirect()"
        >
          {{ isLoading ? 'Cargando...' : 'Ingresar' }}
        </button>
      </div>
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
</style>