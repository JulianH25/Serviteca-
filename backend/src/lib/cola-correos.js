import { prisma } from './prisma.js'
import { enviarCorreo } from './correo.js'

const MAX_INTENTOS = 5

export async function encolarCorreo(tx, datos) {
  return tx.correoPendiente.create({ data: datos })
}

export async function procesarCorreos() {
  const pendientes = await prisma.correoPendiente.findMany({
    where: { estado: 'PENDIENTE', proximoIntento: { lte: new Date() } },
    orderBy: { id: 'asc' }, take: 10
  })
  for (const correo of pendientes) {
    const tomado = await prisma.correoPendiente.updateMany({
      where: { id: correo.id, estado: 'PENDIENTE' },
      data: { estado: 'PROCESANDO', intentos: { increment: 1 } }
    })
    if (!tomado.count) continue
    try {
      await enviarCorreo(correo)
      await prisma.correoPendiente.update({ where: { id: correo.id }, data: { estado: 'ENVIADO', enviadoEn: new Date(), ultimoError: null } })
    } catch (e) {
      const intentos = correo.intentos + 1
      await prisma.correoPendiente.update({ where: { id: correo.id }, data: {
        estado: intentos >= MAX_INTENTOS ? 'ERROR' : 'PENDIENTE',
        ultimoError: String(e.message ?? e).slice(0, 1000),
        proximoIntento: new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** intentos * 60 * 1000))
      } })
    }
  }
}

export function iniciarColaCorreos() {
  const ejecutar = () => procesarCorreos().catch((e) => console.error('Error procesando cola de correos:', e))
  ejecutar()
  return setInterval(ejecutar, 60 * 1000)
}
