<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { portalApi, mensajeError } from '@/services/api'
import { fechaHora } from '@/utils/ordenes'

const notificaciones = ref([])
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    notificaciones.value = await portalApi.notificaciones()
    if (notificaciones.value.some((n) => !n.leidaEn)) {
      await portalApi.marcarLeidas()
      window.dispatchEvent(new Event('notificaciones-leidas'))
    }
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar tus notificaciones')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <RouterLink to="/portal" class="volver">← Volver a mis vehículos</RouterLink>

  <h1>Notificaciones</h1>
  <p class="subtitulo">Avisos sobre el estado de tus vehículos</p>

  <p v-if="cargando">Cargando...</p>
  <p v-else-if="error" class="alerta alerta-error">{{ error }}</p>
  <div v-else-if="!notificaciones.length" class="card vacio">No tienes notificaciones.</div>

  <div v-else class="card">
    <ul class="lista">
      <li v-for="n in notificaciones" :key="n.id" :class="{ nueva: !n.leidaEn }">
        <p class="mensaje">{{ n.mensaje }}</p>
        <small>
          {{ fechaHora(n.enviadaEn) }}
          <template v-if="n.orden?.vehiculo">
            ·
            <RouterLink :to="`/portal/vehiculos/${n.orden.vehiculo.id}`">Ver vehículo</RouterLink>
          </template>
        </small>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.volver {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lista li {
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid var(--border);
  border-left: 3px solid transparent;
}

.lista li.nueva {
  background: #fff7ed;
  border-left-color: var(--primary);
}

.mensaje {
  margin: 0 0 0.25rem;
}

small {
  color: var(--muted);
}
</style>