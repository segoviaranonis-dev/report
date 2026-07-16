"use client";

import type { FiRecord } from "../lib/aprobaciones-types";
import {
  badgeCompraPrevia,
  badgeProntaEntrega,
  esCompraPreviaFi,
  esProntaEntregaFi,
  ppDetalleCompraPrevia,
} from "../lib/aprobaciones-utils";

type Props = {
  fi: Pick<FiRecord, "origen_pe" | "pp_id" | "nro_factura" | "nro_pp" | "proforma">;
  /** Mostrar PP/proforma junto al badge CP */
  showPpDetalle?: boolean;
};

export function OrigenVentaChips({ fi, showPpDetalle = true }: Props) {
  const pe = esProntaEntregaFi(fi);
  const cp = esCompraPreviaFi(fi);
  const peBadge = pe ? badgeProntaEntrega() : null;
  const cpBadge = cp ? badgeCompraPrevia() : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {cpBadge && (
        <span
          className="rounded-lg px-3 py-1.5 text-xs font-black tracking-wide shadow-sm ring-2 ring-sky-300/80"
          style={{ backgroundColor: cpBadge.bg, color: cpBadge.fg }}
        >
          {cpBadge.label}
        </span>
      )}
      {peBadge && (
        <span
          className="rounded-lg px-3 py-1.5 text-xs font-black tracking-wide"
          style={{ backgroundColor: peBadge.bg, color: peBadge.fg }}
        >
          {peBadge.label}
        </span>
      )}
      {cp && showPpDetalle && (
        <span className="rounded-lg border-2 border-sky-400/50 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-950">
          {ppDetalleCompraPrevia(fi)}
        </span>
      )}
    </div>
  );
}
