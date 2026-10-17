import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import clientesRouter from './routes/clientes.js'
import vehiculosRouter from './routes/vehiculos.js'
import portalRouter from './routes/portal.js'
import { identificar, verificarToken } from './middleware/auth.js'
import { prisma } from './lib/prisma.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true }))

// rol: 'cliente' | rol de personal | null (cuenta sin perfil todavía)
app.get('/api/me', identificar, (req, res) =>
  res.json({ rol: req.perfil?.rol ?? null, email: req.auth.email })
)

app.get('/api/resumen', verificarToken, async (req, res) => {
  try {
    const [clientes, vehiculos] = await Promise.all([
      prisma.cliente.count(),
      prisma.vehiculo.count()
    ])
    res.json({ clientes, vehiculos })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el resumen' })
  }
})

app.use('/api/clientes', clientesRouter)
app.use('/api/vehiculos', vehiculosRouter)
app.use('/api/portal', portalRouter)

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})