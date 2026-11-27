import { Router } from 'express'
import { verificarDueno } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const suma = (l) => l.reduce((s, x) => s + x.cantidad * x.precioUnitario, 0)
const ACTIVOS = ['RECEPCIONADO', 'EN_PROCESO', 'TERMINADO']

function filtroFecha(q) {
  const f = {}
  if (q.desde) {
    const d = new Date(`${q.desde}T00:00:00`)
    if (isNaN(d)) return null
    f.gte = d
  }
  if (q.hasta) {
    const h = new Date(`${q.hasta}T23:59:59.999`)
    if (isNaN(h)) return null
    f.lte = h
  }
  return f
}

const incluirOrden = {
  vehiculo: {
    select: {
      id: true,
      patente: true,
      marca: true,
      modelo: true,
      anio: true,
      cliente: { select: { id: true, nombre: true, rut: true, telefono: true, correo: true } }
    }
  },
  usuario: { select: { id: true, nombre: true, email: true, rol: true } },
  ordenServicios: { include: { servicio: { select: { nombre: true } } } },
  ordenProductos: { include: { producto: { select: { nombre: true } } } },
  pagos: { select: { id: true, monto: true, metodo: true, fecha: true }, orderBy: { fecha: 'asc' } }
}

function armarOrden(o) {
  const total = suma(o.ordenServicios) + suma(o.ordenProductos)
  const pagado = o.pagos.reduce((s, p) => s + p.monto, 0)
  const cancelada = o.estado === 'CANCELADO'
  return {
    id: o.id,
    estado: o.estado,
    fechaIngreso: o.fechaIngreso,
    fechaEntrega: o.fechaEntrega,
    vehiculo: o.vehiculo ?? null,
    mecanico: o.usuario ?? null,
    servicios: o.ordenServicios.map((s) => ({
      nombre: s.servicio.nombre,
      cantidad: s.cantidad,
      precioUnitario: s.precioUnitario
    })),
    productos: o.ordenProductos.map((p) => ({
      nombre: p.producto.nombre,
      cantidad: p.cantidad,
      precioUnitario: p.precioUnitario
    })),
    total,
    pagado,
    saldo: cancelada ? 0 : Math.max(0, total - pagado),
    pagos: o.pagos
  }
}

// Resumen de todo el personal: clientes, autos y dinero que maneja cada uno
router.get('/personal', verificarDueno, async (req, res) => {
  const fecha = filtroFecha(req.query)
  if (!fecha) return res.status(400).json({ error: 'Rango de fechas inválido' })
  try {
    const [personal, ordenes] = await Promise.all([
      prisma.perfil.findMany({
        where: { rol: { not: 'cliente' } },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          clientesRegistrados: { select: { rut: true, vehiculos: { select: { id: true } } } }
        },
        orderBy: { nombre: 'asc' }
      }),
      prisma.ordenTrabajo.findMany({
        where: Object.keys(fecha).length ? { fechaIngreso: fecha } : undefined,
        select: {
          usuarioId: true,
          estado: true,
          vehiculoId: true,
          vehiculo: { select: { clienteRut: true } },
          ordenServicios: { select: { cantidad: true, precioUnitario: true } },
          ordenProductos: { select: { cantidad: true, precioUnitario: true } },
          pagos: { select: { monto: true } }
        }
      })
    ])

    const mapa = new Map(
      personal.map((p) => [
        p.id,
        {
          ...p,
          ordenes: 0,
          activas: 0,
          vehiculos: new Set(p.clientesRegistrados.flatMap((c) => c.vehiculos.map((v) => v.id))),
          clientes: new Set(p.clientesRegistrados.map((c) => c.rut)),
          vendido: 0,
          cobrado: 0,
          porCobrar: 0
        }
      ])
    )

    for (const o of ordenes) {
      const m = mapa.get(o.usuarioId)
      if (!m) continue
      m.ordenes++
      if (ACTIVOS.includes(o.estado)) m.activas++
      m.vehiculos.add(o.vehiculoId)
      m.clientes.add(o.vehiculo.clienteRut)
      const pagado = o.pagos.reduce((s, p) => s + p.monto, 0)
      m.cobrado += pagado
      if (o.estado !== 'CANCELADO') {
        const total = suma(o.ordenServicios) + suma(o.ordenProductos)
        m.vendido += total
        m.porCobrar += Math.max(0, total - pagado)
      }
    }

    res.json(
      [...mapa.values()].map(({ vehiculos, clientes, clientesRegistrados, ...m }) => ({
        ...m,
        vehiculos: vehiculos.size,
        clientes: clientes.size
      }))
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el personal' })
  }
})

