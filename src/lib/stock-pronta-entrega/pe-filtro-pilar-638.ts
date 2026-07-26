import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { isConfecciones638 } from "@/lib/deposito-rimec/grada-abierta-638";
import {
  buildFamiliaClusters,
  esTokenNumerico,
  familiaKeyFromDescripcion,
} from "@/lib/pilares/agrupar-etiqueta-pilar";
import { etiquetaFiltroPilar, primeraPalabraPilar } from "@/lib/pilares/primera-palabra-pilar";

/** Estilos 638 genéricos — no son col J comercial. */
const ESTILOS_638_GENERICOS = new Set([
  "CONFECCIONES",
  "CALZADO",
  "SIN ESTILO",
  "(SIN ESTILO)",
]);

/** Código sintético Kyly (K{linea} · K{color}) — no etiqueta UI. */
export function esCodigoSintetico638(raw: string | null | undefined): boolean {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return true;
  if (/^K\d+$/.test(t)) return true;
  return false;
}

export function estilo638Comercial(row: DepositoRow): string | null {
  const e = String(row.estilo ?? "").trim();
  if (!e) return null;
  const u = e.toUpperCase();
  if (ESTILOS_638_GENERICOS.has(u)) return null;
  if (esCodigoSintetico638(e)) return null;
  return e;
}

/**
 * Material sidebar PE — 638: estilo prenda (Excel col J / grupo_estilo).
 * 654: primera palabra descp_material (Napa, Poliamida…).
 */
export function materialTokenFiltroPe(row: DepositoRow): string | null {
  if (isConfecciones638(row.tipo_v2_id)) {
    const est = estilo638Comercial(row);
    return est ? etiquetaFiltroPilar(est) : null;
  }
  const dm = String(row.descp_material ?? "").trim();
  if (!dm || esCodigoSintetico638(dm)) return null;
  const tok = primeraPalabraPilar(dm);
  if (!tok || esTokenNumerico(tok)) return null;
  return etiquetaFiltroPilar(tok);
}

/** Color sidebar PE — humano; 638 evita códigos K sin nombre pilar. */
export function colorTokenFiltroPe(row: DepositoRow): string | null {
  const dc = String(row.descp_color ?? "").trim();
  if (dc && !esCodigoSintetico638(dc)) {
    const tok = primeraPalabraPilar(dc);
    if (tok && !esTokenNumerico(tok)) return etiquetaFiltroPilar(tok);
  }
  return null;
}

/** Color tarjeta PE — oculta códigos K sin nombre pilar. */
export function descpColorUiPe(row: DepositoRow): string | null {
  const dc = String(row.descp_color ?? "").trim();
  if (dc && !esCodigoSintetico638(dc)) return dc;
  return null;
}

/** Texto material tarjeta PE — 638 no muestra hash K. */
export function descpMaterialUiPe(row: DepositoRow): string | null {
  if (isConfecciones638(row.tipo_v2_id)) {
    const est = estilo638Comercial(row);
    if (est) return est;
    const dm = String(row.descp_material ?? "").trim();
    if (dm && !esCodigoSintetico638(dm)) return dm;
    return null;
  }
  return row.descp_material?.trim() || null;
}

export function stampFamiliaPilaresPe(rows: DepositoRow[]): DepositoRow[] {
  if (!rows.length) return rows;
  const matTokens = rows.map(materialTokenFiltroPe).filter((t): t is string => Boolean(t));
  const colTokens = rows.map(colorTokenFiltroPe).filter((t): t is string => Boolean(t));
  const matMap = buildFamiliaClusters(matTokens);
  const colMap = buildFamiliaClusters(colTokens);
  return rows.map((r) => ({
    ...r,
    familia_material: (() => {
      const tok = materialTokenFiltroPe(r);
      if (!tok) return null;
      return familiaKeyFromDescripcion(tok, matMap);
    })(),
    familia_color: (() => {
      const tok = colorTokenFiltroPe(r);
      if (!tok) return null;
      return familiaKeyFromDescripcion(tok, colMap);
    })(),
  }));
}
