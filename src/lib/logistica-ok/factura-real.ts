/**
 * CHUSAR · Palabra reservada: **Factura Real**
 *
 * Número de factura del **sistema Carlos** (ERP RIMEC legacy) — NO confundir con:
 * - `nro_factura` Nexus (ej. 38-PV001) = FI interna
 * - `nro_pedido_externo` PP = preventa Carlos a nivel pedido
 *
 * Fuente canónica:
 * - `factura_interna.factura_carlos` → número legal Excel Carlos (ej. 10019125327)
 * - `factura_interna.pv_global` → legacy PV000147 (int, solo valores ≤ int32)
 *
 * Mapa Excel Carlos → Nexus:
 * | Excel | Header      | BD / UI              |
 * | A     | COD.CLIENT  | validación id_cliente |
 * | C     | FACTURA     | factura_carlos       |
 * | D     | Nro IC      | match intencion_compra |
 * + export Nexus: FI Nexus (T), Evento (Q), Listado (R)
 */

/** Etiqueta UI obligatoria — no traducir ni abreviar */
export const FACTURA_REAL_LABEL = "Factura Real" as const;

/** FI Nexus (referencia interna PP-PV) */
export const FI_NEXUS_LABEL = "FI Nexus" as const;

const INT32_MAX = 2_147_483_647;

/** Dígitos válidos Carlos (Excel FACTURA) — alineado MIG-184 */
export const FACTURA_CARLOS_MIN_LEN = 6;
export const FACTURA_CARLOS_MAX_LEN = 15;

export function normalizeFacturaCarlosDigits(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < FACTURA_CARLOS_MIN_LEN || digits.length > FACTURA_CARLOS_MAX_LEN) return null;
  return digits;
}

export function isFacturaCarlosValid(raw: string | null | undefined): boolean {
  return normalizeFacturaCarlosDigits(raw) != null;
}

export type FacturaCarlosResolved = {
  factura_carlos: string | null;
  pv_global: number | null;
};

/** Formato legacy PV desde pv_global pequeño */
export function formatFacturaRealCarlos(pvGlobal: number | null | undefined): string {
  if (pvGlobal == null || !Number.isFinite(Number(pvGlobal)) || Number(pvGlobal) === 0) {
    return "";
  }
  return `PV${String(Math.trunc(Number(pvGlobal))).padStart(6, "0")}`;
}

/** Display UI Logística — factura_carlos manda; legacy pv_global; sino pendiente */
export function displayFacturaRealUi(row: {
  pv_global?: number | null;
  factura_carlos?: string | null;
}): string {
  const fc = row.factura_carlos?.trim();
  if (fc) return fc;
  const fr = formatFacturaRealCarlos(row.pv_global);
  return fr || "Pendiente Carlos";
}

export function facturaRealDesdeRow(row: {
  pv_global?: number | null;
  factura_carlos?: string | null;
  factura_real?: string | null;
}): string {
  if (row.factura_real?.trim()) return row.factura_real.trim();
  const fc = row.factura_carlos?.trim();
  if (fc) return fc;
  return formatFacturaRealCarlos(row.pv_global);
}

/** Resuelve valor CSV/Excel Carlos → columnas BD */
export function resolveFacturaCarlosImport(raw: string | null | undefined): FacturaCarlosResolved {
  const s = String(raw ?? "").trim();
  if (!s) return { factura_carlos: null, pv_global: null };

  const pvMatch = s.match(/^PV0*(\d+)$/i);
  if (pvMatch) {
    const n = Number(pvMatch[1]);
    const pv = Number.isFinite(n) && n > 0 && n <= INT32_MAX ? Math.trunc(n) : null;
    return { factura_carlos: s.toUpperCase(), pv_global: pv };
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return { factura_carlos: s, pv_global: null };
  const normalized = normalizeFacturaCarlosDigits(digits);
  if (!normalized) {
    return { factura_carlos: null, pv_global: null };
  }
  const n = Number(normalized);
  const pv = Number.isFinite(n) && n > 0 && n <= INT32_MAX ? Math.trunc(n) : null;
  return { factura_carlos: normalized, pv_global: pv };
}

/** @deprecated usar resolveFacturaCarlosImport */
export function parseFacturaRealCarlos(raw: string | null | undefined): number | null {
  return resolveFacturaCarlosImport(raw).pv_global;
}
