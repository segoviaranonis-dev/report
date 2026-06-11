"use client";

import { useState } from "react";
import { eliminarItemFiAction, modificarCantidadItemFiAction } from "../actions";
import type { FiDetalle } from "../lib/aprobaciones-types";
import { fmtGs } from "../lib/aprobaciones-utils";
import { RetailProductImage } from "@/app/retail/components/RetailProductImage";

type ItemRowProps = {
  item: FiDetalle;
  lpnLista?: string;
  editable?: boolean;
  puedeEliminar?: boolean;
  onFeedback?: (tipo: "success" | "error", texto: string) => void;
  onApplied?: () => void;
};

export function ItemRow({
  item,
  lpnLista,
  editable = false,
  puedeEliminar = true,
  onFeedback,
  onApplied,
}: ItemRowProps) {
  const alt = `L${item.linea_codigo} R${item.ref_codigo} ${item.color_nombre}`.trim();
  const gradas = item.gradas_display?.trim();
  const [cajas, setCajas] = useState(item.cajas);
  const [pares, setPares] = useState(item.pares);
  const [busy, setBusy] = useState(false);

  async function guardarCantidad() {
    if (pares <= 0) {
      onFeedback?.("error", "Los pares deben ser mayor a 0.");
      return;
    }
    setBusy(true);
    const res = await modificarCantidadItemFiAction(item.id, cajas, pares);
    if (res.success) {
      onFeedback?.("success", res.message ?? "Cantidad actualizada.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "Error al modificar cantidad.");
    }
    setBusy(false);
  }

  async function eliminar() {
    if (!confirm("¿Eliminar este ítem? Se revierte stock al PP.")) return;
    setBusy(true);
    const res = await eliminarItemFiAction(item.id);
    if (res.success) {
      onFeedback?.("success", res.message ?? "Ítem eliminado.");
      onApplied?.();
    } else {
      onFeedback?.("error", res.error ?? "No se pudo eliminar.");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-stretch gap-4 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-50 [&>div]:aspect-auto [&>div]:h-full [&>div]:w-full [&>div]:rounded-lg [&_img]:object-contain">
        <RetailProductImage
          alt={alt}
          candidates={item.imageCandidates}
          searchFileName={item.imageSearchName}
          placeholderClass="bg-neutral-100 text-neutral-500"
          aspect="square"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-base font-bold text-rimec-azul-dark">
          L{item.linea_codigo} · R{item.ref_codigo}
        </div>
        <div className="mt-0.5 text-sm text-neutral-700">
          {item.color_nombre || "Sin color"}
          {item.material_nombre ? ` · ${item.material_nombre}` : ""}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
              Grada
            </span>
            <div
              className={`mt-0.5 rounded-md border px-2.5 py-1 font-mono text-sm font-bold ${
                gradas
                  ? "border-rimec-azul/30 bg-rimec-azul/5 text-rimec-azul-dark"
                  : "border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning"
              }`}
            >
              {gradas || "Sin grada"}
            </div>
          </div>
          {lpnLista && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
                {lpnLista} neto
              </span>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-rimec-azul-dark">
                {fmtGs(item.precio_neto)}
              </div>
            </div>
          )}
        </div>

        {editable && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-neutral-600">
              Cajas
              <input
                type="number"
                min={0}
                value={cajas}
                onChange={(e) => setCajas(Number(e.target.value) || 0)}
                className="ml-1 w-16 rounded border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs font-bold text-neutral-600">
              Pares
              <input
                type="number"
                min={1}
                value={pares}
                onChange={(e) => setPares(Number(e.target.value) || 0)}
                className="ml-1 w-20 rounded border px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={guardarCantidad}
              className="rounded bg-rimec-azul px-2 py-1 text-xs font-bold text-white disabled:opacity-50"
            >
              Guardar
            </button>
            {puedeEliminar && (
              <button
                type="button"
                disabled={busy}
                onClick={eliminar}
                className="rounded border border-semantic-error px-2 py-1 text-xs font-bold text-semantic-error disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 self-center text-right">
        <div className="text-base font-bold tabular-nums text-neutral-ink">
          {editable ? `${cajas} caj · ${pares} p` : `${item.cajas} caj · ${item.pares} p`}
        </div>
        <div className="mt-1 text-sm font-semibold tabular-nums text-rimec-azul">
          {fmtGs(item.subtotal)}
        </div>
      </div>
    </div>
  );
}
