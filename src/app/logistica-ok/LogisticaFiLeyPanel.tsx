"use client";

import { useState } from "react";
import { CompraWebFiPanel } from "@/app/bazzar-web/compra/components/CompraWebFiPanel";
import type { FiDetalleCanonico, FiRegistroRow } from "@/lib/bazzar-web/compra-web/types";
import { TERMINO_FI } from "@/lib/facturacion/types";

type FiDetail = {
  fi: FiRegistroRow;
  detalles: FiDetalleCanonico[];
};

/**
 * Acordeón Ley FI — misma verdad que Facturación (`CompraWebFiPanel`).
 * Protocolo Chusar: Logística OK no puede omitir detalle FI (miniatura · pilares · monto).
 */
export function useLogisticaFiDetalle(opts?: { detalleBase?: string }) {
  const detalleBase = opts?.detalleBase ?? "/api/facturacion";
  const [expandedNro, setExpandedNro] = useState<string | null>(null);
  const [detail, setDetail] = useState<FiDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(nro: string | null | undefined) {
    const key = String(nro ?? "").trim();
    if (!key) return;
    if (expandedNro === key) {
      setExpandedNro(null);
      setDetail(null);
      setError(null);
      return;
    }
    setExpandedNro(key);
    setDetail(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${detalleBase}/${encodeURIComponent(key)}`, {
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.fi) {
        setError(data.error || `No se pudo cargar ${TERMINO_FI}`);
        return;
      }
      setDetail({ fi: data.fi, detalles: data.detalles ?? [] });
    } catch {
      setError(`Error de red al cargar ${TERMINO_FI}`);
    } finally {
      setLoading(false);
    }
  }

  return { expandedNro, detail, loading, error, toggle };
}

export function LogisticaFiDetalleCell({
  nro,
  expandedNro,
  loading,
  onToggle,
}: {
  nro: string | null;
  expandedNro: string | null;
  loading: boolean;
  onToggle: (nro: string | null | undefined) => void;
}) {
  const key = String(nro ?? "").trim();
  const open = key !== "" && expandedNro === key;
  if (!key) return <span className="font-mono text-xs">—</span>;
  return (
    <button
      type="button"
      onClick={() => onToggle(key)}
      className={`font-mono text-xs font-bold underline-offset-2 hover:underline ${
        open ? "text-rimec-azul-dark" : "text-rimec-azul"
      }`}
      title={open ? `Cerrar detalle ${TERMINO_FI}` : `Ver ${TERMINO_FI} · Ley · pilares · monto`}
      aria-expanded={open}
    >
      {loading && open ? "…" : key}
      <span className="ml-1 text-[9px] font-black uppercase tracking-wide text-slate-500">
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}

export function LogisticaFiDetallePanel({
  nro,
  expandedNro,
  detail,
  loading,
  error,
  colSpan,
}: {
  nro: string | null;
  expandedNro: string | null;
  detail: FiDetail | null;
  loading: boolean;
  error: string | null;
  colSpan: number;
}) {
  const key = String(nro ?? "").trim();
  if (!key || expandedNro !== key) return null;

  return (
    <tr className="border-t border-rimec-azul/20 bg-slate-50/90">
      <td colSpan={colSpan} className="px-3 py-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-rimec-azul/70">
          Ley {TERMINO_FI} · misma verdad Facturación · Chusar
        </p>
        {loading && <p className="text-xs text-slate-600">Cargando detalle…</p>}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        )}
        {!loading && detail && detail.fi.nro_factura === key ? (
          <CompraWebFiPanel fi={detail.fi} detalles={detail.detalles} />
        ) : null}
      </td>
    </tr>
  );
}
