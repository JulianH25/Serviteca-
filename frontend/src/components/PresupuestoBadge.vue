<script setup>
import { computed } from 'vue'
import { etiquetaPresupuesto } from '@/utils/presupuestos'

const props = defineProps({ estado: { type: String, required: true } })
const texto = computed(() => etiquetaPresupuesto(props.estado))
</script>

<template>
  <span class="badge" :class="`p-${estado}`">{{ texto }}</span>
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
.p-PENDIENTE { background: #fef3c7; color: #92400e; }
.p-APROBADO { background: #dcfce7; color: #166534; }
.p-RECHAZADO { background: #fee2e2; color: #991b1b; }
.p-VENCIDO { background: #e5e7eb; color: #374151; }
</style>
