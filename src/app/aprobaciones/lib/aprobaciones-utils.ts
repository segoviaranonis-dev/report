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

export function ppDisplay(
  fi: Pick<FiRecord, "nro_pp" | "pp_id" | "proforma"> &
    Partial<Pick<FiRecord, "origen_pe" | "nro_factura">>,
): string {
  if (
    fi.origen_pe ||
    fi.pp_id == null ||
    String(fi.nro_factura ?? "").startsWith("PE-")
  ) {
    return "Pronta entrega";
  }
  const base = fi.nro_pp || (fi.pp_id != null ? String(fi.pp_id) : "—");
  return fi.proforma ? `${base} (${fi.proforma})` : base;
}

/** Badge ámbar PE — pedido web o FI sin PP tránsito. */
export function badgeProntaEntrega(): { bg: string; fg: string; label: string } {
  return { bg: "#C2410C", fg: "#FFFFFF", label: "PRONTA ENTREGA" };
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

/** Bruto antes de cascada d1→d4 (inverso de precioNetoCascada). */
export function brutoDesdeNeto(
  neto: number,
  d1: number,
  d2: number,
  d3: number,
  d4: number,
): number {
  let factor = 1;
  for (const d of [d1, d2, d3, d4]) {
    if (d > 0) factor *= 1 - d / 100;
  }
  return factor > 0 ? Math.round(neto / factor) : Math.round(neto);
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

const MESES_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const TZ_ASUNCION = "America/Asuncion";

/** Fecha confirmación FI — MIG-114. Cadena fija (evita hydration: ICU Node vs Chrome en es-PY). */
export function fmtFechaConfirmacion(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ_ASUNCION,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const day = Number(pick("day"));
  const month = Number(pick("month"));
  const year = pick("year");
  const hour = pick("hour");
  const minute = pick("minute").padStart(2, "0");
  const pm = pick("dayPeriod").toLowerCase().startsWith("p");
  const mes = MESES_ES[month - 1] ?? String(month);

  return `${day} ${mes}. ${year}, ${hour}:${minute} ${pm ? "p. m." : "a. m."}`;
}

/** Siempre muestra los 4 descuentos, aunque sean 0 */
/** Fecha documento FI (solo día, Asunción). */
export function fmtFechaDoc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PY", {
    timeZone: TZ_ASUNCION,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

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
