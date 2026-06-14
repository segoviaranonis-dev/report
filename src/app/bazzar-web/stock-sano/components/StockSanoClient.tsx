"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import type { StockSanoPayload, StockSanoRow } from "@/lib/bazzar-web/stock-sano/types";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);

export function StockSanoClient() {
  const [data, setData] = useState<StockSanoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bazzar-web/stock-sano");
      const json = (await res.json()) as StockSanoPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Error al cargar");
      if (json.configured === false) throw new Error("DATABASE_URL no configurada");
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

  const byTriplete = useMemo(() => {
    const map = new Map<string, StockSanoRow[]>();
    if (!data) return map;
    for (const row of data.filas) {
      const key = `${row.linea} · ${row.referencia} · ${row.material}`;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
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
            Stock Sano — {data?.almacen.nombre ?? "ALM_WEB_01"}
          </h1>
          <p className="text-sm text-slate-600">
            Protocolo aduanero del motor de precio: cada triplete L+R+Material con precio de venta canonico,
            caso e indice markup. Primer deposito bajo esta ley.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Pares", value: data.metricas.pares },
                { label: "Combinaciones", value: data.metricas.filas },
                { label: "Tripletas", value: data.metricas.tripletas },
                { label: "Estado SANO", value: data.metricas.sano },
                { label: "Protocolo", value: data.almacen.protocolo_activo ? "ACTIVO" : "OFF" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{m.label}</p>
                  <p className="mt-1 text-2xl font-semibold" style={{ color: WEB_NAVY }}>
                    {typeof m.value === "number" ? fmt(m.value) : m.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mb-6 flex gap-2">
              <Link
                href="/bazzar-web/motor-precio"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Motor de precio
              </Link>
              <Link
                href="/bazzar-web/deposito-web"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Deposito Web
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="ml-auto rounded-md px-3 py-2 text-sm text-white disabled:opacity-50"
                style={{ backgroundColor: WEB_ORANGE }}
              >
                {loading ? "Cargando…" : "Actualizar"}
              </button>
            </div>

            {[...byTriplete.entries()].map(([triplete, rows]) => {
              const head = rows[0];
              const pares = rows.reduce((s, r) => s + r.stock_pares, 0);
              return (
                <section key={triplete} className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
                    style={{ backgroundColor: "rgba(30,58,95,0.04)" }}
                  >
                    <div>
                      <p className="font-mono text-sm font-semibold" style={{ color: WEB_NAVY }}>
                        {triplete}
                      </p>
                      <p className="text-xs text-slate-500">
                        LPN {fmt(head.lpn)} · caso {head.caso_codigo ?? "—"} · markup{" "}
                        {head.markup_pct != null ? `${head.markup_pct}%` : "—"} · precio venta{" "}
                        <strong>{fmt(head.precio_venta)}</strong>
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                      SANO · {pares} pares
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Color</th>
                          <th className="px-3 py-2">Talla</th>
                          <th className="px-3 py-2">Pares</th>
                          <th className="px-3 py-2">Precio venta</th>
                          <th className="px-3 py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.combinacion_id} className="border-b border-slate-100">
                            <td className="px-3 py-2">{r.color}</td>
                            <td className="px-3 py-2">{r.talla}</td>
                            <td className="px-3 py-2">{r.stock_pares}</td>
                            <td className="px-3 py-2 font-medium">{fmt(r.precio_venta)}</td>
                            <td className="px-3 py-2">
                              <EstadoBadge estado={r.estado_stock_sano} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}

            {data.historial.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold" style={{ color: WEB_NAVY }}>
                  Historial Stock Sano
                </h2>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Evento</th>
                        <th className="px-3 py-2">L+R+Mat</th>
                        <th className="px-3 py-2">LPN</th>
                        <th className="px-3 py-2">Caso</th>
                        <th className="px-3 py-2">Precio</th>
                        <th className="px-3 py-2">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.historial.map((h) => (
                        <tr key={h.id} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-xs">{h.evento}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {h.linea_codigo}/{h.referencia_codigo} {h.material ?? ""}
                          </td>
                          <td className="px-3 py-2">{fmt(h.lpn_entrante)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{h.caso_entrante ?? "—"}</td>
                          <td className="px-3 py-2">{fmt(h.precio_aplicado)}</td>
                          <td className="px-3 py-2 text-xs">{h.decision ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <ReportFooter />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: StockSanoRow["estado_stock_sano"] }) {
  const cls =
    estado === "SANO"
      ? "bg-emerald-100 text-emerald-800"
      : estado === "SIN_PROTOCOLO"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{estado}</span>;
}
