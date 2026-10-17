import { Router } from 'express'
import { verificarToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const limpiarPatente = (p) => String(p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
const patenteValida = (p) => /^[A-Z]{4}\d{2}$/.test(p) || /^[A-Z]{2}\d{4}$/.test(p)

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

// Listar / buscar
router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: q
        ? {
            OR: [
              { patente: { contains: limpiarPatente(q) || q, mode: 'insensitive' } },
              { marca: { contains: q, mode: 'insensitive' } },
              { modelo: { contains: q, mode: 'insensitive' } },
              { clienteRut: { contains: q, mode: 'insensitive' } },
              { cliente: { nombre: { contains: q, mode: 'insensitive' } } }
            ]
          }
        : undefined,
      include: { cliente: { select: { id: true, nombre: true, rut: true } } },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehículos' })
  }
})

// Vehículos de un cliente (por RUT)
router.get('/cliente/:rut', verificarToken, async (req, res) => {
  const rut = formatearRut(req.params.rut)
  if (!rutValido(rut)) return res.status(400).json({ error: 'RUT inválido' })
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { clienteRut: rut },
      orderBy: { creadoEn: 'desc' }
    })
    res.json(vehiculos)
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los vehículos del cliente' })
  }
})

// Historial de servicios de un vehículo
router.get('/:id/historial', verificarToken, async (req, res) => {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        cliente: true,
        ordenesTrabajo: {
          orderBy: { fechaIngreso: 'desc' },
          include: {
            ordenServicios: { include: { servicio: true } },
            ordenProductos: { include: { producto: true } }
          }
        }
      }
    })
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' })
    res.json(vehiculo)
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el historial' })
  }
})

// Registrar vehículo (asociado por RUT del cliente)
router.post('/', verificarToken, async (req, res) => {
  const { marca, modelo, anio, kilometraje } = req.body
  const patente = limpiarPatente(req.body.patente)
  const clienteRut = formatearRut(req.body.clienteRut)

  if (!rutValido(clienteRut)) return res.status(400).json({ error: 'RUT del cliente inválido' })
  if (!patenteValida(patente)) return res.status(400).json({ error: 'Patente inválida' })
  if (!marca?.trim() || !modelo?.trim()) {
    return res.status(400).json({ error: 'Marca y modelo son obligatorios' })
  }
  if (!Number.isInteger(Number(anio))) return res.status(400).json({ error: 'Año inválido' })

  try {
    const cliente = await prisma.cliente.findUnique({ where: { rut: clienteRut } })
    if (!cliente) {
      return res.status(400).json({ error: 'No existe un cliente con ese RUT. Regístralo primero.' })
    }

    const vehiculo = await prisma.vehiculo.create({
      data: {
        patente,
        marca: marca.trim(),
        modelo: modelo.trim(),
        anio: Number(anio),
        kilometraje: kilometraje == null || kilometraje === '' ? null : Number(kilometraje),
        clienteRut
      }
    })
    res.status(201).json(vehiculo)
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un vehículo con esa patente' })
    if (e.code === 'P2003') return res.status(400).json({ error: 'El cliente no existe' })
    res.status(500).json({ error: 'No se pudo registrar el vehículo' })
  }
})

export default router