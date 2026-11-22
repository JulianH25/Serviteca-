<script setup>
import { computed } from 'vue'
import { FLUJO, etiquetaEstado, fechaHora } from '@/utils/ordenes'

const props = defineProps({
  estado: { type: String, required: true },
  historial: { type: Array, default: () => [] }
})

const cancelado = computed(() => props.estado === 'CANCELADO')
const indice = computed(() => FLUJO.indexOf(props.estado))
const fechas = computed(() => {
  const m = {}
  for (const h of props.historial) m[h.estado] = h.fecha
  return m
})

function clase(i) {
  if (cancelado.value) return fechas.value[FLUJO[i]] ? 'hecho' : ''
  if (i < indice.value) return 'hecho'
  if (i === indice.value) return i === FLUJO.length - 1 ? 'hecho' : 'actual'
  return ''
}
</script>

<template>
  <div>
    <ol class="pasos">
      <li v-for="(e, i) in FLUJO" :key="e" :class="clase(i)">
        <span class="punto">{{ clase(i) === 'hecho' ? '✓' : i + 1 }}</span>
        <span class="texto">{{ etiquetaEstado(e) }}</span>
        <small v-if="fechas[e]">{{ fechaHora(fechas[e]) }}</small>
      </li>
    </ol>
    <p v-if="cancelado" class="alerta alerta-error" style="margin-top: 1rem">
      Esta orden fue cancelada<template v-if="fechas.CANCELADO"> el {{ fechaHora(fechas.CANCELADO) }}</template>.
    </p>
  </div>
</template>

<style scoped>
.pasos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.pasos li {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.35rem;
  color: var(--muted);
  position: relative;
}

.pasos li:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 14px;
  left: calc(50% + 18px);
  width: calc(100% - 36px);
  height: 2px;
  background: var(--border);
}

.pasos li.hecho:not(:last-child)::after {
  background: var(--primary);
}

.punto {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  background: var(--border);
  color: var(--muted);
  position: relative;
  z-index: 1;
}

.hecho .punto {
  background: var(--primary);
  color: #fff;
}

.actual .punto {
  background: #fff;
  color: var(--primary);
  border: 2px solid var(--primary);
}

.actual .texto {
  color: var(--text);
  font-weight: 700;
}

.texto {
  font-size: 0.85rem;
}

small {
  font-size: 0.72rem;
}

@media (max-width: 600px) {
  .pasos {
    grid-template-columns: 1fr;
  }
  .pasos li {
    flex-direction: row;
    text-align: left;
    gap: 0.75rem;
  }
  .pasos li::after {
    display: none;
  }
}
</style>