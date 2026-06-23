/**
 * OT-REPORT-AUTH-URGENTE-001: Manejo de sesión con cookie firmada (httpOnly)
 * Adaptado de rimec-web para Report
 */

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

import { REPORT_SESSION_VERSION } from './constants'

const SESSION_COOKIE = 'report_session'
export { REPORT_SESSION_VERSION }

function getSecret() {
  if (!process.env.REPORT_SESSION_SECRET) {
    throw new Error('REPORT_SESSION_SECRET no está configurada - requerida para firmar sesiones')
  }
  return new TextEncoder().encode(process.env.REPORT_SESSION_SECRET)
}

export interface SessionData {
  id_usuario: number
  name: string
  role: string
  rol_id: number
  session_version?: number
}

/**
 * Crear cookie de sesión firmada
 */
export async function createSession(data: SessionData): Promise<void> {
  const SECRET = getSecret()
  const token = await new SignJWT({ ...data, session_version: REPORT_SESSION_VERSION } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: '/',
  })
}

/**
 * Leer sesión actual desde cookie
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value

    if (!token) return null

    const SECRET = getSecret()
    const { payload } = await jwtVerify(token, SECRET)

    if (payload.session_version !== REPORT_SESSION_VERSION) return null

    return {
      id_usuario: payload.id_usuario as number,
      name: payload.name as string,
      role: payload.role as string,
      rol_id: (payload.rol_id as number) || 0,
      session_version: payload.session_version as number,
    }
  } catch {
    return null
  }
}

/**
 * Borrar cookie de sesión
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
