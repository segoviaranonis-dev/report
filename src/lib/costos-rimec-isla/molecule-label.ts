import { KYLY_REF_CODIGO_PROVEEDOR } from "@/lib/depositos/pilar-proveedor-index";
import type { CostosTxtLinea } from "./types";

export function is638Costos(l: CostosTxtLinea): boolean {
  return l.proveedorId === 638 || l.tipoV2Id === 2;
}

/** Línea Kyly desde descripción Carlos (`MILON 7407` · `KYLY 1000028`). */
export function parseLinea638FromDesc(descripcion: string): string {
  const brand = descripcion.match(/^\s*[A-ZÁÉÍÓÚÄËÏÖÜÑ][A-ZÁÉÍÓÚÄËÏÖÜÑ0-9]*\s+(\d{4,7})\b/);
  if (brand) return brand[1];
  for (const m of descripcion.matchAll(/\b(\d{4,7})\b/g)) {
    const n = m[1];
    if (descripcion.includes(`TAM ${n}`)) continue;
    return n;
  }
  return "0";
}

/** Línea 638 — descripción · fallback K en material. */
export function resolveLinea638(l: Pick<CostosTxtLinea, "linea" | "descripcion" | "material">): string {
  if (l.linea && l.linea !== "0") return l.linea;
  const fromDesc = parseLinea638FromDesc(l.descripcion);
  if (fromDesc !== "0") return fromDesc;
  const km = String(l.material ?? "").match(/^K(\d+)$/i);
  return km?.[1] ?? "0";
}

/** Extrae L·R desde descripción Carlos (654: 4076.1350 · 40004.6). */
export function parseLineaReferenciaFromDesc(
  descripcion: string,
  tipoV2Id: 1 | 2 | null,
): { linea: string; referencia: string } {
  const lr654 = descripcion.match(/\b(\d{3,5})\.(\d{1,5})\b/);
  if (lr654) return { linea: lr654[1], referencia: lr654[2] };
  if (tipoV2Id === 2) {
    return { linea: parseLinea638FromDesc(descripcion), referencia: String(KYLY_REF_CODIGO_PROVEEDOR) };
  }
  return { linea: "0", referencia: "0" };
}

function color638Display(l: CostosTxtLinea): string {
  if (l.imagenColorExcel && l.imagenColorExcel !== "0") return l.imagenColorExcel.toUpperCase();
  const c = String(l.color ?? "").trim();
  if (!c || c === "0") return "0";
  return c.startsWith("K") ? c.toUpperCase() : `K${c}`;
}

/**
 * Etiqueta pilares UI — 654: L-R-M-C · 638: L-11-M-C-G (5 pilares · ley 2.01.04.021).
 */
export function labelMoleculaCostos(l: CostosTxtLinea): string {
  if (is638Costos(l)) {
    const L = resolveLinea638(l);
    const R = String(KYLY_REF_CODIGO_PROVEEDOR);
    const M = l.material && l.material !== "0" ? l.material.toUpperCase() : "0";
    const C = color638Display(l);
    const G = l.grada && l.grada !== "0" ? l.grada : "0";
    return `${L}-${R}-${M}-${C}-${G}`;
  }
  const parts = [l.linea, l.referencia, l.material, l.color].map((x) => String(x ?? "").trim());
  if (parts.every((p) => !p || p === "0")) return "—";
  return parts.map((p) => (p && p !== "0" ? p : "0")).join("-");
}

/** Pilares imagen Storage — paridad PE · DepositoProductThumb · ley 2.01.04.021. */
export function pilaresImagenCostos(l: CostosTxtLinea): {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  tipoV2Id: 1 | 2;
  imagenColorExcel: string | null;
} {
  if (is638Costos(l)) {
    const linea = resolveLinea638(l);
    const colorExcel = l.imagenColorExcel ?? (l.color && l.color !== "0" ? color638Display(l) : null);
    return {
      linea,
      referencia: String(KYLY_REF_CODIGO_PROVEEDOR),
      material: l.material,
      color: l.color,
      tipoV2Id: 2,
      imagenColorExcel: colorExcel,
    };
  }
  return {
    linea: l.linea,
    referencia: l.referencia,
    material: l.material,
    color: l.color,
    tipoV2Id: 1,
    imagenColorExcel: l.imagenColorExcel,
  };
}

/** Post-parse 638 — ref Kyly + línea desde K si hace falta. */
export function enrich638Pilares(l: CostosTxtLinea): void {
  if (!is638Costos(l)) return;
  if (!l.referencia || l.referencia === "0") l.referencia = String(KYLY_REF_CODIGO_PROVEEDOR);
  if (!l.linea || l.linea === "0") l.linea = resolveLinea638(l);
}
