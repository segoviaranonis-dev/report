'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { NexusHeaderZen } from '@/components/report/NexusHeaderZen'
import { ReportFooter } from '@/components/report/ReportFooter'
import type { BitacoraRow, PpLogRow, UsuarioHoldingRow } from '@/lib/holding/bitacora'
import type { MonitoreoGrupo, SemanaMeta } from '@/lib/holding/bitacora-monitoreo'

function fmtHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19)
  return d.toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Asuncion',
  })
}

export default function HoldingBitacoraPage() {
  const [flujo, setFlujo] = useState<BitacoraRow[]>([])
  const [ppLog, setPpLog] = useState<PpLogRow[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioHoldingRow[]>([])
  const [monitoreo, setMonitoreo] = useState<MonitoreoGrupo[]>([])
  const [semana, setSemana] = useState<SemanaMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [tab, setTab] = useState<'semana' | 'usuarios' | 'forense'>('semana')
  const [filtro, setFiltro] = useState('')

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
    setMonitoreo(bJson.monitoreo || [])
    setSemana(bJson.semana || null)
    setUsuarios(uJson.usuarios || [])
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
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

  const q = filtro.trim().toUpperCase()

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <NexusHeaderZen active="home" />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-rimec-azul-dark">Bitácora</h1>
          <p className="text-sm text-gray-600 mt-1">
            Semana laboral · quién trabajó (sesión) · quién tiene venta activa · Report + RIMEC
            Web.
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

        <div className="flex flex-wrap gap-2 items-center">
          {(
            [
              ['semana', 'Semana L–V'],
              ['usuarios', 'Bloqueo'],
              ['forense', 'Forense'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                tab === id
                  ? 'bg-rimec-azul text-white border-rimec-azul'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          {tab === 'semana' && (
            <input
              className="border rounded-full px-3 py-1 text-xs min-w-[140px]"
              placeholder="Buscar BZZP…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          )}
          <button
            type="button"
            onClick={() => load()}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-white text-slate-700 border-slate-200 ml-auto"
          >
            Actualizar
          </button>
        </div>

        {tab === 'semana' && (
          <div className="space-y-5">
            <p className="text-xs text-slate-500">
              Semana {semana?.lunes || '…'} → {semana?.viernes || '…'} (Asunción) · vacío = no
              entró · ● = online ahora (&lt;10 min)
            </p>
            {monitoreo.length === 0 && (
              <p className="text-sm text-slate-500">Sin usuarios o sin datos aún.</p>
            )}
            {monitoreo.map((g) => {
              const users = g.usuarios.filter(
                (u) =>
                  !q ||
                  u.descp_usuario.toUpperCase().includes(q) ||
                  String(u.id_usuario).includes(q),
              )
              if (q && users.length === 0 && g.bloqueados.every((u) => !u.descp_usuario.toUpperCase().includes(q))) {
                return null
              }
              return (
                <section
                  key={g.key}
                  className="rounded-2xl border border-sky-100 bg-sky-50/50 shadow-sm overflow-hidden"
                >
                  <header className="px-4 py-3 flex flex-wrap items-start justify-between gap-2 border-b border-sky-100">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{g.titulo}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">{g.subtitulo}</p>
                    </div>
                    <span className="text-xs font-bold rounded-full bg-white border border-sky-200 px-2.5 py-1">
                      {users.length} usuarios
                    </span>
                  </header>

                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-xs min-w-[720px]">
                      <thead>
                        <tr className="border-b bg-slate-50 text-left text-slate-500">
                          <th className="p-2 sticky left-0 bg-slate-50 z-10 min-w-[9rem]">
                            Usuario
                          </th>
                          {(semana?.labels || []).map((d) => (
                            <th key={d.clave} className="p-2 font-semibold min-w-[7.5rem]">
                              {d.label}
                              <div className="font-normal text-[10px] text-slate-400">
                                {d.fecha.slice(5)}
                              </div>
                            </th>
                          ))}
                          <th className="p-2 min-w-[6rem]">Ahora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr
                            key={u.id_usuario}
                            className={`border-b last:border-0 ${
                              u.descp_usuario.toUpperCase() === 'BZZP'
                                ? 'bg-amber-50/80'
                                : 'hover:bg-sky-50/40'
                            }`}
                          >
                            <td className="p-2 sticky left-0 bg-inherit z-10">
                              <div className="font-semibold text-sm text-slate-900">
                                <span className="text-slate-400 font-mono text-[10px] mr-1">
                                  #{u.id_usuario}
                                </span>
                                {u.descp_usuario}
                              </div>
                              {u.ente_label && (
                                <div className="text-[10px] text-slate-500">{u.ente_label}</div>
                              )}
                            </td>
                            {u.dias.map((d) => (
                              <td
                                key={d.clave}
                                className={`p-2 align-top ${
                                  d.online
                                    ? 'text-emerald-800 font-medium'
                                    : d.trabajo
                                      ? 'text-slate-800'
                                      : 'text-slate-300'
                                }`}
                              >
                                {d.texto || '—'}
                              </td>
                            ))}
                            <td className="p-2 align-top">
                              {u.online_ahora ? (
                                <span className="text-emerald-700 font-bold">● online</span>
                              ) : u.sesion_hoy ? (
                                <span className="text-slate-600">hoy {fmtHora(u.ultimo_login_at)}</span>
                              ) : (
                                <span className="text-slate-400">off</span>
                              )}
                              {u.venta_activa && (
                                <div className="text-amber-900 font-medium mt-0.5">
                                  venta {u.venta_horas != null ? `${u.venta_horas}h` : 'sí'}
                                  {u.items_carrito > 0 ? ` · ${u.items_carrito} ref` : ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {g.bloqueados.length > 0 && (
                    <div className="border-t border-red-100 bg-red-50/50 px-4 py-2 text-xs text-red-800">
                      Bloqueados:{' '}
                      {g.bloqueados.map((u) => `${u.descp_usuario} (#${u.id_usuario})`).join(', ')}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        {tab === 'usuarios' && (
          <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">Usuarios · bloqueo</h2>
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
                      <td className="p-2">
                        {u.rol_id} · {u.categoria}
                      </td>
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
                            u.bloqueado ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                          }`}
                        >
                          {u.bloqueado ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'forense' && (
          <>
            <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">flujo_auditoria</h2>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-gray-500">
                      <th className="p-2">Fecha</th>
                      <th className="p-2">Entidad</th>
                      <th className="p-2">Acción</th>
                      <th className="p-2">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flujo.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2 whitespace-nowrap">{r.created_at?.slice(0, 19)}</td>
                        <td className="p-2">
                          {r.entidad} #{r.entidad_id}
                        </td>
                        <td className="p-2 font-mono">{r.accion}</td>
                        <td className="p-2">{r.descp_usuario || r.usuario_id || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <h2 className="px-4 py-3 font-semibold border-b bg-slate-50">pedido_proveedor_log</h2>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {ppLog.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">{r.timestamp?.slice(0, 19)}</td>
                        <td className="p-2">#{r.pp_id}</td>
                        <td className="p-2">
                          {r.estado_anterior} → {r.estado_nuevo}
                        </td>
                        <td className="p-2">{r.descp_usuario || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
      <ReportFooter />
    </div>
  )
}
