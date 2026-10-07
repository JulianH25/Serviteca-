import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../prisma.js'

const router = Router()

// Registrar vehículo asociado a un cliente existente
router.post('/', verificarToken, async (req, res) => {
  const { patente, marca, modelo, anio, clienteId } = req.body

  try {
    const vehiculo = await prisma.vehiculo.create({
      data: { patente: String(patente).toUpperCase(), marca, modelo, anio, clienteId }
    })
    res.status(201).json(vehiculo)
  } catch (e) {
    res.status(400).json({ error: 'No se pudo registrar el vehículo (¿patente duplicada o cliente inexistente?)' })
  }
})

// Vehículos de un cliente
router.get('/cliente/:clienteId', verificarToken, async (req, res) => {
  const vehiculos = await prisma.vehiculo.findMany({
    where: { clienteId: Number(req.params.clienteId) }
  })
  res.json(vehiculos)
})

export default router