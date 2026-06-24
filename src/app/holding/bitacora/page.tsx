'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { NexusHeaderZen } from '@/components/report/NexusHeaderZen'
import { ReportFooter } from '@/components/report/ReportFooter'
import type { BitacoraRow, PpLogRow, UsuarioHoldingRow } from '@/lib/holding/bitacora'

export default function HoldingBitacoraPage() {
  const [flujo, setFlujo] = useState<BitacoraRow[]>([])
  const [ppLog, setPpLog] = useState<PpLogRow[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioHoldingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const [bRes, uRes] = await Promise.all([
      fetch('/api/holding/bitacora'),
      fetch('/api/holding/usuarios'),
    ])
    if (bRes.status === 403 || uRes.status === 403) {
      setError('Acceso denegado — solo holding (rol_id=1).')
      return
    }
    if (!bRes.ok || !uRes.ok) {
      setError('Error cargando bitácora.')
      return
    }
    const bJson = await bRes.json()
    const uJson = await uRes.json()
    setFlujo(bJson.flujo || [])
    setPpLog(bJson.pp_log || [])
    setUsuarios(uJson.usuarios || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleBloqueo(u: UsuarioHoldingRow) {
    setBusy(u.id_usuario)
    const bloquear = !u.bloqueado
    const motivo = motivos[u.id_usuario] || ''
    const res = await fetch('/api/holding/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario: u.id_usuario, bloquear, motivo }),
    })
    setBusy(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Error al bloquear/desbloquear')
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <NexusHeaderZen active="home" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-rimec-azul-dark">Bitácora holding</h1>
          <p className="text-sm text-gray-600 mt-1">
            Cierre post-COMPRA · trazabilidad por usuario · bloqueo inmediato.
            Protocolo P8–P11 activo.
          </p>
          <Link href="/" className="text-sm text-rimec-azul hover:underline">
            ← Hub Report
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">Usuarios</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2">Usuario</th>
                  <th className="p-2">Rol</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Motivo / acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id_usuario} className="border-b last:border-0">
                    <td className="p-2 font-medium">{u.descp_usuario}</td>
                    <td className="p-2">{u.rol_id} · {u.categoria}</td>
                    <td className="p-2">
                      {u.bloqueado ? (
                        <span className="text-red-600 font-semibold">BLOQUEADO</span>
                      ) : (
                        <span className="text-green-700">Activo</span>
                      )}
                    </td>
                    <td className="p-2 flex flex-wrap gap-2 items-center">
                      {!u.bloqueado && (
                        <input
                          className="border rounded px-2 py-1 text-xs min-w-[160px]"
                          placeholder="Motivo bloqueo…"
                          value={motivos[u.id_usuario] || ''}
                          onChange={(e) =>
                            setMotivos((m) => ({ ...m, [u.id_usuario]: e.target.value }))
                          }
                        />
                      )}
                      <button
                        type="button"
                        disabled={busy === u.id_usuario}
                        onClick={() => toggleBloqueo(u)}
                        className={`text-xs px-3 py-1 rounded font-semibold ${
                          u.bloqueado
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                      </button>
                      {u.bloqueado_motivo && (
                        <span className="text-xs text-gray-500">{u.bloqueado_motivo}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">
            flujo_auditoria (reciente)
          </h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Entidad</th>
                  <th className="p-2">Acción</th>
                  <th className="p-2">Estados</th>
                  <th className="p-2">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {flujo.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{r.created_at?.slice(0, 19)}</td>
                    <td className="p-2">{r.entidad} #{r.entidad_id}</td>
                    <td className="p-2 font-mono">{r.accion}</td>
                    <td className="p-2">{r.estado_antes} → {r.estado_despues}</td>
                    <td className="p-2">{r.descp_usuario || r.usuario_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">
            pedido_proveedor_log
          </h2>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">PP</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Usuario</th>
                  <th className="p-2">Obs</th>
                </tr>
              </thead>
              <tbody>
                {ppLog.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.timestamp?.slice(0, 19)}</td>
                    <td className="p-2">#{r.pp_id}</td>
                    <td className="p-2">{r.estado_anterior} → {r.estado_nuevo}</td>
                    <td className="p-2">{r.descp_usuario || '—'}</td>
                    <td className="p-2">{r.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <ReportFooter />
    </div>
  )
}
