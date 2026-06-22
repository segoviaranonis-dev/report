"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { EstadoRealEvento, EventoHistorialRow } from "@/lib/motor-precios/evento-historial";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import {
  IMPORTACION_PRECIOS,
  IMPORTACION_PRECIOS_NUEVO,
  MOTOR_PRECIOS,
  pedidoProveedorDetalle,
} from "@/lib/report/routes";

const ESTADO_META: Record<
  EstadoRealEvento,
  { icon: string; label: string; className: string }
> = {
  cerrado: { icon: "🟢", label: "Cerrado", className: "bg-emerald-100 text-emerald-900" },
  en_uso: { icon: "🔒", label: "En uso", className: "bg-amber-100 text-amber-950" },
  validado: { icon: "🔵", label: "Validado", className: "bg-sky-100 text-sky-900" },
  borrador: { icon: "⚪", label: "Borrador", className: "bg-slate-100 text-slate-700" },
};

type Resumen = {
  total: number;
  en_uso: number;
  en_uso_pp: number;
  en_uso_ic: number;
  borrador: number;
  cerrado: number;
  basura: number;
};

export function ListadoPreciosHistorialClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoHistorialRow[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : "";
      const res = await fetch(`/api/motor-precios/eventos/historial${q}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setEventos(data.eventos ?? []);
      setResumen(data.resumen ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(() => void load(), busqueda ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, busqueda]);

  const targetEvento = useMemo(
    () => eventos.find((e) => e.id === deleteTarget) ?? null,
    [eventos, deleteTarget],
  );

  async function eliminarListado() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch(`/api/motor-precios/eventos/${deleteTarget}/eliminar`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: confirmText }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo eliminar");
      setDeleteMsg(data.mensaje);
      setDeleteTarget(null);
      setConfirmText("");
      await load();
    } catch (e) {
      setDeleteMsg(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2 · Historial listas
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Historial de listas de precios</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Paridad Streamlit · Motor → Historial. 🔒 <strong>En uso</strong> = vinculado a IC o PP (candado
          dinámico). Borradores con 0 SKUs = basura de prueba.
        </p>

        {resumen ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            <Stat n={resumen.total} label="Total" />
            <Stat n={resumen.en_uso} label="🔒 En uso" />
            <Stat n={resumen.cerrado} label="Cerrados" />
            <Stat n={resumen.borrador} label="Borradores" />
            <Stat n={resumen.basura} label="Basura (0 SKU)" warn />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Buscar INVIERNO, cerrado, borrador…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <Link
            href={IMPORTACION_PRECIOS_NUEVO}
            className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white"
          >
            + Nuevo evento
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Listado</th>
                <th className="px-3 py-3">SKUs</th>
                <th className="px-3 py-3">Vigencia</th>
                <th className="px-3 py-3">PP / IC</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Sin listados
                  </td>
                </tr>
              ) : (
                eventos.map((ev) => {
                  const meta = ESTADO_META[ev.estado_real] ?? ESTADO_META.borrador;
                  const puedeContinuar =
                    ev.estado_real === "borrador" && !ev.uso.en_uso && ev.estado_db !== "cerrado";
                  return (
                    <tr key={ev.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${meta.className}`}
                          title={ev.uso.en_uso ? ev.uso.modulos.join(" · ") : "Libre para edición"}
                        >
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono">{ev.id}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-rimec-azul-dark">{ev.nombre_evento}</p>
                        <p className="text-xs text-slate-500">{ev.nombre_archivo}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono">{ev.total_skus}</span>
                        {ev.excel_skus > 0 ? (
                          <span className="block text-xs text-slate-500">Excel: {ev.excel_skus}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs">{ev.fecha_vigencia_desde}</td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex items-start gap-2">
                          <span
                            className="text-base leading-none"
                            title={
                              ev.uso.en_uso_pp
                                ? "Candado cerrado — listado en uso por pedido proveedor"
                                : "Candado abierto — sin PP vinculado"
                            }
                          >
                            {ev.uso.en_uso_pp ? "🔒" : ev.uso.en_uso ? "🔒" : "🔓"}
                          </span>
                          <div className="min-w-0 space-y-1">
                            {ev.uso.pp_ids.length ? (
                              ev.uso.pp_ids.map((ppId, i) => (
                                <Link
                                  key={ppId}
                                  href={pedidoProveedorDetalle(ppId)}
                                  className="block font-semibold text-rimec-azul underline"
                                >
                                  {ev.uso.pps[i] ?? `PP #${ppId}`}
                                </Link>
                              ))
                            ) : null}
                            {ev.uso.ics.length ? (
                              <p className="text-slate-700">{ev.uso.ics.join(", ")}</p>
                            ) : null}
                            {!ev.uso.pp_ids.length && !ev.uso.ics.length ? (
                              <span className="text-slate-400">—</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {puedeContinuar ? (
                            <Link
                              href={importacionPasoPath(1, ev.id)}
                              className="rounded border border-rimec-azul px-2 py-1 text-xs font-semibold text-rimec-azul"
                            >
                              Continuar
                            </Link>
                          ) : null}
                          {ev.eliminable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(ev.id);
                                setConfirmText("");
                                setDeleteMsg(null);
                              }}
                              className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                              title="Borra precio_lista y casos · no toca pilares"
                            >
                              🗑️ Eliminar
                            </button>
                          ) : (
                            <span
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500"
                              title="Reasigná otro listado en el PP antes de eliminar"
                            >
                              🔒 No eliminable
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {deleteTarget && targetEvento ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="font-serif text-lg text-rimec-azul-dark">Eliminar listado #{deleteTarget}</h2>
              <p className="mt-2 text-sm text-slate-700">
                <strong>{targetEvento.nombre_evento}</strong>
              </p>
              {targetEvento.uso.en_uso_ic && !targetEvento.uso.en_uso_pp ? (
                <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                  Se desvincularán las IC antes de borrar. Los PP no se tocan.
                </p>
              ) : null}
              <label className="mt-4 block text-sm">
                Escribí <strong>ELIMINAR</strong>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                />
              </label>
              {deleteMsg ? <p className="mt-2 text-sm text-red-700">{deleteMsg}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded border px-4 py-2 text-sm"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={confirmText.trim().toUpperCase() !== "ELIMINAR" || deleting}
                  onClick={() => void eliminarListado()}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {deleting ? "Eliminando…" : "Eliminar definitivamente"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Historial listas · paridad Streamlit · candado PP" />
    </div>
  );
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${warn ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <p className="text-2xl font-bold text-rimec-azul-dark">{n}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}
