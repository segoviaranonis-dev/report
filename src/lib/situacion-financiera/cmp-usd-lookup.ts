/**
 * Lookup Jul↔Ago USD — SOLO canones admin Guido.
 *
 * Canon:
 *   Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx
 *   Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx
 *
 * Columnas UI = julio_base_usd · agosto_canon_usd · pct_usd_canon
 * Sit Fin / SF AL / TXT = auditoría; no definen el %.
 */

import comparacion from "./comparacion-ago-vs-jul.json";

export type CmpUsdFila = {
  concepto: string;
  label: string | null;
  julio_base_usd?: number | null;
  /** Canon Agosto = Excel admin 08… */
  agosto_canon_usd?: number | null;
  agosto_admin_usd?: number | null;
  /** @deprecated UI ya no usa Sit Fin para columnas */
  agosto_sitfin_usd?: number | null;
  pct_usd_canon?: number | null;
  pct_usd_admin_ago_vs_jul?: number | null;
  pct_usd_sitfin_vs_jul?: number | null;
  pct_nexus_vs_jul?: number | null;
  molKey: string | null;
  fuente_julio?: string | null;
  fuente_agosto?: string | null;
};

type CmpJson = {
  canon?: {
    julio?: { path?: string; archivo?: string; tasaUsd?: number };
    agosto?: { path?: string; archivo?: string; tasaUsd?: number };
  };
  comparacion?: {
    tasa_julio?: number;
    tasa_agosto?: number;
    modo?: string;
  };
  base?: { tasaUsd?: number; archivo?: string; path?: string };
  actual?: { tasaUsd?: number; archivo?: string; path?: string };
  filas: CmpUsdFila[];
};

const DATA = comparacion as CmpJson;

export const CMP_TASA_JULIO =
  DATA.canon?.julio?.tasaUsd ??
  DATA.comparacion?.tasa_julio ??
  DATA.base?.tasaUsd ??
  6085;
export const CMP_TASA_AGOSTO =
  DATA.canon?.agosto?.tasaUsd ??
  DATA.comparacion?.tasa_agosto ??
  DATA.actual?.tasaUsd ??
  5970.96;

export const CMP_PATH_JUL =
  DATA.canon?.julio?.path ??
  DATA.base?.path ??
  String.raw`Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx`;
export const CMP_PATH_AGO =
  DATA.canon?.agosto?.path ??
  DATA.actual?.path ??
  String.raw`Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx`;
export const CMP_ARCHIVO_JUL =
  DATA.canon?.julio?.archivo ??
  DATA.base?.archivo ??
  "07.SITUACION FINANCIERA 01072026.xlsx";
export const CMP_ARCHIVO_AGO =
  DATA.canon?.agosto?.archivo ??
  DATA.actual?.archivo ??
  "08.SITUACION FINANCIERA 01082026.xlsx";

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

export function lookupCmpUsd(opts: {
  molKey: string | null | undefined;
  label: string | null | undefined;
  mesCtx: string | null | undefined;
}): CmpUsdFila | null {
  const mes = opts.mesCtx || null;
  const mk = opts.molKey || null;

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
    if (mk.endsWith(":2026-08") || sinMes || !/:\d{4}-\d{2}/.test(mk)) {
      if (stem && IDX.byStem.has(stem)) return IDX.byStem.get(stem)!;
    }
  }

  const lab = (opts.label || "").trim().toUpperCase();
  if (lab && IDX.byLabel.has(lab)) return IDX.byLabel.get(lab)!;

  return null;
}

/** USD Agosto canon (Excel 08…). */
export function usdAgostoCanon(f: CmpUsdFila | null | undefined): number | null {
  if (!f) return null;
  const v = f.agosto_canon_usd ?? f.agosto_admin_usd;
  return v == null || Number.isNaN(v) ? null : v;
}

/** % variación canon (Ago admin − Jul admin) / |Jul|. */
export function pctCanon(f: CmpUsdFila | null | undefined): number | null {
  if (!f) return null;
  const v = f.pct_usd_canon ?? f.pct_usd_admin_ago_vs_jul;
  return v == null || Number.isNaN(v) ? null : v;
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
