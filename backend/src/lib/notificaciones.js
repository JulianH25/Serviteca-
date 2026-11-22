const MENSAJES = {
  RECEPCIONADO: (p) => `Recibimos tu vehículo ${p}. Su ingreso quedó registrado en la serviteca.`,
  EN_PROCESO: (p) => `Tu vehículo ${p} está en proceso de trabajo.`,
  TERMINADO: (p) => `Tu vehículo ${p} está listo. Puedes pasar a retirarlo.`,
  ENTREGADO: (p) => `Entregamos tu vehículo ${p}. ¡Gracias por confiar en nosotros!`,
  CANCELADO: (p) => `La orden de trabajo de tu vehículo ${p} fue cancelada.`
}

export function mensajeEstado(patente, estado) {
  const fn = MENSAJES[estado]
  return fn ? fn(patente) : `El estado de tu vehículo ${patente} cambió a ${estado}.`
}

// Crea la notificación para el cliente dueño del vehículo (dentro de una transacción)
export async function notificarEstado(tx, { ordenId, clienteId, patente, estado }) {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
  if (!cliente) return null
  return tx.notificacion.create({
    data: {
      ordenId,
      clienteId: cliente.id,
      canal: 'PORTAL',
      mensaje: mensajeEstado(patente, estado),
      enviadaEn: new Date()
    }
  })
}
