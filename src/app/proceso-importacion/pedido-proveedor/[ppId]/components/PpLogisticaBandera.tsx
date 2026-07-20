"use client";

import { useState } from "react";
import Link from "next/link";
import type { PpDetalleHeader } from "@/lib/pedido-proveedor/detail-query";
import { FECHA_ENTREGA_REAL_LABEL } from "@/lib/logistica-ok/constants";

type Props = {
  ppId: number;
  pp: PpDetalleHeader;
  onActivated: () => void;
};

export function PpLogisticaBandera({ ppId, pp, onActivated }: Props) {
  const [fecha, setFecha] = useState(pp.fecha_entrega_real ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const publicado = pp.logistica_bandera_activa;

  async function publicar() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/activar-logistica`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_entrega_real: fecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      const nFi = data.n_fi ?? data.synced ?? 0;
      const cajas = data.cajas ?? 0;
      setMsg(`Publicado: ${nFi} facturas · ${Number(cajas).toLocaleString("es-PY")} cajas (desde FI).`);
      onActivated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function despublicar() {
    if (!window.confirm("¿Despublicar logística? Se quitan las FI pendientes de confirmación de este PP.")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/despublicar-logistica`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMsg(`Despublicado (${data.removed ?? 0} filas pendientes eliminadas).`);
      onActivated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`mt-4 rounded-xl border-2 p-4 ${
        publicado ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-3 w-3 rounded-full ${publicado ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-slate-300"}`}
            title={publicado ? "Logística publicada" : "Logística no publicada"}
          />
          <h3 className="text-xs font-bold uppercase text-slate-700">Logística OK</h3>
          {publicado && (
            <span className="rounded bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900">PUBLICADO</span>
          )}
          {publicado && pp.logistica_n_fi > 0 && (
            <span className="rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
              {pp.logistica_n_fi} facturas · {pp.logistica_cajas.toLocaleString("es-PY")} cajas
            </span>
          )}
        </div>
        <Link href="/logistica-ok" className="text-xs font-semibold text-rimec-azul hover:underline">
          Ir a pendientes →
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {FECHA_ENTREGA_REAL_LABEL} dispara la copia de FI CONFIRMADA a <strong>Pendiente de confirmación</strong>.
        Conteo en <strong>cajas</strong> desde detalle de factura interna. FI nuevas entran solas mientras esté publicado.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500">{FECHA_ENTREGA_REAL_LABEL}</label>
          <input
            type="date"
            className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          disabled={busy || !fecha}
          onClick={() => void publicar()}
          className="rounded-lg bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
        >
          {busy ? "…" : publicado ? "Actualizar y re-sync" : "Publicar"}
        </button>
        {publicado && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void despublicar()}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Despublicar
          </button>
        )}
      </div>
      {pp.logistica_activada_at && (
        <p className="mt-2 text-[10px] text-slate-500">
          Publicado: {pp.logistica_activada_at.slice(0, 19).replace("T", " ")}
        </p>
      )}
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      {msg && <p className="mt-2 text-xs text-emerald-800">{msg}</p>}
    </div>
  );
}
