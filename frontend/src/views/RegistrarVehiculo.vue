<script setup>
import { ref } from 'vue'
import { api } from '@/services/api'

const patente = ref('')
const marca = ref('')
const modelo = ref('')
const anio = ref('')
const clienteId = ref('')
const mensaje = ref('')

async function registrar() {
  try {
    await api.post('/vehiculos', {
      patente: patente.value,
      marca: marca.value,
      modelo: modelo.value,
      anio: Number(anio.value),
      clienteId: Number(clienteId.value)
    })
    mensaje.value = 'Vehículo registrado con éxito'
  } catch (e) {
    mensaje.value = 'Error al registrar'
  }
}
</script>

<template>
  <form @submit.prevent="registrar">
    <input v-model="patente" placeholder="Patente" required />
    <input v-model="marca" placeholder="Marca" required />
    <input v-model="modelo" placeholder="Modelo" required />
    <input v-model="anio" type="number" placeholder="Año" required />
    <input v-model="clienteId" type="number" placeholder="ID Cliente" required />
    <button type="submit">Registrar</button>
    <p>{{ mensaje }}</p>
  </form>
</template>