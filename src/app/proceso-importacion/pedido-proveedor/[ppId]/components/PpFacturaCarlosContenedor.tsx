"use client";

import { useEffect, useState } from "react";
import {
  displayFacturaRealUi,
  FACTURA_CARLOS_MAX_LEN,
  FACTURA_CARLOS_MIN_LEN,
  FACTURA_REAL_LABEL,
  isFacturaCarlosValid,
  normalizeFacturaCarlosDigits,
} from "@/lib/logistica-ok/factura-real";

type Props = {
  ppId: number;
  fiId: number;
  nroFactura: string;
  facturaCarlos: string | null;
  pvGlobal: number | null;
  editable: boolean;
  compact?: boolean;
  onSaved: () => void;
  onMsg: (text: string) => void;
};

/** Contenedor manual Factura Carlos — CP y PROGRAMADO (PP tab FI). */
export function PpFacturaCarlosContenedor({
  ppId,
  fiId,
  nroFactura,
  facturaCarlos,
  pvGlobal,
  editable,
  compact = false,
  onSaved,
  onMsg,
}: Props) {
  const [draft, setDraft] = useState(facturaCarlos ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(facturaCarlos ?? "");
  }, [fiId, facturaCarlos]);

  const display = displayFacturaRealUi({ factura_carlos: facturaCarlos, pv_global: pvGlobal });
  const dirty = normalizeFacturaCarlosDigits(draft) !== (facturaCarlos?.trim() || null);
  const draftValid = !draft.trim() || isFacturaCarlosValid(draft);

  async function guardar() {
    const normalized = normalizeFacturaCarlosDigits(draft);
    if (draft.trim() && !normalized) {
      onMsg(
        `${FACTURA_REAL_LABEL}: ${FACTURA_CARLOS_MIN_LEN}–${FACTURA_CARLOS_MAX_LEN} dígitos.`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${ppId}/fi/${fiId}/factura-carlos`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factura_carlos: normalized ?? "" }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string; factura_carlos?: string | null };
      if (!res.ok) throw new Error(data.error || "Error al guardar Factura Carlos");
      onMsg(
        `FI ${nroFactura} · ${FACTURA_REAL_LABEL} ${data.factura_carlos ?? "— (borrada)"}`,
      );
      onSaved();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (compact && !editable && !facturaCarlos) {
    return (
      <span className="rounded border border-dashed border-amber-300 bg-amber-50/80 px-2 py-0.5 font-mono text-[10px] text-amber-800">
        {display}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 border-amber-600 bg-gradient-to-br from-amber-50 to-yellow-50 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">
        {FACTURA_REAL_LABEL} · Carlos
      </p>
      {!compact && (
        <p className="mt-0.5 text-[11px] text-amber-950">
          Manual por ahora · {FACTURA_CARLOS_MIN_LEN}–{FACTURA_CARLOS_MAX_LEN} dígitos · único en PP y global.
        </p>
      )}
      {editable ? (
        <div className={`flex flex-wrap items-end gap-2 ${compact ? "mt-1" : "mt-2"}`}>
          <div className="min-w-[10rem] flex-1">
            <label className="sr-only" htmlFor={`fc-${fiId}`}>
              {FACTURA_REAL_LABEL}
            </label>
            <input
              id={`fc-${fiId}`}
              type="text"
              inputMode="numeric"
              maxLength={FACTURA_CARLOS_MAX_LEN + 4}
              value={draft}
              disabled={busy}
              placeholder="ej. 10019125327"
              onChange={(e) => setDraft(e.target.value)}
              className={`w-full rounded-lg border-2 px-3 py-2 font-mono text-sm font-bold tabular-nums ${
                draftValid ? "border-amber-500 bg-white text-amber-950" : "border-red-500 bg-red-50 text-red-900"
              }`}
            />
          </div>
          <button
            type="button"
            disabled={busy || !dirty || !draftValid}
            onClick={() => void guardar()}
            className="rounded-lg border-2 border-amber-800 bg-amber-700 px-4 py-2 text-xs font-black uppercase text-white hover:bg-amber-800 disabled:opacity-40"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      ) : (
        <p
          className={`mt-1 inline-block rounded-lg border-2 px-2 py-1 font-mono font-black tabular-nums ${
            facturaCarlos
              ? "border-amber-600 bg-amber-100 text-amber-950"
              : "border-dashed border-amber-300 text-amber-800"
          } ${compact ? "text-[11px]" : "text-sm"}`}
        >
          {display}
        </p>
      )}
    </div>
  );
}
