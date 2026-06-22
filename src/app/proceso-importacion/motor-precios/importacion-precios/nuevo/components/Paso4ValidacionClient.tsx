"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { fetchJson } from "@/lib/motor-precios/fetch-json";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

type MuestraRow = {
  nombre_caso: string;
  linea: string;
  referencia: string;
  material: string;
  fob: number;
  lpn: number;
  lpc03: number | null;
  lpc04: number | null;
};

export function Paso4ValidacionClient() {
  const sp = useSearchParams();
  const eventoId = Number(sp.get("evento_id") ?? "") || null;

  const [loading, setLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);
  const [muestra, setMuestra] = useState<MuestraRow[]>([]);
  const [nLista, setNLista] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [exitoCalc, setExitoCalc] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{
        resumen?: { n_precio_lista: number };
        muestra?: MuestraRow[];
        evento?: PrecioEventoDetalle;
        error?: string;
      }>(`/api/motor-precios/eventos/${eventoId}/calcular`, { credentials: "same-origin" });
      if (!res.ok && res.status !== 422) throw new Error(data.error || "Error al cargar conversión");
      setEvento(data.evento ?? null);
      setMuestra(data.muestra ?? []);
      setNLista(data.resumen?.n_precio_lista ?? data.evento?.matriz.skus_count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const calculado = nLista > 0;

  async function iniciarCalculo(recalcular = false) {
    if (!eventoId) return;
    setCalculando(true);
    setError(null);
    setExitoCalc(null);
    setWarnings([]);
    try {
      const { res, data } = await fetchJson<{
        ok?: boolean;
        error?: string;
        warnings?: string[];
        n_precio_lista?: number;
        duracion_ms?: number;
        n_staging?: number;
        skus_total?: number;
        evento?: PrecioEventoDetalle;
        muestra?: MuestraRow[];
      }>(`/api/motor-precios/eventos/${eventoId}/calcular`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recalcular }),
      });
      if (!res.ok || !data.ok) {
        setWarnings(data.warnings ?? []);
        throw new Error(data.error || "Error en cálculo");
      }
      setEvento(data.evento ?? null);
      setMuestra(data.muestra ?? []);
      setNLista(data.n_precio_lista ?? 0);
      setWarnings(data.warnings ?? []);
      setExitoCalc(
        `${data.n_precio_lista} filas precio_lista · ${data.duracion_ms}ms · staging ${data.n_staging}`,
      );

      await fetch(`/api/motor-precios/eventos/${eventoId}/validacion`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al calcular");
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <ProcesoImportacionWaitOverlay
        open={(loading && Boolean(eventoId)) || calculando}
        title={calculando ? "Convirtiendo precio_lista…" : "Cargando conversión…"}
        detail={evento?.nombre_evento ?? (eventoId ? `Evento #${eventoId}` : undefined)}
        hint={
          calculando
            ? "Pilares FK → staging → calcular_precio_lista_evento_sql (puede tardar unos segundos)"
            : "Estado del listado en sesión"
        }
      />
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2 · Conversión
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Conversión · precio_lista</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pilares FK → staging → SQL. Aún es sesión de trabajo; el listado oficial se guarda en Cierre.
        </p>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={3}
            eventoId={eventoId}
            bloquearSiguiente={!calculado}
            mensajeSiguiente={!calculado ? "Ejecutá la conversión antes del Cierre" : undefined}
          />
        </div>

        {!eventoId ? (
          <p className="mt-8 text-sm">
            <Link href={importacionPasoPath(0)} className="text-rimec-azul underline">
              Paso 0
            </Link>
          </p>
        ) : loading ? (
          <p className="mt-8 text-center text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {evento ? (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <p className="text-sm">
                  <strong>{evento.nombre_evento}</strong> · {evento.matriz.casos_count} casos ·{" "}
                  {evento.matriz.excel_skus_count} SKUs Excel
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={calculando || evento.estado === "cerrado"}
                    onClick={() => void iniciarCalculo(calculado)}
                    className="rounded-lg bg-rimec-azul px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {calculando ? "Convirtiendo…" : calculado ? "Recalcular" : "Iniciar conversión"}
                  </button>
                </div>
                {exitoCalc ? <p className="mt-3 text-sm text-emerald-800">{exitoCalc}</p> : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                <ul className="max-h-32 list-disc overflow-y-auto pl-4">
                  {warnings.slice(0, 20).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {calculado ? (
              <p className="text-sm font-semibold text-rimec-azul-dark">
                {nLista.toLocaleString("es-PY")} filas en precio_lista
              </p>
            ) : null}

            {muestra.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-left uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Caso</th>
                      <th className="px-3 py-2">L·R·M</th>
                      <th className="px-3 py-2">FOB</th>
                      <th className="px-3 py-2">LPN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {muestra.map((r, i) => (
                      <tr key={`${r.linea}-${i}`} className="border-t">
                        <td className="px-3 py-1.5">{r.nombre_caso}</td>
                        <td className="px-3 py-1.5 font-mono">
                          {r.linea}.{r.referencia}·{r.material}
                        </td>
                        <td className="px-3 py-1.5">{r.fob.toFixed(2)}</td>
                        <td className="px-3 py-1.5 font-semibold">{r.lpn.toLocaleString("es-PY")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        )}

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Importación · Conversión precio_lista" />
    </div>
  );
}
