<script setup>
import { ref, onMounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { productosApi, categoriasApi, mensajeError } from '@/services/api'
import { formatearPesos } from '@/utils/validaciones'

const route = useRoute()
const router = useRouter()

const productos = ref([])
const categorias = ref([])
const busqueda = ref('')
const categoriaId = ref('')
const soloBajo = ref(route.query.stockBajo === 'true')
const cargando = ref(true)
const error = ref('')

const esBajo = (p) => p.stockActual <= p.stockMinimo

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    productos.value = await productosApi.listar({
      q: busqueda.value.trim(),
      categoriaId: categoriaId.value || undefined,
      stockBajo: soloBajo.value ? true : undefined
    })
  } catch (e) {
    error.value = mensajeError(e, 'No se pudo cargar el inventario')
  } finally {
    cargando.value = false
  }
}

let timer
watch([busqueda, categoriaId, soloBajo], () => {
  clearTimeout(timer)
  timer = setTimeout(cargar, 300)
})

onMounted(async () => {
  try {
    categorias.value = await categoriasApi.listar()
  } catch (e) {
    error.value = mensajeError(e, 'No se pudieron cargar las categorías')
  }
  cargar()
})
</script>

<template>
  <div class="encabezado">
    <div>
      <h1>Inventario</h1>
      <p class="subtitulo">Productos, stock y alertas de stock bajo</p>
    </div>
    <RouterLink to="/productos/nuevo" class="btn btn-primario">+ Nuevo producto</RouterLink>
  </div>

  <div class="card">
    <div class="filtros">
      <input v-model="busqueda" class="buscador" placeholder="Buscar por nombre o código..." />
      <select v-model="categoriaId">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
      <label class="check">
        <input v-model="soloBajo" type="checkbox" />
        Solo stock bajo
      </label>
    </div>

    <p v-if="error" class="alerta alerta-error">{{ error }}</p>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>Mínimo</th>
            <th>Precio venta</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="cargando">
            <td colspan="6" class="vacio">Cargando...</td>
          </tr>
          <tr v-else-if="!productos.length">
            <td colspan="6" class="vacio">No hay productos para mostrar</td>
          </tr>
          <tr
            v-for="p in productos"
            v-else
            :key="p.id"
            class="fila"
            :class="{ inactivo: !p.activo }"
            @click="router.push(`/productos/${p.id}`)"
          >
            <td>{{ p.codigo || '—' }}</td>
            <td>
              <strong>{{ p.nombre }}</strong>
              <small v-if="!p.activo" class="desc"> (inactivo)</small>
            </td>
            <td>{{ p.categoria?.nombre || '—' }}</td>
            <td>
              <span class="stock" :class="{ bajo: esBajo(p) }">{{ p.stockActual }}</span>
              <small v-if="esBajo(p)" class="alerta-texto"> ⚠ Stock bajo</small>
            </td>
            <td>{{ p.stockMinimo }}</td>
            <td>{{ formatearPesos(p.precioVenta) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1rem;
}
.filtros .buscador {
  flex: 1;
  min-width: 220px;
  margin-bottom: 0;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}
.fila {
  cursor: pointer;
}
.inactivo {
  opacity: 0.55;
}
.desc {
  color: var(--muted);
}
.stock {
  font-weight: 700;
}
.stock.bajo,
.alerta-texto {
  color: #b91c1c;
}
</style>