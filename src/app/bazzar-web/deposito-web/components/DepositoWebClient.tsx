"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { buildPivotByTalla } from "@/lib/bazzar-web/deposito-web/pivot";
import type {
  DepositoResumenRow,
  DepositoStockRow,
  DepositoWebPayload,
} from "@/lib/bazzar-web/deposito-web/types";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

export function DepositoWebClient() {
  const [data, setData] = useState<DepositoWebPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bazzar-web/deposito-web?t=${Date.now()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as DepositoWebPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Error al cargar depósito");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const marcas = useMemo(() => {
    if (!data?.resumen.length) return [];
    return [...new Set(data.resumen.map((r) => r.marca))];
  }, [data]);

  const detalleByMarca = useMemo(() => {
    const map = new Map<string, DepositoStockRow[]>();
    if (!data) return map;
    for (const row of data.detalle) {
      const list = map.get(row.marca) ?? [];
      list.push(row);
      map.set(row.marca, list);
    }
    return map;
  }, [data]);

  const resumenByMarca = useMemo(() => {
    const map = new Map<string, DepositoResumenRow[]>();
    if (!data) return map;
    for (const row of data.resumen) {
      const list = map.get(row.marca) ?? [];
      list.push(row);
      map.set(row.marca, list);
    }
    return map;
  }, [data]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader maxWidthClass="max-w-6xl" />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
            ← Inicio
          </Link>
          <h1 className="mt-2 font-serif text-2xl font-light" style={{ color: WEB_NAVY }}>
            Depósito Web
          </h1>
          <p className="text-sm text-slate-600">
            Stock real en ALM_WEB_01 — motor de la galería de la tienda (5 pilares + talla)
          </p>
        </header>

        {loading && <p className="text-sm text-slate-500">Cargando stock…</p>}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data && !loading && data.configured === false && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            DATABASE_URL no configurada.
          </div>
        )}

        {data && !loading && data.configured !== false && data.resumen.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700">
            <p>Sin stock confirmado en el Depósito Web.</p>
            <p className="mt-2 text-slate-500">
              El stock aparece cuando Compra Web confirma la recepción de un traspaso.
            </p>
          </div>
        )}

        {data && data.resumen.length > 0 && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
              <Metric label="Artículos disponibles" value={data.metricas.articulos} />
              <Metric
                label="Pares en depósito"
                value={data.metricas.pares.toLocaleString("es-PY")}
              />
            </div>

            <div className="space-y-3">
              {marcas.map((marca) => {
                const rows = resumenByMarca.get(marca) ?? [];
                const totM = rows.reduce((s, r) => s + r.stock_total, 0);
                const tallas = detalleByMarca.get(marca) ?? [];
                return (
                  <MarcaAccordion
                    key={marca}
                    marca={marca}
                    totM={totM}
                    nRefs={rows.length}
                    resumen={rows}
                    detalle={tallas}
                  />
                );
              })}
            </div>
          </>
        )}
      </main>

      <ReportFooter />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: WEB_NAVY }}>
        {value}
      </p>
    </div>
  );
}

function MarcaAccordion({
  marca,
  totM,
  nRefs,
  resumen,
  detalle,
}: {
  marca: string;
  totM: number;
  nRefs: number;
  resumen: DepositoResumenRow[];
  detalle: DepositoStockRow[];
}) {
  const { tallaColumns, pivot } = useMemo(() => buildPivotByTalla(detalle), [detalle]);

  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary
        className="cursor-pointer list-none px-4 py-3 font-medium text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden"
        style={{ color: WEB_NAVY }}
      >
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{marca}</span>
          <span className="text-sm font-normal text-slate-600">
            — {totM.toLocaleString("es-PY")} pares · {nRefs} artículo(s)
          </span>
        </span>
      </summary>

      <div className="border-t border-slate-100 px-4 py-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Línea</th>
                <th className="py-2 pr-3">Ref.</th>
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Color</th>
                <th className="py-2 pr-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((row) => (
                <tr
                  key={`${row.linea}-${row.referencia}-${row.material}-${row.color}`}
                  className="border-t border-slate-100"
                >
                  <td className="py-2 pr-3">{row.linea}</td>
                  <td className="py-2 pr-3">{row.referencia}</td>
                  <td className="py-2 pr-3">{row.material}</td>
                  <td className="py-2 pr-3">{row.color}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.stock_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detalle.length > 0 && (
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
              Ver desglose por talla
            </summary>
            <div className="overflow-x-auto border-t border-slate-200 px-2 py-2">
              {pivot.length > 0 && tallaColumns.length > 0 ? (
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Línea</th>
                      <th className="py-1 pr-2">Ref.</th>
                      <th className="py-1 pr-2">Material</th>
                      <th className="py-1 pr-2">Color</th>
                      {tallaColumns.map((t) => (
                        <th key={t} className="py-1 px-1 text-right tabular-nums">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.map((row) => (
                      <tr
                        key={`${row.linea}-${row.referencia}-${row.material}-${row.color}`}
                        className="border-t border-slate-100"
                      >
                        <td className="py-1 pr-2">{row.linea}</td>
                        <td className="py-1 pr-2">{row.referencia}</td>
                        <td className="py-1 pr-2">{row.material}</td>
                        <td className="py-1 pr-2">{row.color}</td>
                        {tallaColumns.map((t) => (
                          <td key={t} className="py-1 px-1 text-right tabular-nums">
                            {row.tallas[t] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-2">Línea</th>
                      <th className="py-1 pr-2">Ref.</th>
                      <th className="py-1 pr-2">Material</th>
                      <th className="py-1 pr-2">Color</th>
                      <th className="py-1 pr-2">Talla</th>
                      <th className="py-1 pr-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((row, i) => (
                      <tr key={`${row.linea}-${row.talla}-${i}`} className="border-t border-slate-100">
                        <td className="py-1 pr-2">{row.linea}</td>
                        <td className="py-1 pr-2">{row.referencia}</td>
                        <td className="py-1 pr-2">{row.material}</td>
                        <td className="py-1 pr-2">{row.color}</td>
                        <td className="py-1 pr-2">{row.talla}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{row.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}
