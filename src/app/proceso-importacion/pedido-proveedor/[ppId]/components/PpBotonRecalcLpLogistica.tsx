"use client";

import { useMemo, useState } from "react";
import {
  labelListadoPrecio,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import { SelectorPoliticaLp } from "@/app/proceso-importacion/intencion-compra/components/SelectorPoliticaLp";
import { BOTON_IMPOSITOR_LABEL } from "@/lib/pedido-proveedor/boton-impositor-constants";
import type { PpDetalleHeader, PpFacturaInternaRow } from "@/lib/pedido-proveedor/detail-query";

type Props = {
  pp: PpDetalleHeader;
  ppId: number;
  facturas: PpFacturaInternaRow[];
  selectedFiIds: Set<number>;
  onToggleFi: (fiId: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onReload: () => void;
  onMsg: (text: string) => void;
};

function fmtGs(n: number): string {
  return `Gs. ${Math.round(n).toLocaleString("es-PY")}`;
}

/** Botón impositor v1 — «Asignar listado de Precios» · ignora biblioteca · sync Logística. */
export function PpBotonRecalcLpLogistica({
  pp,
  ppId,
  facturas,
  selectedFiIds,
  onToggleFi,
  onSelectAll,
  onClearAll,
  onReload,
  onMsg,
}: Props) {
  const ppEnviado = pp.estado === "ENVIADO";
  const [lp, setLp] = useState<ListadoPrecioTierId | null>(3);
  const [busy, setBusy] = useState(false);

  const elegibles = useMemo(
    () => facturas.filter((f) => f.estado === "RESERVADA" || f.estado === "CONFIRMADA"),
    [facturas],
  );

  async function ejecutar() {
    const ids = [...selectedFiIds];
    if (ids.length === 0) {
      onMsg("Seleccioná al menos una FI.");
      return;
    }
    if (!lp) {
      onMsg(`Elegí listado de precios para ${BOTON_IMPOSITOR_LABEL}.`);
      return;
    }
    const msgConfirm =
      `${BOTON_IMPOSITOR_LABEL} · ${ids.length} FI → ${labelListadoPrecio(lp)}.\n` +
      `Recalc L+R+material desde listado PP · ignora biblioteca BCL · sync Logística.` +
      (ppEnviado ? "\nPP ENVIADO — única acción permitida." : "");
    if (!window.confirm(msgConfirm)) return;

    setBusy(true);
    onMsg("");
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/recalcular-fi-logistica`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fi_ids: ids,
            lista_precio_id: lp,
            modo_impositor: true,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Imposición falló");

      const delta = Number(data.delta_monto ?? 0);
      onMsg(
        `✓ ${BOTON_IMPOSITOR_LABEL} · LP${lp} · ${data.fi_ok}/${data.filas?.length ?? ids.length} FI` +
          ` · Logística ${data.logistica_filas ?? 0}` +
          (delta !== 0 ? ` · Δ ${fmtGs(delta)}` : "") +
          (data.biblioteca_ignorada ? " · biblioteca ignorada" : ""),
      );
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-4 border-red-700 bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 px-5 py-4 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-red-900">
            Botón impositor v1 · pruebas Logística
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-red-950">{BOTON_IMPOSITOR_LABEL}</h3>
          <p className="mt-2 max-w-2xl text-sm text-red-950">
            Impone LP 1–4 sobre línea+referencia+material del listado vinculado al PP.{" "}
            <strong>Superpoder:</strong> ignora biblioteca/caso BCL · redondeo comercial exacto (MIG-179) ·
            propaga <code className="text-xs">monto_neto</code> a Logística OK.
            {ppEnviado && (
              <>
                {" "}
                Tras ENVIADO a compras <strong>este es el único botón activo</strong>.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || selectedFiIds.size === 0 || !lp}
          onClick={() => void ejecutar()}
          className="shrink-0 rounded-xl border-4 border-red-900 bg-red-700 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg hover:bg-red-800 disabled:opacity-40"
        >
          {busy ? "Imponiendo…" : `☝ ${BOTON_IMPOSITOR_LABEL} (${selectedFiIds.size})`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-red-200/80 pt-4">
        <div className="min-w-[14rem]">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-red-900">
            Listado a imponer (obligatorio)
          </p>
          <SelectorPoliticaLp required disabled={busy} value={lp} onChange={setLp} />
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" className="font-bold text-red-800 underline" onClick={onSelectAll}>
            Todas ({elegibles.length})
          </button>
          <button type="button" className="font-bold text-red-800 underline" onClick={onClearAll}>
            Ninguna
          </button>
        </div>
      </div>

      {elegibles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {elegibles.map((fi) => {
            const sel = selectedFiIds.has(fi.id);
            return (
              <label
                key={fi.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-2 py-1 text-xs font-mono ${
                  sel ? "border-red-700 bg-red-100" : "border-red-200 bg-white/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sel}
                  disabled={busy}
                  onChange={() => onToggleFi(fi.id)}
                />
                {fi.nro_factura}
                <span className="text-[10px] text-slate-600">LP{fi.lista_precio_id ?? "?"} · {fmtGs(fi.total_monto)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