// Detalle de un trabajador: sus órdenes, clientes, autos, servicios y pagos
router.get('/personal/:id', verificarDueno, async (req, res) => {
  const fecha = filtroFecha(req.query)
  if (!fecha) return res.status(400).json({ error: 'Rango de fechas inválido' })
  try {
    const perfil = await prisma.perfil.findFirst({
      where: { id: req.params.id, rol: { not: 'cliente' } },
      select: { id: true, email: true, nombre: true, rol: true }
    })
    if (!perfil) return res.status(404).json({ error: 'Trabajador no encontrado' })

    const ordenesDb = await prisma.ordenTrabajo.findMany({
      where: { usuarioId: perfil.id, ...(Object.keys(fecha).length ? { fechaIngreso: fecha } : {}) },
      orderBy: { fechaIngreso: 'desc' },
      take: 300,
      include: incluirOrden
    })
    const ordenes = ordenesDb.map(armarOrden)

    const vehiculos = new Map()
    const clientes = new Map()
    const clientesRegistrados = await prisma.cliente.findMany({
      where: { registradoPorId: perfil.id },
      select: {
        id: true,
        nombre: true,
        rut: true,
        telefono: true,
        correo: true,
        vehiculos: { select: { id: true, patente: true, marca: true, modelo: true, anio: true } }
      },
      orderBy: { nombre: 'asc' }
    })

    for (const c of clientesRegistrados) {
      clientes.set(c.id, {
        id: c.id,
        nombre: c.nombre,
        rut: c.rut,
        telefono: c.telefono,
        correo: c.correo
      })
      for (const v of c.vehiculos) {
        vehiculos.set(v.id, {
          id: v.id,
          patente: v.patente,
          marca: v.marca,
          modelo: v.modelo,
          anio: v.anio,
          cliente: c.nombre
        })
      }
    }

    for (const o of ordenes) {
      const v = o.vehiculo
      if (!v) continue
      vehiculos.set(v.id, { id: v.id, patente: v.patente, marca: v.marca, modelo: v.modelo, anio: v.anio, cliente: v.cliente.nombre })
      clientes.set(v.cliente.id, v.cliente)
    }

    const validas = ordenes.filter((o) => o.estado !== 'CANCELADO')
    res.json({
      perfil,
      resumen: {
        ordenes: ordenes.length,
        vendido: validas.reduce((s, o) => s + o.total, 0),
        cobrado: ordenes.reduce((s, o) => s + o.pagado, 0),
        porCobrar: validas.reduce((s, o) => s + o.saldo, 0)
      },
      vehiculos: [...vehiculos.values()],
      clientes: [...clientes.values()],
      ordenes
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el detalle del trabajador' })
  }
})

// Clientes con información sensible y dinero asociado: ?q=
router.get('/clientes', verificarDueno, async (req, res) => {
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
      orderBy: { nombre: 'asc' },
      include: {
        perfil: { select: { email: true } },
        registradoPor: { select: { id: true, nombre: true, email: true, rol: true } },
        vehiculos: {
          select: {
            id: true,
            ordenesTrabajo: {
              select: {
                estado: true,
                ordenServicios: { select: { cantidad: true, precioUnitario: true } },
                ordenProductos: { select: { cantidad: true, precioUnitario: true } },
                pagos: { select: { monto: true } }
              }
            }
          }
        }
      }
    })

    res.json(
      clientes.map((c) => {
        let ordenes = 0
        let total = 0
        let pagado = 0
        let saldo = 0
        for (const v of c.vehiculos) {
          for (const o of v.ordenesTrabajo) {
            ordenes++
            const p = o.pagos.reduce((s, x) => s + x.monto, 0)
            pagado += p
            if (o.estado !== 'CANCELADO') {
              const t = suma(o.ordenServicios) + suma(o.ordenProductos)
              total += t
              saldo += Math.max(0, t - p)
            }
          }
        }
        return {
          id: c.id,
          nombre: c.nombre,
          rut: c.rut,
          telefono: c.telefono,
          correo: c.correo,
          cuentaPortal: c.perfil?.email ?? null,
          mecanico: c.registradoPor,
          creadoEn: c.creadoEn,
          vehiculos: c.vehiculos.length,
          ordenes,
          total,
          pagado,
          saldo
        }
      })
    )
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudieron obtener los clientes' })
  }
})

// Detalle de un cliente: datos, autos, órdenes con su trabajador, servicios y pagos
router.get('/clientes/:id', verificarDueno, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Cliente no encontrado' })
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        perfil: { select: { email: true } },
        registradoPor: { select: { id: true, nombre: true, email: true, rol: true } },
        vehiculos: {
          orderBy: { creadoEn: 'desc' },
          include: { ordenesTrabajo: { orderBy: { fechaIngreso: 'desc' }, include: incluirOrden } }
        }
      }
    })
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })

    const vehiculos = cliente.vehiculos.map((v) => ({
      id: v.id,
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      kilometraje: v.kilometraje,
      ordenes: v.ordenesTrabajo.map(armarOrden)
    }))
    const todas = vehiculos.flatMap((v) => v.ordenes)
    const validas = todas.filter((o) => o.estado !== 'CANCELADO')

    res.json({
      id: cliente.id,
      nombre: cliente.nombre,
      rut: cliente.rut,
      telefono: cliente.telefono,
      correo: cliente.correo,
      cuentaPortal: cliente.perfil?.email ?? null,
      mecanico: cliente.registradoPor,
      creadoEn: cliente.creadoEn,
      resumen: {
        total: validas.reduce((s, o) => s + o.total, 0),
        pagado: todas.reduce((s, o) => s + o.pagado, 0),
        saldo: validas.reduce((s, o) => s + o.saldo, 0)
      },
      vehiculos
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'No se pudo obtener el cliente' })
  }
})

export default router
