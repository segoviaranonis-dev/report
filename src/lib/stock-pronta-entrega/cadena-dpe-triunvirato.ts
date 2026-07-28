/**
 * Ley Director · DPE — cadena comercial SOLO triunvirato Excel (COD.GRUPO).
 * BCL (programado + compra previa) PROHIBIDO en segregación PE.
 *
 * Fuentes válidas: sdrm1021.csv · sdrm0849.xlsx · Stock valorizado → `decodeCodGrupo`.
 * Doc Moria: `CHUSAR_LEY_DPE_SIN_BCL_20260727.md` (2.3.1.10.1.2.1)
 */
import { decodeCodGrupo } from "@/lib/pilares/cod-grupo-decode";

export type CadenaDpe = "REGULAR" | "PROMOCIONAL" | "LIQUIDACION" | "COMUN";

export type RowCadenaDpe = {
  cod_grupo?: string | null;
  marca?: string | null;
  sdrm_marca?: string | null;
  descp_marca?: string | null;
  sdrm_tipo2?: string | null;
  /** Ignorado en DPE — solo triunvirato. Presente en filas DepositoRow por compat. */
  descp_caso?: string | null;
  caso_precio?: string | null;
  es_promo?: boolean | number | string | null;
  es_liquidacion?: boolean | number | string | null;
  cadena_comercial?: string | null;
};

function marcaHint(row: RowCadenaDpe): string | null {
  const m = row.descp_marca ?? row.marca ?? row.sdrm_marca;
  return m != null ? String(m) : null;
}

/**
 * Cadena grupo uno / DPE — única puerta de segregación PE.
 * Sin COD.GRUPO → REGULAR (nunca leer BCL ni descp_caso).
 */
export function cadenaDpeTriunvirato(row: RowCadenaDpe): CadenaDpe {
  const cg = String(row.cod_grupo ?? "").trim();
  if (!cg) return "REGULAR";
  const dec = decodeCodGrupo(cg, {
    marca: marcaHint(row),
    tipo2: row.sdrm_tipo2,
  });
  const c = dec.cadenaComercial;
  if (c === "PROMOCIONAL" || c === "LIQUIDACION" || c === "COMUN") return c;
  return "REGULAR";
}

export function esPromoDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === "PROMOCIONAL";
}

export function esLiquidacionDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === "LIQUIDACION";
}

export function esComunDpe(row: RowCadenaDpe): boolean {
  return cadenaDpeTriunvirato(row) === "COMUN";
}
