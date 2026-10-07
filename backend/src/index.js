import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import vehiculosRouter from './routes/vehiculos.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/vehiculos', vehiculosRouter)

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})