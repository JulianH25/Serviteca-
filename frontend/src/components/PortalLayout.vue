<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const { user, logout } = useAuth0()

function salir() {
  logout({ logoutParams: { returnTo: `${window.location.origin}/portal/login` } })
}
</script>

<template>
  <div class="portal">
    <header class="barra">
      <RouterLink to="/portal" class="marca">
        <span class="logo">S</span>
        <span>Serviteca</span>
      </RouterLink>
      <div class="usuario">
        <small>{{ user?.email }}</small>
        <button class="salir" @click="salir">Cerrar sesión</button>
      </div>
    </header>

    <main class="contenido">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.barra {
  background: var(--sidebar);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.5rem;
  flex-wrap: wrap;
}

.marca {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
}

.logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--primary);
  display: grid;
  place-items: center;
}

.usuario {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.usuario small {
  color: #9aa4b2;
}

.salir {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}

.contenido {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

@media (max-width: 600px) {
  .contenido {
    padding: 1rem;
  }
}
</style>