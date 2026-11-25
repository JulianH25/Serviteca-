import nodemailer from 'nodemailer'

function obtenerConfiguracion() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const remitente = process.env.EMAIL_FROM || user

  if (!host || !user || !pass || !remitente) return null
  return { host, port, user, pass, remitente }
}

export async function enviarCodigoVerificacion({ destino, nombre, codigo }) {
  const configuracion = obtenerConfiguracion()

  if (!configuracion) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta configurar SMTP_HOST, SMTP_USER, SMTP_PASS y EMAIL_FROM')
    }
    console.warn(`[DESARROLLO] Codigo de verificacion para ${destino}: ${codigo}`)
    return { modo: 'desarrollo', codigo }
  }

  const transporter = nodemailer.createTransport({
    host: configuracion.host,
    port: configuracion.port,
    secure: configuracion.port === 465,
    auth: { user: configuracion.user, pass: configuracion.pass }
  })

  await transporter.sendMail({
    from: configuracion.remitente,
    to: destino,
    subject: 'Codigo de verificacion de Serviteca',
    text: `Hola ${nombre}, tu codigo de verificacion es ${codigo}. Tiene una validez de 10 minutos.`
  })

  return { modo: 'correo' }
}
