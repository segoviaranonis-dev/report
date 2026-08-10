/**
 * Lookup Jul↔Ago USD para columnas en la grilla Excel AL.
 * Fuente: comparacion-ago-vs-jul.json (isla · USD vs USD + %).
 */

import comparacion from "./comparacion-ago-vs-jul.json";

export type CmpUsdFila = {
  concepto: string;
  label: string | null;
  julio_base_usd?: number | null;
  agosto_sitfin_usd?: number | null;
  pct_usd_sitfin_vs_jul?: number | null;
  pct_nexus_vs_jul?: number | null;
  molKey: string | null;
};

type CmpJson = {
  comparacion?: { tasa_julio?: number; tasa_agosto?: number };
  base?: { tasaUsd?: number; archivo?: string };
  actual?: { tasaUsd?: number };
  filas: CmpUsdFila[];
};

const DATA = comparacion as CmpJson;

export const CMP_TASA_JULIO =
  DATA.comparacion?.tasa_julio ?? DATA.base?.tasaUsd ?? 6085;
export const CMP_TASA_AGOSTO =
  DATA.comparacion?.tasa_agosto ?? DATA.actual?.tasaUsd ?? 5970.96;
export const CMP_ARCHIVO_JUL =
  DATA.base?.archivo ?? "07.SITUACION_FINANCIERA_01072026.xlsx";

/** Índice por molKey exacta + por stem (cheques ← cheques:2026-08). */
function buildIndex(): {
  byMol: Map<string, CmpUsdFila>;
  byStem: Map<string, CmpUsdFila>;
  byLabel: Map<string, CmpUsdFila>;
} {
  const byMol = new Map<string, CmpUsdFila>();
  const byStem = new Map<string, CmpUsdFila>();
  const byLabel = new Map<string, CmpUsdFila>();
  for (const f of DATA.filas || []) {
    if (f.molKey) byMol.set(f.molKey, f);
    byStem.set(f.concepto, f);
    if (f.molKey?.includes(":")) {
      const stem = f.molKey.split(":")[0];
      if (stem && !byStem.has(stem)) byStem.set(stem, f);
    }
    if (f.label) byLabel.set(f.label.trim().toUpperCase(), f);
  }
  return { byMol, byStem, byLabel };
}

const IDX = buildIndex();

/**
 * Solo llena Jul↔Ago en el bloque Agosto (mes base de la comparación).
 * Otras filas (sep, oct…) → null (celdas vacías).
 */
export function lookupCmpUsd(opts: {
  molKey: string | null | undefined;
  label: string | null | undefined;
  mesCtx: string | null | undefined;
}): CmpUsdFila | null {
  const mes = opts.mesCtx || null;
  const mk = opts.molKey || null;

  // Aging / claves sin mes: siempre son el par Jul↔Ago del corte
  const sinMes =
    !!mk &&
    (mk.startsWith("aging:") ||
      mk.startsWith("dificil:") ||
      mk.startsWith("banco:"));

  const esAgosto =
    mes === "2026-08" ||
    (mk != null && mk.includes(":2026-08")) ||
    sinMes;

  if (!esAgosto) return null;

  if (mk && IDX.byMol.has(mk)) return IDX.byMol.get(mk)!;

  if (mk?.includes(":")) {
    const stem = mk.split(":")[0];
    // Solo stem de agosto (o sin mes)
    if (
      mk.endsWith(":2026-08") ||
      sinMes ||
      !/:\d{4}-\d{2}/.test(mk)
    ) {
      if (stem && IDX.byStem.has(stem)) return IDX.byStem.get(stem)!;
    }
  }

  const lab = (opts.label || "").trim().toUpperCase();
  if (lab && IDX.byLabel.has(lab)) return IDX.byLabel.get(lab)!;

  return null;
}

export function fmtCmpUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtCmpPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
