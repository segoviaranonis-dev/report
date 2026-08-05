"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type {
  AuditoriaCheck,
  AuditoriaIntegridadPayload,
  CheckEstado,
  EstadisticaDimRow,
  EstadisticaHueco,
  SiamesesChecklistItem,
} from "@/lib/bazzar-web/auditoria-integridad/types";

const NAVY = "#1E3A5F";
const ORANGE = "#F97316";

type TabId = "resumen" | "estadistica";

function Badge({ estado }: { estado: CheckEstado }) {
  const map: Record<CheckEstado, string> = {
    PASS: "bg-emerald-100 text-emerald-800 border-emerald-300",
    WARN: "bg-amber-100 text-amber-900 border-amber-300",
    FAIL: "bg-red-100 text-red-800 border-red-300",
    INFO: "bg-slate-100 text-slate-700 border-slate-300",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${map[estado]}`}>
      {estado}
    </span>
  );
}

function CheckRow({ c }: { c: AuditoriaCheck | SiamesesChecklistItem }) {
  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge estado={c.estado} />
          <span className="text-sm font-semibold text-slate-800">{c.label}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{c.detalle}</p>
        {"ruta" in c && c.ruta ? (
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{c.ruta}</p>
        ) : null}
      </div>
      {"valor" in c && c.valor != null ? (
        <span className="shrink-0 font-mono text-xs font-medium text-slate-700">{String(c.valor)}</span>
      ) : null}
    </li>
  );
}

function DimTable({ title, rows }: { title: string; rows: EstadisticaDimRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-white text-[10px] uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Clave</th>
              <th className="px-2 py-2 text-right">Dep mod</th>
              <th className="px-2 py-2 text-right">Dep pares</th>
              <th className="px-2 py-2 text-right">Sano mod</th>
              <th className="px-2 py-2 text-right">Sano pares</th>
              <th className="px-2 py-2 text-right">Web mod</th>
              <th className="px-2 py-2 text-right">Web pares</th>
              <th className="px-2 py-2 text-right">Δ mod</th>
              <th className="px-2 py-2 text-right">Δ pares</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.clave} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className="px-3 py-2 font-medium text-slate-800">{r.clave}</td>
                <td className="px-2 py-2 text-right font-mono">{r.deposito_modelos}</td>
                <td className="px-2 py-2 text-right font-mono">{r.deposito_pares}</td>
                <td className="px-2 py-2 text-right font-mono">{r.sano_modelos}</td>
                <td className="px-2 py-2 text-right font-mono">{r.sano_pares}</td>
                <td className="px-2 py-2 text-right font-mono">{r.web_modelos}</td>
                <td className="px-2 py-2 text-right font-mono">{r.web_pares}</td>
                <td
                  className={`px-2 py-2 text-right font-mono ${
                    r.delta_modelos_web_dep < 0 ? "text-red-600" : "text-slate-600"
                  }`}
                >
                  {r.delta_modelos_web_dep}
                </td>
                <td
                  className={`px-2 py-2 text-right font-mono ${
                    r.delta_pares_web_dep < 0 ? "text-red-600" : "text-slate-600"
                  }`}
                >
                  {r.delta_pares_web_dep}
                </td>
                <td className="px-3 py-2">
                  <Badge estado={r.estado} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PROBLEMA_LABEL: Record<EstadisticaHueco["problema"], string> = {
  sin_web: "En depósito, NO en Bazzar Web",
  sin_sano: "En depósito, NO en Stock Sano",
  solo_deposito: "Solo depósito (sin Sano ni Web)",
  pares_diff: "Pares distintos Dep vs Web",
};

export function AuditoriaIntegridadClient() {
  const [tab, setTab] = useState<TabId>("estadistica");
  const [data, setData] = useState<AuditoriaIntegridadPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bazzar-web/auditoria-integridad?t=${Date.now()}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as AuditoriaIntegridadPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Error al auditar");
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

  const m = data?.stock.metricas;
  const est = data?.estadistica;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "estadistica" as const, label: "Estadística" },
              { id: "resumen" as const, label: "Resumen · 2 cuadros" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                tab === t.id ? "text-white shadow" : "border border-slate-200 bg-white text-slate-600"
              }`}
              style={tab === t.id ? { backgroundColor: t.id === "estadistica" ? ORANGE : NAVY } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? "Auditando…" : "Actualizar"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {tab === "estadistica" ? (
        <section className="space-y-5">
          <header
            className="rounded-xl px-5 py-4 text-white"
            style={{ backgroundColor: ORANGE }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Pestaña estadística</p>
            <h2 className="font-serif text-2xl font-light">Depósito ↔ Stock Sano ↔ Bazzar Web</h2>
            <p className="mt-1 text-sm text-white/90">
              Modelo = Línea + Ref + Material · vendible tienda = SANO + precio&gt;0 + stock&gt;0
            </p>
          </header>

          {loading && !est ? (
            <p className="text-sm text-slate-500">Calculando cruces…</p>
          ) : est ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { l: "Dep modelos", v: est.totales.deposito_modelos },
                  { l: "Dep pares", v: est.totales.deposito_pares },
                  { l: "Sano modelos", v: est.totales.sano_modelos },
                  { l: "Sano pares", v: est.totales.sano_pares },
                  { l: "Web modelos", v: est.totales.web_modelos },
                  { l: "Web pares", v: est.totales.web_pares },
                ].map((k) => (
                  <div key={k.l} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">{k.l}</p>
                    <p className="font-mono text-lg font-semibold" style={{ color: NAVY }}>
                      {k.v.toLocaleString("es-PY")}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
                  est.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-900"
                }`}
              >
                {est.ok
                  ? "PASS — Depósito y Bazzar Web coinciden en modelos y pares."
                  : `REVISAR — ${est.huecos.length} hueco(s) listados abajo (máx. 200). Δ modelos Web−Dep = ${est.totales.web_modelos - est.totales.deposito_modelos} · Δ pares = ${est.totales.web_pares - est.totales.deposito_pares}`}
              </div>

              <DimTable title="Por Tipo_v2" rows={est.por_tipo_v2} />
              <DimTable title="Por marca" rows={est.por_marca} />
              <DimTable title="Por estilo" rows={est.por_estilo} />

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Huecos / diferencias (auditoría)
                  </h3>
                </div>
                {est.huecos.length === 0 ? (
                  <p className="p-4 text-sm text-emerald-700">Sin huecos — capas alineadas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="text-[10px] uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Problema</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2">Marca</th>
                          <th className="px-2 py-2">Estilo</th>
                          <th className="px-2 py-2">L-R-M</th>
                          <th className="px-2 py-2 text-right">Dep</th>
                          <th className="px-2 py-2 text-right">Sano</th>
                          <th className="px-2 py-2 text-right">Web</th>
                        </tr>
                      </thead>
                      <tbody>
                        {est.huecos.map((h) => (
                          <tr
                            key={`${h.linea}-${h.referencia}-${h.material}-${h.problema}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-2 font-medium text-red-700">
                              {PROBLEMA_LABEL[h.problema]}
                            </td>
                            <td className="px-2 py-2">{h.tipo_v2}</td>
                            <td className="px-2 py-2">{h.marca}</td>
                            <td className="px-2 py-2">{h.estilo}</td>
                            <td className="px-2 py-2 font-mono">
                              {h.linea}-{h.referencia}-{h.material}
                            </td>
                            <td className="px-2 py-2 text-right font-mono">{h.deposito_pares}</td>
                            <td className="px-2 py-2 text-right font-mono">
                              {h.sano_pares ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono">{h.web_pares ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : (
        <>
          {/* ── Cuadro 1 ── */}
          <section
            className="overflow-hidden rounded-xl border-2 bg-white shadow-sm"
            style={{ borderColor: ORANGE }}
          >
            <header
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-white"
              style={{ backgroundColor: ORANGE }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Cuadro 1</p>
                <h2 className="font-serif text-2xl font-light">Auditoría de stock</h2>
              </div>
              {data ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    data.stock.ok ? "bg-white text-emerald-700" : "bg-red-900/30 text-white"
                  }`}
                >
                  {data.stock.ok ? "INTEGRIDAD OK" : "REVISAR"}
                </span>
              ) : null}
            </header>

            {loading && !data ? (
              <p className="p-6 text-sm text-slate-500">Cargando métricas…</p>
            ) : m ? (
              <>
                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5 sm:grid-cols-4">
                  {[
                    { label: "Modelos SANO", value: m.modelos_sano },
                    { label: "Pares vendibles", value: m.pares_vendibles.toLocaleString("es-PY") },
                    { label: "Filas tienda", value: m.filas_vendibles },
                    { label: "SSD (tripletes)", value: m.stock_sano_deposito_n },
                  ].map((k) => (
                    <div key={k.label} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {k.label}
                      </p>
                      <p className="font-mono text-xl font-semibold" style={{ color: NAVY }}>
                        {k.value}
                      </p>
                    </div>
                  ))}
                </div>
                <ul className="px-5 pb-2">
                  {data!.stock.checks.map((c) => (
                    <CheckRow key={c.id} c={c} />
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-4 text-xs">
                  <Link
                    href="/bazzar-web/deposito-web"
                    className="font-semibold hover:underline"
                    style={{ color: NAVY }}
                  >
                    → Depósito Web
                  </Link>
                  <Link
                    href="/bazzar-web/stock-sano"
                    className="font-semibold hover:underline"
                    style={{ color: NAVY }}
                  >
                    → Stock Sano
                  </Link>
                  <Link
                    href="/bazzar-web/motor-precio"
                    className="font-semibold hover:underline"
                    style={{ color: NAVY }}
                  >
                    → Motor precio
                  </Link>
                </div>
              </>
            ) : null}
          </section>

          {/* ── Cuadro 2 ── */}
          <section
            className="overflow-hidden rounded-xl border-2 bg-white shadow-sm"
            style={{ borderColor: NAVY }}
          >
            <header
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-white"
              style={{ backgroundColor: NAVY }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Cuadro 2</p>
                <h2 className="font-serif text-2xl font-light">Protocolo hermanos siameses</h2>
              </div>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                Tipo · Imagen · Grilla
              </span>
            </header>

            {data ? (
              <>
                <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Hermano A
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: NAVY }}>
                      {data.siameses.pareja.a.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.siameses.pareja.a.app} · {data.siameses.pareja.a.ruta}
                    </p>
                    <Link
                      href={data.siameses.pareja.a.ruta}
                      className="mt-2 inline-block text-xs font-bold hover:underline"
                      style={{ color: ORANGE }}
                    >
                      Abrir
                    </Link>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Hermano B
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: NAVY }}>
                      {data.siameses.pareja.b.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.siameses.pareja.b.app} · {data.siameses.pareja.b.ruta}
                    </p>
                    <a
                      href={data.siameses.pareja.b.ruta}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-bold hover:underline"
                      style={{ color: ORANGE }}
                    >
                      Abrir tienda
                    </a>
                  </div>
                </div>

                <div className="px-5 pt-4">
                  <p className="text-sm text-slate-700">{data.siameses.ley}</p>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                    {data.siameses.prioridad.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ol>
                </div>

                <ul className="px-5 pb-2 pt-2">
                  {data.siameses.items.map((c) => (
                    <CheckRow key={c.id} c={c} />
                  ))}
                </ul>
              </>
            ) : loading ? (
              <p className="p-6 text-sm text-slate-500">Cargando protocolo…</p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
