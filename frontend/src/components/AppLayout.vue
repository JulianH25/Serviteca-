<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'

const { user, logout } = useAuth0()
const menuAbierto = ref(false)

const enlaces = [
  { to: '/', texto: 'Inicio' },
  { to: '/clientes', texto: 'Clientes' },
  { to: '/vehiculos', texto: 'Vehículos' }
]

function salir() {
  logout({ logoutParams: { returnTo: `${window.location.origin}/login` } })
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar" :class="{ abierto: menuAbierto }">
      <div class="marca">
        <span class="logo">S</span>
        <span>Serviteca</span>
        <button class="menu-movil" @click="menuAbierto = !menuAbierto" aria-label="Menú">☰</button>
      </div>
      <nav @click="menuAbierto = false">
        <RouterLink v-for="e in enlaces" :key="e.to" :to="e.to" class="enlace">
          {{ e.texto }}
        </RouterLink>
      </nav>
      <div class="usuario">
        <small>{{ user?.email }}</small>
        <button class="salir" @click="salir">Cerrar sesión</button>
      </div>
    </aside>

    <main class="contenido">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 230px;
  background: var(--sidebar);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem;
  position: sticky;
  top: 0;
  height: 100vh;
}

.marca {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--primary);
  display: grid;
  place-items: center;
}

.menu-movil {
  display: none;
  margin-left: auto;
  background: none;
  border: none;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.enlace {
  color: #cbd2dc;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
}

.enlace:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.enlace.router-link-exact-active,
.enlace.router-link-active:not([href='/']) {
  background: rgba(232, 89, 12, 0.18);
  color: #fff;
}

.usuario {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.usuario small {
  color: #9aa4b2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.salir {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}

.contenido {
  flex: 1;
  padding: 2rem;
  max-width: 1100px;
  min-width: 0;
}

@media (max-width: 768px) {
  .layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    padding: 1rem;
  }
  .marca {
    margin-bottom: 0;
  }
  .menu-movil {
    display: block;
  }
  .sidebar nav,
  .sidebar .usuario {
    display: none;
  }
  .sidebar.abierto nav,
  .sidebar.abierto .usuario {
    display: flex;
    margin-top: 1rem;
  }
  .contenido {
    padding: 1rem;
  }
}
</style>