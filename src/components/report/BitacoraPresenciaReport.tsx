'use client'

import { useEffect } from 'react'

/** Marca LOGIN/HEARTBEAT en bitácora mientras hay sesión Report. */
export function BitacoraPresenciaReport() {
  useEffect(() => {
    let cancel = false
    const ping = async () => {
      try {
        const me = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        if (!me.ok || cancel) return
        await fetch('/api/auth/bitacora-presencia', {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        /* silencio */
      }
    }
    void ping()
    const t = setInterval(ping, 3 * 60 * 1000)
    return () => {
      cancel = true
      clearInterval(t)
    }
  }, [])
  return null
}
