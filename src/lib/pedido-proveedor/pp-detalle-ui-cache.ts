import type { FiDetalle } from "@/app/aprobaciones/lib/aprobaciones-types";
import type {
  IcAdminRow,
  PreFacturaInterna,
} from "@/lib/pedido-proveedor/administrador-ic-query";
import type {
  PpAlaNorteRow,
  PpDetalleHeader,
  PpFacturaInternaRow,
  PpIcVinculada,
} from "@/lib/pedido-proveedor/detail-query";
import type { EventoPrecioOption, EventoPpDetalle } from "@/lib/pedido-proveedor/stock-listado";

/** Sobrevive remount Suspense / captura pantalla — no volver a skeleton si ya hubo datos. */
export type PpDetalleUiSnapshot = {
  pp: PpDetalleHeader;
  ics: PpIcVinculada[];
  alaNorte: PpAlaNorteRow[];
  facturas: PpFacturaInternaRow[];
  detallesPorFi: Record<number, FiDetalle[]>;
  eventoDetalle: EventoPpDetalle | null;
  eventos: EventoPrecioOption[];
};

export type AdminIcUiSnapshot = {
  ics: IcAdminRow[];
  prefacturas: PreFacturaInterna[];
};

const detailByPpId = new Map<string, PpDetalleUiSnapshot>();
const adminIcByPpId = new Map<string, AdminIcUiSnapshot>();

export function readPpDetalleCache(ppId: string): PpDetalleUiSnapshot | null {
  return detailByPpId.get(ppId) ?? null;
}

export function writePpDetalleCache(ppId: string, snap: PpDetalleUiSnapshot): void {
  detailByPpId.set(ppId, snap);
}

export function clearPpDetalleCache(ppId: string): void {
  detailByPpId.delete(ppId);
}

export function readAdminIcCache(ppId: string): AdminIcUiSnapshot | null {
  return adminIcByPpId.get(ppId) ?? null;
}

export function clearAdminIcCache(ppId: string): void {
  adminIcByPpId.delete(ppId);
}

export function writeAdminIcCache(ppId: string, snap: AdminIcUiSnapshot): void {
  adminIcByPpId.set(ppId, snap);
}
