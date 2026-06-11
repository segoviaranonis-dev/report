import type { FiRecord } from "./aprobaciones-types";
export function fmtGs(n: number | null | undefined): string {
  try {
    return `Gs. ${Math.round(Number(n) || 0).toLocaleString("es-PY")}`;
  } catch {
    return "—";
  }
}

/** PV000147 desde pv_global (MIG-107) */
export function formatoPvDisplay(pvGlobal: number | null | undefined): string {
  if (pvGlobal == null || pvGlobal === 0) return "—";
  return `PV${String(Math.trunc(pvGlobal)).padStart(6, "0")}`;
}

/** Display principal: pv_global si existe, sino nro_factura legacy */
export function fiDisplayId(fi: Pick<FiRecord, "pv_global" | "nro_factura">): string {
  const pv = formatoPvDisplay(fi.pv_global);
  if (pv !== "—") return pv;
  return fi.nro_factura || "—";
}

export function ppDisplay(fi: Pick<FiRecord, "nro_pp" | "pp_id" | "proforma">): string {
  const base = fi.nro_pp || (fi.pp_id != null ? String(fi.pp_id) : "—");
  return fi.proforma ? `${base} (${fi.proforma})` : base;
}

export function descuentosLabel(fi: Pick<FiRecord, "descuento_1" | "descuento_2" | "descuento_3" | "descuento_4">): string {
  const ds = [fi.descuento_1, fi.descuento_2, fi.descuento_3, fi.descuento_4].map(Number);
  const activos = ds.filter((d) => d > 0).map((d) => `${d}%`);
  return activos.length ? activos.join(" + ") : "Sin descuento";
}

export type EstadoBadge = { bg: string; fg: string; label: string };

export function estadoBadge(estado: string | null | undefined): EstadoBadge {
  const e = (estado || "").toUpperCase();
  if (e === "CONFIRMADA") return { bg: "#15803D", fg: "#FFFFFF", label: "CONFIRMADA" };
  if (e === "RESERVADA") return { bg: "#CA8A04", fg: "#FFFFFF", label: "RESERVADA" };
  if (e === "ANULADA") return { bg: "#B91C1C", fg: "#FFFFFF", label: "ANULADA" };
  return { bg: "#475569", fg: "#FFFFFF", label: e || "—" };
}

const LISTAS: Record<number, string> = { 1: "LPN", 2: "LPC02", 3: "LPC03", 4: "LPC04" };

export const LISTAS_PRECIO_OPCIONES = [
  { id: 1, label: "LPN" },
  { id: 2, label: "LPC02" },
  { id: 3, label: "LPC03" },
  { id: 4, label: "LPC04" },
] as const;

export function listaPrecioLabel(id: number | null | undefined): string {
  return LISTAS[id ?? 1] ?? `LP${id}`;
}

/** Cascada descuentos FI — mismo criterio que logic.py actualizar_fi_encabezado */
export function precioNetoCascada(
  precioBase: number,
  d1: number,
  d2: number,
  d3: number,
  d4: number,
): number {
  let p = precioBase;
  for (const d of [d1, d2, d3, d4]) {
    if (d > 0) p *= 1 - d / 100;
  }
  return Math.round(p);
}

/** Editable en tránsito: FI RESERVADA/CONFIRMADA y PP aún no enviado a compra */
export function fiEsEditable(
  fi: Pick<FiRecord, "estado" | "pp_estado">,
): boolean {
  const e = (fi.estado || "").toUpperCase();
  if (e !== "RESERVADA" && e !== "CONFIRMADA") return false;
  if ((fi.pp_estado || "").toUpperCase() === "ENVIADO") return false;
  return true;
}

export function plazoDisplay(
  fi: Pick<FiRecord, "plazo_nombre" | "plazo_id">,
): string {
  const nombre = fi.plazo_nombre?.trim();
  if (nombre) return nombre;
  if (fi.plazo_id != null) return `Plazo #${fi.plazo_id}`;
  return "—";
}

/** Siempre muestra los 4 descuentos, aunque sean 0 */
export function fmtDescuentoPct(v: number | null | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "0%";
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
}

export function parseLineaSnapshot(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}
