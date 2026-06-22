"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

export function Paso2CasosClient() {
  const sp = useSearchParams();
  const eventoId = Number(sp.get("evento_id") ?? "") || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/motor-precios/eventos/${eventoId}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar evento");
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

  const matrizLista = (evento?.matriz.casos_count ?? 0) > 0;
  const bibId = evento?.biblioteca_precio_id;

  async function copiarDesdeBiblioteca() {
    if (!eventoId || !bibId) return;
    setCopiando(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/motor-precios/eventos/${eventoId}/aplicar-biblioteca`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biblioteca_id: bibId, reemplazar_matriz: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo copiar casos");
      setMsg(`${data.n_casos} casos copiados desde biblioteca #${data.biblioteca_id}`);
      setEvento(data.evento);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al copiar");
    } finally {
      setCopiando(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2.2 · Casos
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Matriz de casos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Copiá los casos de la biblioteca asignada al evento. Cada caso trae su contenedor de líneas (BCL).
        </p>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={2}
            eventoId={eventoId}
            bloquearSiguiente={!matrizLista}
            mensajeSiguiente={
              !matrizLista ? "Copiá o definí al menos un caso antes del Preview" : undefined
            }
          />
        </div>

        {!eventoId ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm">
            Falta <code>evento_id</code>.{" "}
            <Link href={importacionPasoPath(0)} className="font-semibold text-rimec-azul underline">
              Paso 0
            </Link>
          </div>
        ) : loading ? (
          <p className="mt-8 text-center text-sm text-slate-500">Cargando…</p>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : evento ? (
          <div className="mt-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Casos evento" value={evento.matriz.casos_count} />
              <Metric label="Líneas BCL" value={evento.matriz.lineas_count} />
              <Metric label="SKUs Excel" value={evento.matriz.excel_skus_count} />
              <Metric label="precio_lista" value={evento.matriz.skus_count} />
            </div>

            {evento.matriz.excel_skus_count === 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <strong>0 SKUs Excel en BD.</strong> Si el evento se creó antes de MIG-120, volvé al{" "}
                <Link href={importacionPasoPath(0)} className="font-semibold underline">
                  Paso 0
                </Link>{" "}
                y recargá el Excel. Si aún falla:{" "}
                <code className="text-xs">node scripts/run_migration_120.mjs</code> en{" "}
                <code className="text-xs">report/</code>.
              </div>
            ) : null}

            {bibId ? (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="font-serif text-lg">Copiar desde biblioteca #{bibId}</h2>
                <p className="mt-1 text-xs text-slate-600">
                  {evento.biblioteca?.nombre ?? "Biblioteca asignada en Memoria"}
                </p>
                <button
                  type="button"
                  disabled={copiando || evento.estado === "cerrado"}
                  onClick={() => void copiarDesdeBiblioteca()}
                  className="mt-4 rounded-lg bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {copiando ? "Copiando…" : matrizLista ? "Reemplazar matriz desde biblioteca" : "Copiar casos al evento"}
                </button>
                {msg ? <p className="mt-3 text-sm text-emerald-800">{msg}</p> : null}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                Sin biblioteca asignada — volvé a{" "}
                <Link href={importacionPasoPath(1, eventoId)} className="font-semibold underline">
                  Memoria
                </Link>
              </div>
            )}

            {evento.matriz.casos.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Caso</th>
                      <th className="px-4 py-3">Dólar</th>
                      <th className="px-4 py-3">Factor</th>
                      <th className="px-4 py-3">Índice Gs</th>
                      <th className="px-4 py-3">Líneas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evento.matriz.casos.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-2 font-medium">{c.nombre_caso}</td>
                        <td className="px-4 py-2">{c.dolar_politica}</td>
                        <td className="px-4 py-2">{c.factor_conversion}</td>
                        <td className="px-4 py-2">{c.indice_gs.toLocaleString("es-PY")}</td>
                        <td className="px-4 py-2">{c.lineas_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Importación precios · Paso 2 Casos" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-rimec-azul-dark">{value.toLocaleString("es-PY")}</p>
    </div>
  );
}
