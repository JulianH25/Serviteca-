<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { clientesApi, vehiculosApi, mensajeError } from '@/services/api'
import { limpiarPatente, patenteValida } from '@/utils/validaciones'

const route = useRoute()
const router = useRouter()
const anioActual = new Date().getFullYear()

const form = reactive({ patente: '', marca: '', modelo: '', anio: '', kilometraje: '' })
const tocado = reactive({ patente: false, anio: false })
const enviando = ref(false)
const error = ref('')
const exito = ref('')

// ---- Selección de cliente (asociación cliente–vehículo) ----
const clienteSeleccionado = ref(null)
const busquedaCliente = ref('')
const resultadosCliente = ref([])
const buscandoCliente = ref(false)

let timer
watch(busquedaCliente, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 2) {
    resultadosCliente.value = []
    return
  }
  timer = setTimeout(async () => {
    buscandoCliente.value = true
    try {
      resultadosCliente.value = await clientesApi.listar(q.trim())
    } catch (e) {
      error.value = mensajeError(e)
    } finally {
      buscandoCliente.value = false
    }
  }, 300)
})

function elegirCliente(c) {
  clienteSeleccionado.value = c
  busquedaCliente.value = ''
  resultadosCliente.value = []
}

// Si venimos desde el detalle de un cliente, ya viene preseleccionado
onMounted(async () => {
  const id = route.query.clienteId
  if (id) {
    try {
      clienteSeleccionado.value = await clientesApi.obtener(id)
    } catch {
      /* si falla, el usuario lo busca a mano */
    }
  }
})

// ---- Validaciones ----
const errores = computed(() => {
  const anio = Number(form.anio)
  return {
    patente: !patenteValida(form.patente) ? 'Formato: BBBB12 o AB1234' : '',
    anio: !anio || anio < 1950 || anio > anioActual + 1 ? `Año entre 1950 y ${anioActual + 1}` : ''
  }
})

const formValido = computed(
  () =>
    clienteSeleccionado.value &&
    form.marca.trim() &&
    form.modelo.trim() &&
    !errores.value.patente &&
    !errores.value.anio
)

async function registrar() {
  tocado.patente = tocado.anio = true
  error.value = ''
  exito.value = ''
  if (!clienteSeleccionado.value) {
    error.value = 'Selecciona el cliente dueño del vehículo'
    return
  }
  if (!formValido.value) return

  enviando.value = true
  try {
    const vehiculo = await vehiculosApi.crear({
      patente: limpiarPatente(form.patente),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anio: Number(form.anio),
      kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
      clienteId: clienteSeleccionado.value.id
    })
    exito.value = `Vehículo ${vehiculo.patente} registrado y asociado a ${clienteSeleccionado.value.nombre}`
    Object.assign(form, { patente: '', marca: '', modelo: '', anio: '', kilometraje: '' })
    tocado.patente = tocado.anio = false
  } catch (e) {
    error.value = mensajeError(e, 'Error al registrar el vehículo')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <h1>Registrar vehículo</h1>
  <p class="subtitulo">El vehículo queda asociado al cliente que selecciones</p>

  <form class="card" novalidate @submit.prevent="registrar">
    <h2>1. Cliente dueño</h2>

    <div v-if="clienteSeleccionado" class="cliente-elegido">
      <div>
        <strong>{{ clienteSeleccionado.nombre }}</strong>
        <small>{{ clienteSeleccionado.rut }} · {{ clienteSeleccionado.telefono }}</small>
      </div>
      <button type="button" class="btn btn-secundario" @click="clienteSeleccionado = null">
        Cambiar
      </button>
    </div>

    <div v-else class="campo selector">
      <label for="buscar-cliente">Buscar cliente por nombre o RUT</label>
      <input
        id="buscar-cliente"
        v-model="busquedaCliente"
        placeholder="Escribe al menos 2 caracteres"
        autocomplete="off"
      />
      <ul v-if="resultadosCliente.length" class="resultados">
        <li v-for="c in resultadosCliente" :key="c.id" @click="elegirCliente(c)">
          <strong>{{ c.nombre }}</strong> <small>{{ c.rut }}</small>
        </li>
      </ul>
      <small v-else-if="buscandoCliente">Buscando...</small>
      <small v-else-if="busquedaCliente.trim().length >= 2">
        Sin resultados.
        <RouterLink to="/clientes/nuevo">Registrar cliente nuevo</RouterLink>
      </small>
    </div>

    <h2 style="margin-top: 2rem">2. Datos del vehículo</h2>
    <div class="form-grid">
      <div class="campo">
        <label for="patente">Patente *</label>
        <input
          id="patente"
          v-model="form.patente"
          placeholder="BBCL23"
          maxlength="8"
          style="text-transform: uppercase"
          :class="{ invalido: tocado.patente && errores.patente }"
          @blur="tocado.patente = true"
        />
        <small :class="{ error: tocado.patente && errores.patente }">
          {{ tocado.patente && errores.patente ? errores.patente : 'Sin guion ni espacios' }}
        </small>
      </div>
      <div class="campo">
        <label for="marca">Marca *</label>
        <input id="marca" v-model="form.marca" placeholder="Toyota" maxlength="50" />
      </div>
      <div class="campo">
        <label for="modelo">Modelo *</label>
        <input id="modelo" v-model="form.modelo" placeholder="Yaris" maxlength="50" />
      </div>
      <div class="campo">
        <label for="anio">Año *</label>
        <input
          id="anio"
          v-model="form.anio"
          type="number"
          :placeholder="String(anioActual)"
          :class="{ invalido: tocado.anio && errores.anio }"
          @blur="tocado.anio = true"
        />
        <small v-if="tocado.anio && errores.anio" class="error">{{ errores.anio }}</small>
      </div>
      <div class="campo">
        <label for="km">Kilometraje</label>
        <input id="km" v-model="form.kilometraje" type="number" min="0" placeholder="85000" />
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>
    <p v-if="exito" class="alerta alerta-exito">{{ exito }}</p>

    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando">
        {{ enviando ? 'Registrando...' : 'Registrar vehículo' }}
      </button>
      <RouterLink
        v-if="clienteSeleccionado"
        :to="`/clientes/${clienteSeleccionado.id}`"
        class="btn btn-secundario"
      >
        Ver cliente
      </RouterLink>
      <button type="button" class="btn btn-secundario" @click="router.back()">Volver</button>
    </div>
  </form>
</template>

<style scoped>
.selector {
  position: relative;
  max-width: 420px;
}

.resultados {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  max-height: 240px;
  overflow-y: auto;
}

.resultados li {
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.resultados li:hover {
  background: #fff7ed;
}

.resultados small {
  color: var(--muted);
}

.cliente-elegido {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid #fed7aa;
  background: #fff7ed;
  border-radius: 6px;
  max-width: 520px;
}

.cliente-elegido div {
  display: flex;
  flex-direction: column;
}

.cliente-elegido small {
  color: var(--muted);
}
</style>
