"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [evento, setEvento] = useState<PrecioEventoDetalle | null>(null);
  const [audit, setAudit] = useState<PreviewAuditResult | null>(null);
  const [casoEventoId, setCasoEventoId] = useState<number | "">("");
  const [selectedLineas, setSelectedLineas] = useState<Set<string>>(new Set());

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

  const lineasHuerfanas = useMemo(() => audit?.lineas_huerfanas ?? [], [audit?.lineas_huerfanas]);
  const casos = useMemo(() => evento?.matriz.casos ?? [], [evento?.matriz.casos]);
  const lineasKey = useMemo(
    () => lineasHuerfanas.map((l) => l.linea_codigo).join(","),
    [lineasHuerfanas],
  );

  useEffect(() => {
    if (casos.length && casoEventoId === "") {
      setCasoEventoId(casos[0].id);
    }
  }, [casos, casoEventoId]);

  useEffect(() => {
    setSelectedLineas(new Set(lineasHuerfanas.map((l) => l.linea_codigo)));
  }, [lineasKey, lineasHuerfanas]);

  const listoPreview = Boolean(audit?.ok && (audit.skus_sin_caso ?? 0) === 0);

  const marcaPorLinea = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of lineasHuerfanas) m[l.linea_codigo] = l.marca;
    return m;
  }, [lineasHuerfanas]);

  const toggleLinea = (cod: string) => {
    setSelectedLineas((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  };

  const asignarLineas = async () => {
    if (!eventoId || casoEventoId === "" || selectedLineas.size === 0) return;
    setAssigning(true);
    setError(null);
    setSuccess(null);
    try {
      const { res, data } = await fetchJson<{
        ok: boolean;
        error?: string;
        audit?: PreviewAuditResult;
        evento?: PrecioEventoDetalle;
        lineas?: string[];
      }>(`/api/motor-precios/eventos/${eventoId}/asignar-lineas-preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caso_evento_id: casoEventoId,
          lineas: [...selectedLineas],
          marca_por_linea: marcaPorLinea,
        }),
      });
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo asignar");
      if (data.audit) setAudit(data.audit);
      if (data.evento) setEvento(data.evento);
      setSuccess(`${selectedLineas.size} línea(s) asignadas al caso — biblioteca y evento sincronizados.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <ProcesoImportacionWaitOverlay
        open={(loading || assigning) && Boolean(eventoId)}
        title={assigning ? "Guardando en biblioteca…" : "Auditando Excel × biblioteca…"}
        detail={evento?.nombre_evento ?? (eventoId ? `Evento #${eventoId}` : undefined)}
        hint={assigning ? "BCL · pilar línea · sync evento" : "Sincronizando casos · detectando líneas sin cobertura"}
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
          La matriz de casos usa solo el <strong>pilar línea</strong> (<code className="text-xs">linea.codigo_proveedor</code>
          ). Referencia y material son SKUs del Excel — acá podés asignar líneas huérfanas al caso en biblioteca sin salir de
          Preview.
        </p>

        <div className="mt-6">
          <ImportacionPreciosStepNav
            pasoActivo={2}
            eventoId={eventoId}
            bloquearSiguiente={!listoPreview}
            mensajeSiguiente={
              !listoPreview ? "Asigná líneas sin caso en biblioteca antes de la Conversión" : undefined
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

            {success ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {success}
              </div>
            ) : null}

            {audit ? (
              <>
                <div className="grid gap-3 sm:grid-cols-5">
                  <Stat label="Casos matriz" value={audit.casos_count} ok={audit.casos_count > 0} />
                  <Stat label="SKUs Excel" value={audit.skus_excel} ok={audit.skus_excel > 0} />
                  <Stat label="Con caso" value={audit.skus_con_caso} ok />
                  <Stat
                    label="Líneas sin caso"
                    value={audit.lineas_sin_caso}
                    ok={audit.lineas_sin_caso === 0}
                    warn={audit.lineas_sin_caso > 0}
                  />
                  <Stat
                    label="SKUs sin caso"
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

                {lineasHuerfanas.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-red-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3">
                      <p className="text-sm font-bold text-red-900">
                        Líneas fuera de biblioteca ({audit.lineas_sin_caso}) · {audit.skus_sin_caso} SKUs afectados
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Caso destino
                          <select
                            className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                            value={casoEventoId}
                            onChange={(e) => setCasoEventoId(Number(e.target.value))}
                          >
                            {casos.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre_caso}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={assigning || selectedLineas.size === 0 || casoEventoId === ""}
                          onClick={() => void asignarLineas()}
                          className="rounded-lg bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Asignar {selectedLineas.size} línea(s) al caso
                        </button>
                      </div>
                    </div>
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-left uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 w-10" />
                          <th className="px-3 py-2">Marca</th>
                          <th className="px-3 py-2">Línea</th>
                          <th className="px-3 py-2">SKUs Excel</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasHuerfanas.map((r) => (
                          <tr key={r.linea_codigo} className="border-t">
                            <td className="px-3 py-1.5">
                              <input
                                type="checkbox"
                                checked={selectedLineas.has(r.linea_codigo)}
                                onChange={() => toggleLinea(r.linea_codigo)}
                              />
                            </td>
                            <td className="px-3 py-1.5">{r.marca}</td>
                            <td className="px-3 py-1.5 font-mono">{r.linea_codigo}</td>
                            <td className="px-3 py-1.5">{r.skus_afectados}</td>
                            <td className="px-3 py-1.5 text-red-800">{r.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : listoPreview ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Todas las líneas Excel tienen caso en la biblioteca. Podés continuar a Conversión.
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
      <ReportFooter note="Importación · Preview · asignación línea→caso en BD · sin listado oficial hasta Cierre" />
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
