/**
 * OT-REPORT-AUTH-URGENTE-001: API route logout
 */

import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'

export async function POST() {
  try {
    await destroySession()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /auth/logout] Error:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
