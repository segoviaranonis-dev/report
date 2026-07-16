/**
 * Grada abierta Kyly 638 — notación Carlos (SDRM / Alejandro Magno).
 * Ej: `1(1)1` → talle 1 · venta unitaria · stock en cantidad_pares de la fila.
 * Distinto de curva cerrada calzado 654 (`34(1 2 3 3 2 1)39`).
 */

export type ModoVentaAm = "UNIDAD" | "CAJA_CERRADA";

export type GradaAbierta638 = {
  raw: string;
  talle: string;
  /** Unidades por click de venta (paréntesis Carlos). */
  unidadVenta: number;
  modo_venta: ModoVentaAm;
  grades_json: Record<string, number>;
};

const RE_NUM = /^(\d+)\((\d+)\)(\d+)$/;
const RE_LETRA = /^([A-Za-z]+)\((\d+)\)([A-Za-z]+)$/i;

export function isConfecciones638(tipoV2Id: number | null | undefined): boolean {
  return tipoV2Id === 2;
}

/** Parsea DESCRIPCION GRADA confección. */
export function parseGradaAbierta638(
  raw: string | null | undefined,
  cantidadSaldo = 0,
): GradaAbierta638 | null {
  const text = String(raw ?? "").trim();
  if (!text || text === "—") return null;

  let talle = text;
  let unidadVenta = 1;

  const mNum = text.match(RE_NUM);
  const mLet = text.match(RE_LETRA);
  if (mNum) {
    talle = mNum[1];
    unidadVenta = Math.max(1, Number(mNum[2]) || 1);
  } else if (mLet) {
    talle = mLet[1].toUpperCase();
    unidadVenta = Math.max(1, Number(mLet[2]) || 1);
  } else if (text.includes("/")) {
    talle = text;
  } else {
    const inner = text.match(/\((\d+)\)/);
    if (inner) unidadVenta = Math.max(1, Number(inner[1]) || 1);
    const lead = text.match(/^(\d+)/);
    if (lead) talle = lead[1];
  }

  const qty = Math.max(0, Number(cantidadSaldo) || 0);
  const grades_json: Record<string, number> = qty > 0 ? { [talle]: qty } : { [talle]: 0 };

  return {
    raw: text,
    talle,
    unidadVenta,
    modo_venta: "UNIDAD",
    grades_json,
  };
}

export function modoVentaFromProveedor(proveedorId: number | null | undefined): ModoVentaAm {
  return proveedorId === 638 ? "UNIDAD" : "CAJA_CERRADA";
}

export function claveGradaEnTarjeta(
  grada: string,
  precioLpn: number | null | undefined,
  tipoV2Id: number | null | undefined,
): string {
  const c = String(grada ?? "").trim() || "(sin grada)";
  if (!isConfecciones638(tipoV2Id)) return c;
  const lpn = Number(precioLpn);
  if (Number.isFinite(lpn) && lpn > 0) return `${c}|LPN:${Math.trunc(lpn)}`;
  return c;
}

export function etiquetaUnidadStock(tipoV2Id: number | null | undefined): "p" | "u" {
  return isConfecciones638(tipoV2Id) ? "u" : "p";
}
