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

export async function enviarCorreo({ destino, asunto, texto, html }) {
  const configuracion = obtenerConfiguracion()

  if (!configuracion) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta configurar SMTP_HOST, SMTP_USER, SMTP_PASS y EMAIL_FROM')
    }
    console.warn(`[DESARROLLO] Correo para ${destino}: ${asunto}\n${texto}`)
    return { modo: 'desarrollo' }
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
    subject: asunto,
    text: texto,
    html
  })
  return { modo: 'correo' }
}

export async function enviarCodigoVerificacion({ destino, nombre, codigo }) {
  return enviarCorreo({
    destino,
    asunto: 'Codigo de verificacion de Serviteca',
    texto: `Hola ${nombre}, tu codigo de verificacion es ${codigo}. Tiene una validez de 10 minutos.`,
    html: `<p>Hola ${nombre},</p><p>Tu codigo de verificacion es <strong>${codigo}</strong>.</p><p>Tiene una validez de 10 minutos.</p>`
  })
}

export function asuntoEstadoVehiculo(estado) {
  return estado === 'TERMINADO'
    ? 'Tu vehiculo esta listo para retirar - Serviteca'
    : 'Actualizacion del estado de tu vehiculo - Serviteca'
}

export function prepararCorreoEstado({ destino, nombre, estado, ordenId, mensaje }) {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  return { destino, asunto: asuntoEstadoVehiculo(estado), texto: `${saludo}\n\n${mensaje}\n\nOrden #${ordenId}.\n\nServiteca`, html: `<p>${saludo}</p><p>${mensaje}</p><p><strong>Orden #${ordenId}</strong></p><p>Serviteca</p>` }
}

export async function enviarCorreoEstado({ destino, nombre, patente, estado, ordenId, mensaje }) {
  return enviarCorreo(prepararCorreoEstado({ destino, nombre, estado, ordenId, mensaje }))
}

export function prepararComprobantePago({ destino, nombre, numero, monto, metodo, ordenId, patente, total, pagado, saldo, fecha }) {
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'
  const texto = [
    saludo,
    '',
    'Recibimos tu pago en Serviteca.',
    `Comprobante: ${numero}`,
    `Orden: #${ordenId}`,
    `Vehiculo: ${patente}`,
    `Monto pagado: $${monto.toLocaleString('es-CL')}`,
    `Metodo: ${metodo}`,
    `Fecha: ${new Date(fecha).toLocaleString('es-CL')}`,
    `Total de la orden: $${total.toLocaleString('es-CL')}`,
    `Total pagado: $${pagado.toLocaleString('es-CL')}`,
    `Saldo pendiente: $${saldo.toLocaleString('es-CL')}`,
    '',
    'Serviteca'
  ].join('\n')
  const html = `<p>${saludo}</p><p>Recibimos tu pago en Serviteca.</p><ul><li><strong>Comprobante:</strong> ${numero}</li><li><strong>Orden:</strong> #${ordenId}</li><li><strong>Vehiculo:</strong> ${patente}</li><li><strong>Monto pagado:</strong> $${monto.toLocaleString('es-CL')}</li><li><strong>Metodo:</strong> ${metodo}</li><li><strong>Fecha:</strong> ${new Date(fecha).toLocaleString('es-CL')}</li><li><strong>Saldo pendiente:</strong> $${saldo.toLocaleString('es-CL')}</li></ul><p>Serviteca</p>`
  return { destino, asunto: `Comprobante de pago ${numero} - Serviteca`, texto, html }
}

export async function enviarComprobantePago(datos) {
  return enviarCorreo(prepararComprobantePago(datos))
}
