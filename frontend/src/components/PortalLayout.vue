<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuth0 } from '@auth0/auth0-vue'
import { portalApi } from '@/services/api'

const { user, logout } = useAuth0()
const route = useRoute()
const noLeidas = ref(0)

async function actualizarConteo() {
  try {
    noLeidas.value = await portalApi.noLeidas()
  } catch (e) {
    // el conteo es secundario: se ignora el error
  }
}

function salir() {
  logout({ logoutParams: { returnTo: `${window.location.origin}/portal/login` } })
}

let intervalo
onMounted(() => {
  actualizarConteo()
  intervalo = setInterval(actualizarConteo, 60000)
  window.addEventListener('notificaciones-leidas', actualizarConteo)
})
onBeforeUnmount(() => {
  clearInterval(intervalo)
  window.removeEventListener('notificaciones-leidas', actualizarConteo)
})
watch(() => route.fullPath, actualizarConteo)
</script>

<template>
  <div class="portal">
    <header class="barra">
      <RouterLink to="/portal" class="marca">
        <span class="logo">S</span>
        <span>Serviteca</span>
      </RouterLink>
      <div class="usuario">
        <RouterLink to="/portal/notificaciones" class="campana" aria-label="Notificaciones">
          🔔
          <span v-if="noLeidas" class="contador">{{ noLeidas > 9 ? '9+' : noLeidas }}</span>
        </RouterLink>
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

.campana {
  position: relative;
  font-size: 1.2rem;
  line-height: 1;
}

.contador {
  position: absolute;
  top: -8px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: grid;
  place-items: center;
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