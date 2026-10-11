<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { clientesApi, mensajeError } from '@/services/api'

const router = useRouter()
const clientes = ref([])
const busqueda = ref('')
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    clientes.value = await clientesApi.listar(busqueda.value.trim())
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los clientes')
  } finally {
    cargando.value = false
  }
}

// Busca 300 ms después de que el usuario deja de escribir
let timer
watch(busqueda, () => {
  clearTimeout(timer)
  timer = setTimeout(cargar, 300)
})

onMounted(cargar)
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Clientes</h1>
      <p class="subtitulo">Busca por nombre o RUT</p>
    </div>
    <RouterLink to="/clientes/nuevo" class="btn btn-primario">+ Nuevo cliente</RouterLink>
  </div>

  <div class="card">
    <input v-model="busqueda" class="buscador" placeholder="Buscar cliente..." />

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>RUT</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Vehículos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="5" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!clientes.length">
            <td colspan="5" class="vacio">No hay clientes registrados</td>
          </tr>
          <tr
            v-for="c in clientes"
            v-else
            :key="c.id"
            class="fila"
            @click="router.push(`/clientes/${c.id}`)"
          >
            <td>
              <strong>{{ c.nombre }}</strong>
            </td>
            <td>{{ c.rut }}</td>
            <td>{{ c.telefono }}</td>
            <td>{{ c.correo || '—' }}</td>
            <td>{{ c._count?.vehiculos ?? c.vehiculos?.length ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.fila {
  cursor: pointer;
}
</style>
