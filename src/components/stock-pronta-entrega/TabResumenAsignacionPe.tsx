"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStockPe } from "@/components/stock-pronta-entrega/StockPeContext";
import { PeRevisarDescuentoPanel } from "@/components/stock-pronta-entrega/PeRevisarDescuentoPanel";
import { buildVerificacionDescuentosPe } from "@/lib/stock-pronta-entrega/resumen-asignacion-pe";
import { mapDescuentoPeLocal } from "@/lib/stock-pronta-entrega/asignacion-descuento-local";

async function fetchDescuentosBd(batch: string): Promise<Map<string, number>> {
  try {
    const res = await fetch(
      `/api/stock-pronta-entrega/asignacion-descuento?batch=${encodeURIComponent(batch)}`,
      { cache: "no-store" },
    );
    const j = (await res.json()) as { ok?: boolean; descuentos?: Record<string, number> };
    if (!j.ok || !j.descuentos) return new Map();
    return new Map(Object.entries(j.descuentos).map(([k, v]) => [k, Number(v)]));
  } catch {
    return new Map();
  }
}

type Props = { batchLabel: string };

export function TabResumenAsignacionPe({ batchLabel }: Props) {
  const { rows, loading, err } = useStockPe();
  const [descMap, setDescMap] = useState<Map<string, number>>(() => new Map());
  const [descLoading, setDescLoading] = useState(true);
  const [revisarOpen, setRevisarOpen] = useState(false);
  const [revisarPoliticaId, setRevisarPoliticaId] = useState<string | null>(null);
  const [revisarTitulo, setRevisarTitulo] = useState("Revisar asignación");

  const reloadDesc = useCallback(async () => {
    setDescLoading(true);
    const fromBd = await fetchDescuentosBd(batchLabel);
    setDescMap(fromBd.size > 0 ? fromBd : mapDescuentoPeLocal(batchLabel));
    setDescLoading(false);
  }, [batchLabel]);

  useEffect(() => {
    void reloadDesc();
  }, [reloadDesc]);

  const v = useMemo(
    () => (rows.length ? buildVerificacionDescuentosPe(rows, descMap) : null),
    [rows, descMap],
  );

  const abrirRevisar = (opts?: { politicaId?: string | null; titulo?: string }) => {
    setRevisarPoliticaId(opts?.politicaId ?? null);
    setRevisarTitulo(opts?.titulo ?? "Revisar asignación");
    setRevisarOpen(true);
  };

  if (loading || err) return null;

  const todoOk = v != null && v.sinAsignar === 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Verificación de descuentos</h2>
          <p className="mt-1 text-sm text-slate-600">
            {descLoading
              ? "Cargando BD…"
              : `${v?.asignadas.toLocaleString("es-PY") ?? 0} / ${v?.totalMoleculas.toLocaleString("es-PY") ?? 0} productos asignados (${v?.coberturaPct ?? 0}%)`}
            {v != null && v.sinAsignar > 0 ? (
              <span className="ml-2 font-semibold text-red-700">
                · {v.sinAsignar.toLocaleString("es-PY")} sin asignar
              </span>
            ) : null}
            {v != null && v.divergenciasCriterio > 0 ? (
              <span className="ml-2 font-semibold text-amber-800">
                · {v.divergenciasCriterio.toLocaleString("es-PY")} criterio distinto (ratificadas)
              </span>
            ) : null}
            {v != null && v.pendientes.length > 0 ? (
              <span className="ml-2 font-semibold text-rimec-azul">
                · {v.pendientes.length.toLocaleString("es-PY")} a revisar
              </span>
            ) : null}
          </p>
          {todoOk ? (
            <p className="mt-1 text-sm font-semibold text-emerald-700">Todo OK — política cumplida</p>
          ) : v != null && v.sinAsignar > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-800">Faltan asignaciones en BD</p>
          ) : v != null && v.divergenciasCriterio > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-800">
              Todo asignado · {v.divergenciasCriterio.toLocaleString("es-PY")} con criterio distinto al
              sugerido auto (válido para factura)
            </p>
          ) : null}
        </div>
        {v != null && v.pendientes.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              abrirRevisar({
                titulo: `Revisar ${v.pendientes.length.toLocaleString("es-PY")} producto(s) pendiente(s)`,
              })
            }
            className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-light"
          >
            Revisar pendientes ({v.pendientes.length.toLocaleString("es-PY")})
          </button>
        ) : null}
      </div>

      {!v ? (
        <p className="text-slate-500">Sin stock cargado.</p>
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">Por descuento asignado</h3>
            <table className="w-full max-w-md border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-left">
                  <th className="px-3 py-2 font-semibold">Descuento</th>
                  <th className="px-3 py-2 font-semibold text-right">Productos</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {v.pivotDescuento.map((f) => (
                  <tr
                    key={f.label}
                    className={`border-b border-slate-200 ${
                      f.pct == null ? "bg-red-50 font-semibold text-red-800" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.count.toLocaleString("es-PY")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {f.pct == null && v.pendientes.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            abrirRevisar({ titulo: `Sin asignar · ${f.count} producto(s)` })
                          }
                          className="text-xs font-bold text-rimec-azul hover:underline"
                        >
                          Revisar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-400 bg-slate-50 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {v.totalMoleculas.toLocaleString("es-PY")}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-slate-800">Por política comercial</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 text-left">
                  <th className="px-3 py-2 font-semibold">Política</th>
                  <th className="px-3 py-2 font-semibold text-center">%</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                  <th className="px-3 py-2 font-semibold text-right">Correctas</th>
                  <th className="px-3 py-2 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {v.verificacionPolitica.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-b border-slate-200 ${f.ok ? "" : "bg-amber-50"}`}
                  >
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{f.pctEsperado}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.total.toLocaleString("es-PY")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.correctas.toLocaleString("es-PY")}
                      {f.incorrectas > 0 ? (
                        <span className="ml-1 text-amber-800">
                          (+{f.incorrectas} criterio distinto)
                        </span>
                      ) : null}
                      {f.sinAsignar > 0 ? (
                        <span className="ml-1 text-red-700">
                          (+{f.sinAsignar} sin asignar)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {f.ok ? (
                        <span className="font-bold text-emerald-700">OK</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            abrirRevisar({
                              politicaId: f.id,
                              titulo: `Revisar · ${f.label} (${f.pctEsperado}%)`,
                            })
                          }
                          className="font-bold text-red-700 hover:underline"
                        >
                          REVISAR
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <PeRevisarDescuentoPanel
        open={revisarOpen}
        onClose={() => setRevisarOpen(false)}
        batchLabel={batchLabel}
        titulo={revisarTitulo}
        moleculas={v?.pendientes ?? []}
        politicaId={revisarPoliticaId}
        onApplied={() => void reloadDesc()}
      />
    </div>
  );
}
