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
  return `${limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${limpio.slice(-1)}`
}

function rutValido(rut) {
  const limpio = limpiarRut(rut)
  return /^\d{7,8}[0-9K]$/.test(limpio)
}

function telefonoValido(tel) {
  const digitos = String(tel ?? '').replace(/\D/g, '')
  return digitos.length >= 8 && digitos.length <= 12
}

function correoValido(correo) {
  return !correo || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
}

function ocultarDatosMecanico(cliente, esDueno) {
  return esDueno ? cliente : { ...cliente, rut: null, correo: null }
}

router.get('/', verificarToken, async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  const esDueno = req.perfil?.rol === 'dueno'
  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        ...(esDueno ? {} : { registradoPorId: req.perfil.id }),
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { rut: { contains: q, mode: 'insensitive' } },
                { telefono: { contains: q } },
                { correo: { contains: q, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      include: { _count: { select: { vehiculos: true } } },
      orderBy: { nombre: 'asc' }
    })
    res.json(clientes.map((c) => ocultarDatosMecanico(c, esDueno)))
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron obtener los clientes' })
  }
})

router.get('/rut/:rut', verificarToken, async (req, res) => {
  const rut = formatearRut(req.params.rut)
  if (!rutValido(rut)) return res.status(400).json({ error: 'RUT invalido' })
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { rut },
      select: { id: true, nombre: true, telefono: true, rut: true, registradoPorId: true }
    })
    if (!cliente) return res.status(404).json({ error: 'No existe un cliente con ese RUT' })
    const { registradoPorId, ...datosCliente } = cliente
    if (req.perfil?.rol !== 'dueno' && registradoPorId !== req.perfil.id) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.json(ocultarDatosMecanico(datosCliente, req.perfil?.rol === 'dueno'))
  } catch (e) {
    res.status(500).json({ error: 'No se pudo buscar el cliente' })
  }
})

router.get('/:id', verificarToken, async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(req.params.id) },
      include: { vehiculos: { orderBy: { creadoEn: 'desc' } } }
    })
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    if (req.perfil?.rol !== 'dueno' && cliente.registradoPorId !== req.perfil.id) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.json(ocultarDatosMecanico(cliente, req.perfil?.rol === 'dueno'))
  } catch (e) {
    res.status(500).json({ error: 'No se pudo obtener el cliente' })
  }
})

router.post('/', verificarToken, async (req, res) => {
  const { nombre, rut, telefono, correo } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (rut && !rutValido(rut)) return res.status(400).json({ error: 'RUT invalido' })
  if (!telefonoValido(telefono)) return res.status(400).json({ error: 'Telefono invalido' })
  if (!correoValido(correo)) return res.status(400).json({ error: 'Correo invalido' })

  try {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        rut: rut ? formatearRut(rut) : null,
        telefono: String(telefono).trim(),
        correo: correo?.trim() || null,
        registradoPorId: req.perfil?.rol === 'dueno' ? null : req.perfil.id
      }
    })
    res.status(201).json(ocultarDatosMecanico(cliente, req.perfil?.rol === 'dueno'))
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Ya existe un cliente con ese RUT' })
    res.status(500).json({ error: 'No se pudo registrar el cliente' })
  }
})

router.delete('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Cliente invalido' })

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        rut: true,
        registradoPorId: true,
        vehiculos: {
          select: {
            id: true,
            _count: { select: { ordenesTrabajo: true, presupuestos: true } }
          }
        }
      }
    })
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    if (req.perfil.rol !== 'dueno' && cliente.registradoPorId !== req.perfil.id) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }

    const ordenes = cliente.vehiculos.reduce((total, v) => total + v._count.ordenesTrabajo, 0)
    const presupuestos = cliente.vehiculos.reduce((total, v) => total + v._count.presupuestos, 0)
    const forzar = String(req.query.force).toLowerCase() === 'true'
    if ((ordenes > 0 || presupuestos > 0) && !forzar) {
      return res.status(409).json({
        error: 'El cliente tiene historial asociado',
        codigo: 'CLIENTE_CON_HISTORIAL',
        ordenes,
        presupuestos,
        requiereConfirmacion: true
      })
    }

    await prisma.$transaction(async (tx) => {
      const vehiculoIds = cliente.vehiculos.map((v) => v.id)
      const ordenesCliente = await tx.ordenTrabajo.findMany({
        where: { vehiculoId: { in: vehiculoIds } },
        select: { id: true }
      })
      const ordenIds = ordenesCliente.map((o) => o.id)
      const presupuestosCliente = await tx.presupuesto.findMany({
        where: { vehiculoId: { in: vehiculoIds } },
        select: { id: true }
      })
      const presupuestoIds = presupuestosCliente.map((p) => p.id)

      if (presupuestoIds.length) {
        await tx.presupuestoDetalle.deleteMany({ where: { presupuestoId: { in: presupuestoIds } } })
        await tx.presupuesto.deleteMany({ where: { id: { in: presupuestoIds } } })
      }
      if (ordenIds.length) {
        const pagos = await tx.pago.findMany({ where: { ordenId: { in: ordenIds } }, select: { id: true } })
        const pagoIds = pagos.map((p) => p.id)
        if (pagoIds.length) await tx.comprobante.deleteMany({ where: { pagoId: { in: pagoIds } } })
        await tx.pago.deleteMany({ where: { id: { in: pagoIds } } })
        await tx.movimientoInventario.deleteMany({ where: { ordenId: { in: ordenIds } } })
        await tx.ordenEstadoHistorial.deleteMany({ where: { ordenId: { in: ordenIds } } })
        await tx.notificacion.deleteMany({ where: { ordenId: { in: ordenIds } } })
        await tx.ordenProducto.deleteMany({ where: { ordenId: { in: ordenIds } } })
        await tx.ordenServicio.deleteMany({ where: { ordenId: { in: ordenIds } } })
        await tx.ordenTrabajo.deleteMany({ where: { id: { in: ordenIds } } })
      }
      if (cliente.rut) {
        await tx.perfil.updateMany({ where: { clienteRut: cliente.rut }, data: { clienteRut: null } })
      }
      await tx.notificacion.deleteMany({ where: { clienteId: id } })
      await tx.vehiculo.deleteMany({ where: { clienteId: id } })
      await tx.cliente.delete({ where: { id } })
    })

    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo eliminar el cliente' })
  }
})

export default router
