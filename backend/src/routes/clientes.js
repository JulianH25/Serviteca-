import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

function limpiarRut(rut) {
  return String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase()
}

function formatearRut(rut) {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return limpio
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}

function rutValido(rut) {
  const limpio = limpiarRut(rut)
  if (!/^\d{7,8}[0-9K]$/.test(limpio)) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  let suma = 0
  let multiplo = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo
    multiplo = multiplo === 7 ? 2 : multiplo + 1
  }
  const resto = 11 - (suma % 11)
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === dvEsperado
}

function telefonoValido(tel) {
  const digitos = String(tel ?? '').replace(/\D/g, '')
  return digitos.length >= 8 && digitos.length <= 12
}

function correoValido(correo) {
  return !correo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

// Listar / buscar
router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  try {
    const clientes = await prisma.cliente.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { rut: { contains: q, mode: 'insensitive' } },
              { telefono: { contains: q } },
              { correo: { contains: q, mode: 'insensitive' } }
            ]
          }
        : undefined,
      include: { _count: { select: { vehiculos: true } } },
      orderBy: { nombre: 'asc' }
    })
    res.json(clientes)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los clientes' })
  }
})

// Detalle con sus vehículos
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehiculos: { orderBy: { creadoEn: 'desc' } } }
    })
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(cliente)
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el cliente' })
  }
})

// Registrar cliente
router.post('/', verificarToken, async (req, res) => {
  const { nombre, rut, telefono, correo } = req.body

  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!rutValido(rut)) return res.status(400).json({ error: 'RUT inválido' })
  if (!telefonoValido(telefono)) return res.status(400).json({ error: 'Teléfono inválido' })
  if (!correoValido(correo)) return res.status(400).json({ error: 'Correo inválido' })

  try {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        rut: formatearRut(rut),
        telefono: String(telefono).trim(),
        correo: correo?.trim() || null
      }
    })
    res.status(201).json(cliente)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un cliente con ese RUT' })
    res.status(500).json({ error: 'No se pudo registrar el cliente' })
  }
})

export default router