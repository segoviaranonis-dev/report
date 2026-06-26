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
import { aplicarAccesoCanonicoBzz } from '@/lib/auth/bzz-acceso'

export interface UsuarioValidado {
  id_usuario: number
  descp_usuario: string
  categoria: string
  rol_id: number
  ente_id: number | null
  ente_codigo: number | null
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

/** Algunos hashes legacy se generaron con \\n al final del texto plano. */
async function verificarPasswordHash(
  passTrimmed: string,
  passwordHash: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (await bcrypt.compare(passTrimmed, passwordHash)) {
    return { ok: true, needsRehash: false }
  }
  // Legacy: hash creado desde "password\n" en import/script
  if (passTrimmed && (await bcrypt.compare(`${passTrimmed}\n`, passwordHash))) {
    return { ok: true, needsRehash: true }
  }
  return { ok: false, needsRehash: false }
}

export async function validateUsuario(
  usuario: string,
  password: string,
): Promise<UsuarioValidado | null> {
  const userClean = (usuario ?? '').trim()
  const passClean = (password ?? '').trim()

  if (!userClean || !passClean) return null

  try {
    const pool = getRimecPool()

    // Query a usuario_v2 desde PostgreSQL (incluye rol_id)
    const result = await pool.query(
      `SELECT u.id_usuario, u.descp_usuario, u.categoria, u.password, u.password_hash, u.rol_id,
              u.ente_id, e.codigo AS ente_codigo,
              COALESCE(u.bloqueado, false) AS bloqueado, u.bloqueado_motivo
       FROM usuario_v2 u
       LEFT JOIN entes e ON e.id_ente = u.ente_id
       WHERE LOWER(TRIM(u.descp_usuario)) = LOWER(TRIM($1))
       LIMIT 1`,
      [userClean]
    )

    if (result.rows.length === 0) {
      console.warn(`[validateUsuario] Usuario '${userClean}' no encontrado`)
      return null
    }

    const data = result.rows[0]

    if (data.bloqueado === true) {
      console.warn(`[validateUsuario] Usuario '${userClean}' bloqueado: ${data.bloqueado_motivo || ''}`)
      return null
    }

    const passwordHash = data.password_hash
    const passwordPlain = data.password

    // SECURITY: Verificar con bcrypt si existe hash
    if (passwordHash) {
      const { ok, needsRehash } = await verificarPasswordHash(passClean, passwordHash)
      if (!ok) {
        console.warn(`[validateUsuario] Contraseña incorrecta para '${userClean}'`)
        return null
      }
      if (needsRehash) {
        const hashNew = await bcrypt.hash(passClean, 10)
        await getRimecPool().query(
          `UPDATE usuario_v2 SET password_hash = $1 WHERE id_usuario = $2`,
          [hashNew, data.id_usuario],
        )
        console.warn(`[validateUsuario] Hash reparado (sin \\n) para '${userClean}'`)
      }
    }
    // FALLBACK temporal: Si no hay hash, verificar contra texto plano (ignorar __hash_*)
    else if (
      passwordPlain &&
      !String(passwordPlain).trim().startsWith('__hash_') &&
      String(passwordPlain).trim() === passClean
    ) {
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

    let rolId = Number(data.rol_id) || 0
    let enteCodigo = data.ente_codigo != null ? Number(data.ente_codigo) : null

    const bzz = aplicarAccesoCanonicoBzz(data.descp_usuario, rolId, enteCodigo)
    if (bzz.corregido) {
      rolId = bzz.rol_id
      enteCodigo = bzz.ente_codigo
      console.warn(
        `[validateUsuario] Acceso BZZ corregido '${userClean}': ${bzz.motivo}`,
      )
      try {
        const enteIdRow =
          enteCodigo != null
            ? await pool.query(
                `SELECT id_ente FROM entes WHERE codigo = $1 LIMIT 1`,
                [enteCodigo],
              )
            : { rows: [] as { id_ente: number }[] }
        const enteIdFix = enteIdRow.rows[0]?.id_ente ?? data.ente_id
        await pool.query(
          `UPDATE usuario_v2 SET rol_id = $1, ente_id = $2 WHERE id_usuario = $3`,
          [rolId, enteIdFix, data.id_usuario],
        )
        data.ente_id = enteIdFix
      } catch (fixErr) {
        console.error('[validateUsuario] No se pudo persistir fix BZZ:', fixErr)
      }
    }

    return {
      id_usuario: data.id_usuario,
      descp_usuario: data.descp_usuario,
      categoria: normalizarRol(String(data.categoria ?? '')),
      rol_id: rolId,
      ente_id: data.ente_id != null ? Number(data.ente_id) : null,
      ente_codigo: enteCodigo,
    }
  } catch (e) {
    console.error('[validateUsuario] excepción:', e)
    return null
  }
}
