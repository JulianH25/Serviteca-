<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { serviciosApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'

const servicios = ref([])
const cargando = ref(true)
const enviando = ref(false)
const error = ref('')
const tocado = ref(false)
const form = reactive({ id: null, nombre: '', descripcion: '', precioBase: '' })

const errores = computed(() => ({
  nombre: !form.nombre.trim() ? 'El nombre es obligatorio' : '',
  precioBase:
    form.precioBase === '' || !Number.isInteger(Number(form.precioBase)) || Number(form.precioBase) < 0
      ? 'Ingresa un precio entero de 0 o más'
      : ''
}))

async function cargar() {
  cargando.value = true
  try {
    servicios.value = await serviciosApi.listar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar los servicios')
  } finally {
    cargando.value = false
  }
}

function limpiar() {
  form.id = null
  form.nombre = ''
  form.descripcion = ''
  form.precioBase = ''
  tocado.value = false
  error.value = ''
}

function editar(s) {
  form.id = s.id
  form.nombre = s.nombre
  form.descripcion = s.descripcion ?? ''
  form.precioBase = s.precioBase
  tocado.value = false
  error.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function guardar() {
  tocado.value = true
  if (errores.value.nombre || errores.value.precioBase) return

  enviando.value = true
  error.value = ''
  const datos = {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim(),
    precioBase: Number(form.precioBase)
  }
  try {
    if (form.id) await serviciosApi.actualizar(form.id, datos)
    else await serviciosApi.crear(datos)
    limpiar()
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo guardar el servicio')
  } finally {
    enviando.value = false
  }
}

async function alternarActivo(s) {
  error.value = ''
  try {
    await serviciosApi.actualizar(s.id, { activo: !s.activo })
    await cargar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo actualizar el servicio')
  }
}

onMounted(cargar)
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Servicios</h1>
      <p class="subtitulo">Catálogo de servicios que ofrece la serviteca</p>
    </div>
  </div>

  <form class="card" novalidate @submit.prevent="guardar">
    <h2>{{ form.id ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
    <div class="form-grid">
      <div class="campo">
        <label for="nombre">Nombre *</label>
        <input
          id="nombre"
          v-model="form.nombre"
          maxlength="80"
          :class="{ invalido: tocado && errores.nombre }"
        />
        <small v-if="tocado && errores.nombre" class="error">{{ errores.nombre }}</small>
      </div>

      <div class="campo">
        <label for="precio">Precio base (CLP) *</label>
        <input
          id="precio"
          v-model.number="form.precioBase"
          type="number"
          min="0"
          :class="{ invalido: tocado && errores.precioBase }"
        />
        <small v-if="tocado && errores.precioBase" class="error">{{ errores.precioBase }}</small>
      </div>

      <div class="campo">
        <label for="descripcion">Descripción</label>
        <input id="descripcion" v-model="form.descripcion" />
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando">
        {{ enviando ? 'Guardando...' : form.id ? 'Guardar cambios' : '+ Agregar servicio' }}
      </button>
      <button v-if="form.id" type="button" class="btn btn-secundario" @click="limpiar">
        Cancelar
      </button>
    </div>
  </form>

  <div class="card">
    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Precio base</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="4" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!servicios.length">
            <td colspan="4" class="vacio">Aún no hay servicios en el catálogo</td>
          </tr>
          <tr v-for="s in servicios" v-else :key="s.id" :class="{ inactivo: !s.activo }">
            <td>
              <strong>{{ s.nombre }}</strong>
              <br v-if="s.descripcion" />
              <small v-if="s.descripcion" class="desc">{{ s.descripcion }}</small>
            </td>
            <td>{{ formatearPesos(s.precioBase) }}</td>
            <td>{{ s.activo ? 'Activo' : 'Inactivo' }}</td>
            <td class="celda-acciones">
              <a href="#" @click.prevent="editar(s)">Editar</a>
              ·
              <a href="#" @click.prevent="alternarActivo(s)">
                {{ s.activo ? 'Desactivar' : 'Activar' }}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.inactivo {
  opacity: 0.55;
}
.desc {
  color: var(--muted);
}
.celda-acciones {
  white-space: nowrap;
  text-align: right;
}
</style>