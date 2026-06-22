"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { PreviewAuditResult } from "@/lib/motor-precios/evento-preview-audit";
import type { PrecioEventoDetalle } from "@/lib/motor-precios/evento-queries";
import { fetchJson } from "@/lib/motor-precios/fetch-json";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";
import { ImportacionPreciosStepNav } from "../../components/ImportacionPreciosStepNav";

export function Paso3PreviewClient() {
  const sp = useSearchParams();
  const eventoId = Number(sp.get("evento_id") ?? "") || null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);
  const [audit, setAudit] = useState<PreviewAuditResult | null>(null);

  const load = useCallback(async () => {
    if (!eventoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { res, data } = await fetchJson<{ audit: PreviewAuditResult; evento: PrecioEventoDetalle; error?: string }>(
        `/api/motor-precios/eventos/${eventoId}/preview-audit`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error(data.error || (data.audit?.error ?? "Error en preview"));
      setAudit(data.audit);
      setEvento(data.evento);
      if (data.audit?.error && !data.audit.ok) setError(data.audit.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [eventoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const listoPreview = Boolean(audit?.ok && (audit.skus_sin_caso ?? 0) === 0);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <ProcesoImportacionWaitOverlay
        open={loading && Boolean(eventoId)}
        title="Auditando Excel × biblioteca…"
        detail={evento?.nombre_evento ?? (eventoId ? `Evento #${eventoId}` : undefined)}
        hint="Sincronizando casos · detectando SKUs sin cobertura"
      />
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={IMPORTACION_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Importación de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2 · Preview
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Preview · Excel × biblioteca</h1>
        <p className="mt-2 text-sm text-slate-600">
          Casos de la biblioteca (Memoria) se aplican automáticamente. Acá ves qué SKUs del Excel quedan fuera de la
          matriz. El listado solo entra al historial al <strong>Cierre</strong>.
        </p>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={2}
            eventoId={eventoId}
            bloquearSiguiente={!listoPreview}
            mensajeSiguiente={
              !listoPreview ? "Resolvé SKUs sin caso en biblioteca antes de la Conversión" : undefined
            }
          />
        </div>

        {!eventoId ? (
          <p className="mt-8 text-sm text-amber-800">
            <Link href={importacionPasoPath(0)} className="underline">
              Paso 0
            </Link>{" "}
            requerido.
          </p>
        ) : loading ? (
          <p className="mt-8 text-center text-sm text-slate-500">Preparando auditoría…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {evento ? (
              <div className="rounded-xl border bg-white p-5 shadow-sm text-sm">
                <strong>{evento.nombre_evento}</strong> · #{evento.id}
                {evento.biblioteca ? (
                  <span className="text-slate-600">
                    {" "}
                    · biblioteca #{evento.biblioteca.id} {evento.biblioteca.nombre}
                  </span>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
            ) : null}

            {audit ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Stat label="Casos matriz" value={audit.casos_count} ok={audit.casos_count > 0} />
                  <Stat label="SKUs Excel" value={audit.skus_excel} ok={audit.skus_excel > 0} />
                  <Stat label="Con caso" value={audit.skus_con_caso} ok />
                  <Stat
                    label="Sin caso"
                    value={audit.skus_sin_caso}
                    ok={audit.skus_sin_caso === 0}
                    warn={audit.skus_sin_caso > 0}
                  />
                </div>

                {audit.matriz_sincronizada ? (
                  <p className="text-xs text-emerald-800">Matriz sincronizada desde biblioteca (sin Paso Casos manual).</p>
                ) : null}

                {audit.warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                    <ul className="list-disc pl-4">
                      {audit.warnings.slice(0, 15).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {audit.skus_huerfanos.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-red-200 bg-white shadow-sm">
                    <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-900">
                      SKUs fuera de la biblioteca ({audit.skus_sin_caso})
                    </p>
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-left uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Marca</th>
                          <th className="px-3 py-2">L·R</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.skus_huerfanos.slice(0, 100).map((r, i) => (
                          <tr key={`${r.linea}-${r.referencia}-${i}`} className="border-t">
                            <td className="px-3 py-1.5">{r.marca}</td>
                            <td className="px-3 py-1.5 font-mono">
                              {r.linea}.{r.referencia}
                            </td>
                            <td className="px-3 py-1.5 text-red-800">{r.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : listoPreview ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Todos los SKUs Excel tienen caso en la biblioteca. Podés continuar a Conversión.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        )}

        <Link href={MOTOR_PRECIOS} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
      </main>
      <ReportFooter note="Importación · Preview audit · sin guardar listado oficial hasta Cierre" />
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: number;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center shadow-sm ${
        warn ? "border-red-200 bg-red-50" : ok ? "border-emerald-200 bg-white" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-rimec-azul-dark">{value.toLocaleString("es-PY")}</p>
    </div>
  );
}
