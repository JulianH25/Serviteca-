<script setup>
import { computed } from 'vue'
import { etiquetaEstado } from '@/utils/ordenes'

const props = defineProps({ estado: { type: String, required: true } })
const texto = computed(() => etiquetaEstado(props.estado))
</script>

<template>
  <span class="badge" :class="`e-${estado}`">{{ texto }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  vertical-align: middle;
  white-space: nowrap;
}
.e-RECEPCIONADO { background: #e0e7ff; color: #3730a3; }
.e-EN_PROCESO { background: #fef3c7; color: #92400e; }
.e-TERMINADO { background: #dcfce7; color: #166534; }
.e-ENTREGADO { background: #e5e7eb; color: #374151; }
.e-CANCELADO { background: #fee2e2; color: #991b1b; }
</style>