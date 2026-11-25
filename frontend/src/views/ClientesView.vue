<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { clientesApi, mensajeError } from '@/services/api'
import { formatearFecha } from '@/utils/validaciones'

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

async function eliminarCliente(cliente) {
  if (!window.confirm(`¿Eliminar al cliente ${cliente.nombre} y sus vehículos? Esta acción no se puede deshacer.`)) return
  try {
    await clientesApi.eliminar(cliente.id)
    await cargar()
  } catch (e) {
    if (e.response?.status === 409 && e.response.data?.codigo === 'CLIENTE_CON_HISTORIAL') {
      const ordenes = e.response.data.ordenes ?? 0
      const presupuestos = e.response.data.presupuestos ?? 0
      const continuar = window.confirm(
        `Este cliente tiene ${ordenes} orden(es) y ${presupuestos} presupuesto(s) asociados.\n\n` +
          'Si continúas, se eliminarán también todo ese historial, pagos, comprobantes y vehículos. Esta acción no se puede deshacer.\n\n¿Deseas continuar?'
      )
      if (!continuar) return
      try {
        await clientesApi.eliminar(cliente.id, true)
        await cargar()
        return
      } catch (errorForzado) {
        error.value = mensajeError(errorForzado, 'No se pudo eliminar el cliente')
        return
      }
    }
    error.value = mensajeError(e, 'No se pudo eliminar el cliente')
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
            <th>Registrado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="7" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!clientes.length">
            <td colspan="7" class="vacio">No hay clientes registrados</td>
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
            <td>{{ formatearFecha(c.creadoEn) }}</td>
            <td>
              <button class="btn-eliminar" type="button" @click.stop="eliminarCliente(c)">Eliminar</button>
            </td>
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

.btn-eliminar {
  border: 0;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
  font: inherit;
}
</style>
