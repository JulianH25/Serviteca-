<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { productosApi, categoriasApi, mensajeError } from '@/services/api'

const router = useRouter()
const form = reactive({
  nombre: '',
  codigo: '',
  categoriaId: '',
  costo: 0,
  precioVenta: '',
  stockActual: 0,
  stockMinimo: 0
})
const tocado = ref(false)
const categorias = ref([])
const nuevaCategoria = ref('')
const enviando = ref(false)
const error = ref('')

const entero = (v) => v !== '' && v !== null && Number.isInteger(Number(v)) && Number(v) >= 0

const errores = computed(() => ({
  nombre: !form.nombre.trim() ? 'El nombre es obligatorio' : '',
  precioVenta: !entero(form.precioVenta) ? 'Precio de venta inválido' : '',
  costo: !entero(form.costo) ? 'Costo inválido' : '',
  stockActual: !entero(form.stockActual) ? 'Stock inválido' : '',
  stockMinimo: !entero(form.stockMinimo) ? 'Stock mínimo inválido' : ''
}))

const formValido = computed(() => Object.values(errores.value).every((m) => !m))

async function agregarCategoria() {
  const nombre = nuevaCategoria.value.trim()
  if (!nombre) return
  error.value = ''
  try {
    const c = await categoriasApi.crear(nombre)
    categorias.value = [...categorias.value, c].sort((a, b) => a.nombre.localeCompare(b.nombre))
    form.categoriaId = c.id
    nuevaCategoria.value = ''
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo crear la categoría')
  }
}

async function guardar() {
  tocado.value = true
  if (!formValido.value) return

  enviando.value = true
  error.value = ''
  try {
    const p = await productosApi.crear({
      nombre: form.nombre.trim(),
      codigo: form.codigo.trim(),
      categoriaId: form.categoriaId || null,
      costo: Number(form.costo),
      precioVenta: Number(form.precioVenta),
      stockActual: Number(form.stockActual),
      stockMinimo: Number(form.stockMinimo)
    })
    router.push(`/productos/${p.id}`)
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo registrar el producto')
  } finally {
    enviando.value = false
  }
}

onMounted(async () => {
  try {
    categorias.value = await categoriasApi.listar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar las categorías')
  }
})
</script>

<template>
  <h1>Registrar producto</h1>
  <p class="subtitulo">Si indicas stock inicial, queda registrado como una entrada de inventario</p>

  <form class="card" novalidate @submit.prevent="guardar">
    <div class="form-grid">
      <div class="campo">
        <label for="nombre">Nombre *</label>
        <input
          id="nombre"
          v-model="form.nombre"
          maxlength="120"
          :class="{ invalido: tocado && errores.nombre }"
        />
        <small v-if="tocado && errores.nombre" class="error">{{ errores.nombre }}</small>
      </div>

      <div class="campo">
        <label for="codigo">Código</label>
        <input id="codigo" v-model="form.codigo" maxlength="30" placeholder="ACE-001" />
      </div>

      <div class="campo">
        <label for="categoria">Categoría</label>
        <select id="categoria" v-model="form.categoriaId">
          <option value="">Sin categoría</option>
          <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <div class="nueva-cat">
          <input
            v-model="nuevaCategoria"
            maxlength="60"
            placeholder="Nueva categoría"
            @keydown.enter.prevent="agregarCategoria"
          />
          <button type="button" class="btn btn-secundario" @click="agregarCategoria">Crear</button>
        </div>
      </div>

      <div class="campo">
        <label for="costo">Costo (CLP)</label>
        <input
          id="costo"
          v-model.number="form.costo"
          type="number"
          min="0"
          :class="{ invalido: tocado && errores.costo }"
        />
        <small v-if="tocado && errores.costo" class="error">{{ errores.costo }}</small>
      </div>

      <div class="campo">
        <label for="precio">Precio de venta (CLP) *</label>
        <input
          id="precio"
          v-model.number="form.precioVenta"
          type="number"
          min="0"
          :class="{ invalido: tocado && errores.precioVenta }"
        />
        <small v-if="tocado && errores.precioVenta" class="error">{{ errores.precioVenta }}</small>
      </div>

      <div class="campo">
        <label for="stock">Stock inicial</label>
        <input
          id="stock"
          v-model.number="form.stockActual"
          type="number"
          min="0"
          :class="{ invalido: tocado && errores.stockActual }"
        />
        <small v-if="tocado && errores.stockActual" class="error">{{ errores.stockActual }}</small>
      </div>

      <div class="campo">
        <label for="minimo">Stock mínimo (alerta)</label>
        <input
          id="minimo"
          v-model.number="form.stockMinimo"
          type="number"
          min="0"
          :class="{ invalido: tocado && errores.stockMinimo }"
        />
        <small v-if="tocado && errores.stockMinimo" class="error">{{ errores.stockMinimo }}</small>
      </div>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="acciones">
      <button type="submit" class="btn btn-primario" :disabled="enviando">
        {{ enviando ? 'Guardando...' : 'Guardar producto' }}
      </button>
      <button type="button" class="btn btn-secundario" @click="router.back()">Cancelar</button>
    </div>
  </form>
</template>

<style scoped>
.nueva-cat {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.nueva-cat input {
  flex: 1;
  min-width: 0;
}
</style>