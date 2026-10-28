import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '../lib/prisma.js'

const issuer = `https://${process.env.AUTH0_DOMAIN}/`
const JWKS = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`))

const TTL_MS = 5 * 60 * 1000
const cachePerfiles = new Map()

export function invalidarPerfil(id) {
  cachePerfiles.delete(id)
}

async function obtenerPerfil(id, email, emailVerificado) {
  const enCache = cachePerfiles.get(id)
  if (enCache && enCache.expira > Date.now()) return enCache.perfil

  let perfil = await prisma.perfil.findUnique({ where: { id } })

  // Personal dado de alta manualmente: se enlaza por correo (solo si el correo está verificado)
  if (!perfil && email && emailVerificado) {
    const existente = await prisma.perfil.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, rol: { not: 'cliente' } }
    })
    if (existente) {
      perfil = await prisma.perfil.update({ where: { id: existente.id }, data: { id } })
    }
  }

  if (perfil) cachePerfiles.set(id, { perfil, expira: Date.now() + TTL_MS })
  return perfil
}

// Valida el token y carga el perfil (req.perfil puede ser null)
export async function identificar(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  let payload
  try {
    ;({ payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: process.env.AUTH0_AUDIENCE
    }))
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' })
  }

  try {
    const id = payload.sub
    const email = payload['https://serviteca/email']?.toLowerCase() ?? null
    const emailVerificado = payload['https://serviteca/email_verified'] === true

    req.auth = { id, email }
    req.perfil = await obtenerPerfil(id, email, emailVerificado)
    next()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Error al verificar el usuario' })
  }
}

// Solo administradores / trabajadores
export function soloPersonal(req, res, next) {
  if (!req.perfil || req.perfil.rol === 'cliente') {
    return res.status(403).json({
      error: 'Tu cuenta no está autorizada para usar el sistema',
      codigo: 'NO_AUTORIZADO'
    })
  }
  req.usuario = { id: req.perfil.id, email: req.perfil.email, rol: req.perfil.rol }
  next()
}

// Solo clientes con cuenta vinculada a un RUT
export function soloCliente(req, res, next) {
  if (!req.perfil || req.perfil.rol !== 'cliente' || !req.perfil.clienteRut) {
    return res.status(403).json({
      error: 'Debes vincular tu cuenta con tu RUT',
      codigo: 'SIN_VINCULAR'
    })
  }
  req.cliente = { rut: req.perfil.clienteRut }
  next()
}

// Se mantiene el nombre para no tocar las rutas del personal
export const verificarToken = [identificar, soloPersonal]