import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '../lib/prisma.js'

const issuer = `https://${process.env.AUTH0_DOMAIN}/`
const JWKS = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`))

export async function verificarToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: process.env.AUTH0_AUDIENCE
    })

    const id = payload.sub
    const email = payload['https://serviteca/email']?.toLowerCase() ?? null
    const nombre = payload['https://serviteca/name'] ?? null

    let perfil = await prisma.perfil.findUnique({ where: { id } })

    if (!perfil && email) {
      const existente = await prisma.perfil.findFirst({ where: { email } })
      if (existente) {
        perfil = await prisma.perfil.update({ where: { id: existente.id }, data: { id } })
      }
    }

    if (!perfil) {
      perfil = await prisma.perfil.upsert({
        where: { id },
        update: {},
        create: { id, email, nombre }
      })
    }

    req.usuario = { id: perfil.id, email: perfil.email, rol: perfil.rol }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}