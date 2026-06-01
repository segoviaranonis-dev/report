/**
 * OT-REPORT-AUTH-URGENTE-001: Valida credenciales contra usuario_v2 (server-side).
 * Réplica de control_central/core/auth.py:AuthManager.login (Nexus).
 * Adaptado de rimec-web para Report.
 *
 * Requiere DATABASE_URL: conexión directa PostgreSQL para leer usuario_v2.
 * SECURITY: Usa bcrypt para verificar contraseñas hasheadas.
 */

import { getRimecPool } from '@/lib/rimec/pool'
import bcrypt from 'bcryptjs'

export interface UsuarioValidado {
  id_usuario: number
  descp_usuario: string
  categoria: string
}

const ROLE_MAP: Record<string, string> = {
  DIRECTOR: 'ADMIN',
  ROOT: 'ADMIN',
  ADMINISTRADOR: 'ADMIN',
  GERENTE: 'ADMIN',
}

function normalizarRol(rawRole: string): string {
  const r = rawRole.toUpperCase().trim()
  return ROLE_MAP[r] ?? r
}

export async function validateUsuario(
  usuario: string,
  password: string,
): Promise<UsuarioValidado | null> {
  const userClean = (usuario ?? '').trim()
  const passClean = password ?? ''

  if (!userClean || !passClean) return null

  try {
    const pool = getRimecPool()

    // Query a usuario_v2 desde PostgreSQL
    const result = await pool.query(
      `SELECT id_usuario, descp_usuario, categoria, password, password_hash
       FROM usuario_v2
       WHERE descp_usuario = $1
       LIMIT 1`,
      [userClean]
    )

    if (result.rows.length === 0) {
      console.warn(`[validateUsuario] Usuario '${userClean}' no encontrado`)
      return null
    }

    const data = result.rows[0]
    const passwordHash = data.password_hash
    const passwordPlain = data.password

    // SECURITY: Verificar con bcrypt si existe hash
    if (passwordHash) {
      const valid = await bcrypt.compare(passClean, passwordHash)
      if (!valid) {
        console.warn(`[validateUsuario] Contraseña incorrecta para '${userClean}'`)
        return null
      }
    }
    // FALLBACK temporal: Si no hay hash, verificar contra texto plano
    else if (passwordPlain === passClean) {
      console.warn(`[validateUsuario] Usuario '${userClean}' usando password legacy - actualizando...`)
      // Actualizar a hash
      const hashNew = await bcrypt.hash(passClean, 10)
      await getRimecPool().query(
        `UPDATE usuario_v2 SET password_hash = $1 WHERE id_usuario = $2`,
        [hashNew, data.id_usuario]
      )
    } else {
      console.warn(`[validateUsuario] Contraseña incorrecta para '${userClean}'`)
      return null
    }

    return {
      id_usuario: data.id_usuario,
      descp_usuario: data.descp_usuario,
      categoria: normalizarRol(String(data.categoria ?? '')),
    }
  } catch (e) {
    console.error('[validateUsuario] excepción:', e)
    return null
  }
}
