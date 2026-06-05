"use client";

import { useCallback, useEffect, useState } from "react";
import type { RetailArbolNodo, RetailArbolSnapshotResponse } from "@/lib/retail/arbol-snapshot-types";

const fmt = (n: number) => n.toLocaleString("es-PY", { maximumFractionDigits: 0 });

function walkIds(nodes: RetailArbolNodo[], out: Set<string>) {
  for (const n of nodes) {
    if (n.hijos?.length) {
      out.add(n.id);
      walkIds(n.hijos, out);
    }
  }
}

function FilaArbol({
  nodo,
  expandidos,
  onToggle,
}: {
  nodo: RetailArbolNodo;
  expandidos: Set<string>;
  onToggle: (id: string) => void;
}) {
  const tieneHijos = Boolean(nodo.hijos?.length);
  const expandido = expandidos.has(nodo.id);
  const indent = (nodo.nivel - 1) * 18;

  const rowBg =
    nodo.nivel === 1
      ? "bg-report-navy/5"
      : nodo.nivel === 2
        ? "bg-report-paper2/80"
        : "";

  const textClass =
    nodo.nivel === 1
      ? "font-semibold text-report-navy"
      : nodo.nivel === 2
        ? "font-medium text-report-ink"
        : nodo.nivel === 3
          ? "text-report-ink"
          : "text-xs text-report-muted";

  return (
    <>
      <tr
        className={`border-b border-report-rule/80 ${rowBg} ${
          tieneHijos ? "cursor-pointer hover:bg-report-paper2" : "hover:bg-white"
        }`}
        onClick={tieneHijos ? () => onToggle(nodo.id) : undefined}
      >
        <td className="py-2 pr-2" style={{ paddingLeft: 10 + indent }}>
          <div className="flex min-w-0 items-center">
            {tieneHijos ? (
              <span className="mr-1.5 inline-block w-4 shrink-0 text-[10px] text-report-navy2">
                {expandido ? "▼" : "▶"}
              </span>
            ) : (
              <span className="mr-1.5 inline-block w-4 shrink-0" />
            )}
            <span className={`truncate ${textClass}`}>
              {nodo.nombre}
              {nodo.nivel < 4 && nodo.count > 0 ? (
                <span className="ml-1 font-normal text-report-muted/70">({nodo.count})</span>
              ) : null}
            </span>
          </div>
        </td>
        <td className="py-2 px-3 text-right tabular-nums text-report-ink">{fmt(nodo.stock)}</td>
        <td className="py-2 px-3 text-right tabular-nums text-report-ink">{fmt(nodo.venta)}</td>
        <td className="py-2 px-3 text-right tabular-nums text-report-ink">
          {nodo.stock > 0 ? `${((nodo.venta / nodo.stock) * 100).toFixed(1)}%` : '—'}
        </td>
      </tr>
      {expandido &&
        nodo.hijos?.map((h) => (
          <FilaArbol key={h.id} nodo={h} expandidos={expandidos} onToggle={onToggle} />
        ))}
    </>
  );
}

function KpiMini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-report-rule bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-report-muted">{label}</p>
      <p className="mt-1 font-serif text-xl font-bold text-report-navy tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-report-muted">{sub}</p> : null}
    </div>
  );
}

export function RetailArbolSnapshot() {
  const [data, setData] = useState<RetailArbolSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/retail/arbol-snapshot");
      const text = await r.text();
      let j: RetailArbolSnapshotResponse;
      try {
        j = JSON.parse(text) as RetailArbolSnapshotResponse;
      } catch {
        throw new Error(text.slice(0, 120) || "Respuesta inválida del servidor");
      }
      if (!r.ok) throw new Error(j.error ?? "Error al cargar resumen");
      setData(j);
      if (j.error) setErr(j.error);
      // Iniciar COLAPSADO (no expandido)
      setExpandidos(new Set());
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const toggle = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const arbol = data?.arbol ?? [];
  const kpis = data?.kpis;
  const meta = data?.meta;
  const configured = data?.configured === true;

  if (loading && !data) {
    return <p className="text-sm text-report-muted py-8">Cargando resumen operativo…</p>;
  }

  if (!configured) {
    return (
      <p className="text-sm text-report-muted">
        Base de datos no configurada. Importe el Excel <code className="text-xs">st+vt+RC</code> desde Control Central.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-report-muted">
        Snapshot completo del Excel en{" "}
        <code className="rounded bg-report-paper2 px-1 text-xs">registro_st_vt_rc_reposicion</code>
        {meta?.archivoOrigen ? (
          <>
            {" "}
            — <span className="text-report-ink">{meta.archivoOrigen}</span>
          </>
        ) : null}
        {kpis ? (
          <>
            {" "}
            · <span className="tabular-nums">{kpis.filasExcel.toLocaleString("es-PY")}</span> filas procesadas
          </>
        ) : null}
        . Jerarquía: <strong>Ente → Género → Marca → SKU</strong> (suma de cantidad sin grada). Columnas{" "}
        <strong>Stock</strong> y <strong>Venta</strong> del Excel.
      </p>

      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {kpis ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiMini label="Stock total (pares)" value={fmt(kpis.stock)} sub="suma tipo Stock" />
          <KpiMini label="Venta total (pares)" value={fmt(kpis.venta)} sub="suma tipo Venta" />
          <KpiMini label="SKUs agregados" value={fmt(kpis.skus)} sub="línea·ref·mat·color" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const s = new Set<string>();
            walkIds(arbol, s);
            setExpandidos(s);
          }}
          className="rounded-lg border border-report-rule bg-white px-3 py-1.5 text-xs text-report-muted hover:text-report-ink"
        >
          Expandir todo
        </button>
        <button
          type="button"
          onClick={() => setExpandidos(new Set())}
          className="rounded-lg border border-report-rule bg-white px-3 py-1.5 text-xs text-report-muted hover:text-report-ink"
        >
          Colapsar todo
        </button>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className="ml-auto rounded-lg bg-report-navy px-4 py-1.5 text-xs text-white hover:bg-report-navy2 disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar resumen"}
        </button>
      </div>

      {!arbol.length ? (
        <p className="py-12 text-center text-sm text-report-muted">
          Sin datos. Importe el Excel retail desde Control Central (reemplazo total, sin acumular lotes).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-report-rule bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-report-rule bg-report-paper2 text-[10px] font-semibold uppercase tracking-widest text-report-muted">
                <th className="py-3 px-3 text-left">Estructura de análisis</th>
                <th className="w-28 py-3 px-3 text-right">Stock</th>
                <th className="w-28 py-3 px-3 text-right">Venta</th>
                <th className="w-24 py-3 px-3 text-right">V/S %</th>
              </tr>
            </thead>
            <tbody>
              {arbol.map((n) => (
                <FilaArbol key={n.id} nodo={n} expandidos={expandidos} onToggle={toggle} />
              ))}
            </tbody>
            {kpis ? (
              <tfoot>
                <tr className="border-t-2 border-report-navy/30 bg-report-paper2/90">
                  <td className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-widest text-report-muted">
                    Total general
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-report-navy">
                    {fmt(kpis.stock)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-report-navy">
                    {fmt(kpis.venta)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-report-navy">
                    {kpis.stock > 0 ? `${((kpis.venta / kpis.stock) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}
