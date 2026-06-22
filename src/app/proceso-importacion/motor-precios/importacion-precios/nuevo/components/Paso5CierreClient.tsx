"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { fetchJson } from "@/lib/motor-precios/fetch-json";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

export function Paso5CierreClient() {
  const sp = useSearchParams();
  const eventoId = Number(sp.get("evento_id") ?? "") || null;

  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);
  const [cierreOk, setCierreOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { res, data } = await fetchJson<{ evento?: PrecioEventoDetalle; error?: string }>(
        `/api/motor-precios/eventos/${eventoId}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(data.error || `Error al cargar evento (${res.status})`);
      if (!data.evento) throw new Error("Respuesta sin evento");
      setEvento(data.evento);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    load();
  }, [load]);

  const cerrado = evento?.estado.toLowerCase() === "cerrado";
  const puedeCerrar =
    (evento?.matriz.skus_count ?? 0) > 0 &&
    ["validado"].includes(String(evento?.estado).toLowerCase());

  async function cerrarListado() {
    if (!eventoId) return;
    setCerrando(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{
        ok?: boolean;
        error?: string;
        evento?: PrecioEventoDetalle;
        cierre?: { n_precio_lista: number; proveedor_id: number };
      }>(`/api/motor-precios/eventos/${eventoId}/cerrar`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cerrar");
      if (data.evento) setEvento(data.evento);
      setCierreOk(
        `Listado cerrado · ${data.cierre?.n_precio_lista ?? 0} SKUs vigentes · proveedor ${data.cierre?.proveedor_id ?? "—"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cerrar");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <ProcesoImportacionWaitOverlay
        open={cerrando || (loading && Boolean(eventoId))}
        title={cerrando ? "Cerrando listado…" : "Cargando cierre…"}
        detail={evento?.nombre_evento ?? (eventoId ? `Evento #${eventoId}` : undefined)}
        hint={
          cerrando
            ? "Persistiendo listado oficial en historial · activando vigencia"
            : "Consultando estado del evento"
        }
      />
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2.5 · Cierre
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Cierre del listado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Único paso que persiste el listado oficial en historial. Bloquea edición y activa vigencia.
        </p>

        <div className="mt-6">
          <ImportacionPreciosStepNav pasoActivo={4} eventoId={eventoId} bloquearSiguiente={false} />
        </div>

        {loading ? (
          <p className="mt-8 text-center text-sm text-slate-500">Cargando…</p>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : evento ? (
          <div className="mt-8 space-y-6">
            <div
              className={`rounded-xl border p-6 shadow-sm ${
                cerrado ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <h2 className="font-serif text-xl text-rimec-azul-dark">{evento.nombre_evento}</h2>
              <p className="mt-2 text-sm">
                Evento #{evento.id} · vigente {evento.fecha_vigencia_desde} ·{" "}
                <span className="font-mono uppercase font-bold">{evento.estado}</span>
              </p>
              <ul className="mt-4 space-y-1 text-sm text-slate-700">
                <li>{evento.matriz.skus_count.toLocaleString("es-PY")} filas en precio_lista</li>
                <li>{evento.matriz.casos_count} casos · biblioteca #{evento.biblioteca_precio_id ?? "—"}</li>
              </ul>

              {!cerrado ? (
                <button
                  type="button"
                  disabled={!puedeCerrar || cerrando}
                  onClick={() => void cerrarListado()}
                  className="mt-6 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {cerrando ? "Cerrando…" : "Cerrar listado definitivamente"}
                </button>
              ) : (
                <p className="mt-6 text-sm font-semibold text-emerald-900">
                  Listado cerrado — no editable. Podés vincularlo a un PP en Streamlit o IC Report.
                </p>
              )}
              {!puedeCerrar && !cerrado ? (
                <p className="mt-3 text-xs text-amber-800">
                  Completá la Conversión (Paso 3) antes de cerrar.
                </p>
              ) : null}
            </div>
            {cierreOk ? <p className="text-sm text-emerald-800">{cierreOk}</p> : null}
          </div>
        ) : null}

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Importación · Cierre · listado en historial" />
    </div>
  );
}
