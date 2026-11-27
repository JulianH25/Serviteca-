import { Router } from 'express'
import { verificarToken, verificarDueno } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { ocultarRut } from '../lib/datos-sensibles.js'

const router = Router()

function alcanceOrden(id, perfil) {
  return perfil?.rol === 'dueno'
    ? { id }
    : { id, vehiculo: { cliente: { registradoPorId: perfil.id } } }
}

router.get('/:id', verificarToken, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Comprobante no encontrado' })
  try {
    const comprobante = await prisma.comprobante.findUnique({
      where: { id },
      include: {
        pago: { include: { usuario: { select: { nombre: true, email: true } } } }
      }
    })
    if (!comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' })

    const orden = await prisma.ordenTrabajo.findFirst({
      where: alcanceOrden(comprobante.pago.ordenId, req.perfil),
      include: {
        vehiculo: {
          select: {
            patente: true, marca: true, modelo: true,
            cliente: { select: { nombre: true, rut: true } }
          }
        },
        ordenServicios: { include: { servicio: { select: { nombre: true } } } },
        ordenProductos: { include: { producto: { select: { nombre: true } } } }
      }
    })
    if (!orden) return res.status(404).json({ error: 'Comprobante no encontrado' })

    const total =
      orden.ordenServicios.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0) +
      orden.ordenProductos.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
    const agg = await prisma.pago.aggregate({
      where: { ordenId: orden.id },
      _sum: { monto: true }
    })
    const pagado = agg._sum.monto ?? 0

    res.json(ocultarRut({
      ...comprobante,
      orden: { ...orden, total, pagado, saldo: total - pagado }
    }, req.perfil))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el comprobante' })
  }
})

export default router
