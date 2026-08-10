/**
 * Burbujas ⚠ Δ / TXT — SOLO integridad canon Guido ↔ TXT limpio.
 *
 * Canones:
 *   Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx
 *   Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx
 *
 * Prohibido: mencionar SF AL / grilla AL / legajo con errores.
 * Sin canon para el mes (sep…) → no hay burbuja.
 */

import julCanon from "./referencia-admin-jul-0107.json";
import agoCanon from "./referencia-admin-ago-0108.json";
import {
  CMP_ARCHIVO_AGO,
  CMP_ARCHIVO_JUL,
  CMP_PATH_AGO,
  CMP_PATH_JUL,
} from "./cmp-usd-lookup";

export type MapaAlerta = {
  molKey: string | null;
  origen?: string;
  estado?: string;
  excelGs?: number | null;
  txtGs: number | null;
  canonGs?: number | null;
  delta?: number | null;
  archivo?: string | null;
  label?: string | null;
  archivoTxt?: string | null;
  mesCtx?: string | null;
};

export const ARCHIVO_SALDO_TXT = "SALDO CLIENTES DETALLADO AL 03-08.txt";
export const ARCHIVO_CLIENTES_XLSX = "clientes.xlsx";

const CHEQUES_POR_MES: Record<string, string> = {
  "2026-08": "1.CHEQUES A VENCER_AGO26.txt",
  "2026-09": "2.CHEQUES A VENCER_SEPT26.txt",
  "2026-10": "3.CHEQUES A VENCER_OCT26.txt",
  "2026-11": "4.CHEQUES A VENCER_NOV26.txt",
  "2026-12": "5.CHEQUES A VENCER_DIC26.txt",
  "2027-01": "6.CHEQUES A VENCER_ENE26 AL 2029.txt",
};

type BaseMes = Record<string, { gs?: number; usd?: number; label?: string }>;

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}

function esNombreTxtReal(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  return t.toLowerCase().endsWith(".txt") && !t.includes("*") && !t.includes("·");
}

/** ¿La etiqueta es un TXT (o TXT+padron) usable en burbuja? Nunca SF AL / solo Excel. */
export function esFuenteTxtComparacion(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const u = s.trim().toUpperCase();
  if (u.includes("SF AL")) return false;
  if (u.includes("PREVISIÓN MES") || u.includes("PREVISION MES")) return false;
  if (u.includes("CELDA PREVISIÓN") || u.includes("CELDA PREVISION")) return false;
  if (u.includes("BLOQUE DIF.COBRO")) return false;
  // Debe citar al menos un .TXT (permite "clientes.xlsx + SALDO….txt")
  if (!u.includes(".TXT")) return false;
  // Si solo hay .XLSX sin .TXT ya falló arriba
  return true;
}

function stemConcepto(molKey: string | null | undefined): string | null {
  if (!molKey) return null;
  if (molKey.startsWith("aging:") || molKey.startsWith("dificil:")) return molKey;
  if (molKey.startsWith("banco:")) {
    const parts = molKey.split(":");
    if (parts.length >= 3) {
      return `banco:${parts[1].toLowerCase()}_${parts[2].toLowerCase()}`;
    }
  }
  return molKey.split(":")[0] || null;
}

/** Solo Jul/Ago tienen Excel canon. */
export function mesCanonDeMol(
  molKey: string | null | undefined,
  mesCtx?: string | null
): "2026-07" | "2026-08" | null {
  if (molKey && /:(\d{4}-\d{2})/.test(molKey)) {
    const ym = molKey.match(/:(\d{4}-\d{2})/)?.[1];
    if (ym === "2026-07" || ym === "2026-08") return ym;
    return null;
  }
  if (
    molKey &&
    (molKey.startsWith("aging:") ||
      molKey.startsWith("dificil:") ||
      molKey.startsWith("banco:"))
  ) {
    return "2026-08";
  }
  if (mesCtx === "2026-07" || mesCtx === "2026-08") return mesCtx;
  return null;
}

export function montoCanonGs(
  molKey: string | null | undefined,
  mesCtx?: string | null
): {
  path: string;
  archivo: string;
  gs: number | null;
  mes: "julio" | "agosto" | null;
} {
  const mes = mesCanonDeMol(molKey, mesCtx);
  const stem = stemConcepto(molKey);
  if (!mes || !stem) {
    return { path: "", archivo: "", gs: null, mes: null };
  }
  if (mes === "2026-07") {
    const base = (julCanon as { base_mes?: BaseMes }).base_mes || {};
    const gs = base[stem] != null ? Number(base[stem].gs) : null;
    return {
      path: CMP_PATH_JUL,
      archivo: CMP_ARCHIVO_JUL,
      gs: gs != null && Number.isFinite(gs) ? gs : null,
      mes: "julio",
    };
  }
  const base = (agoCanon as { base_mes?: BaseMes }).base_mes || {};
  const gs = base[stem] != null ? Number(base[stem].gs) : null;
  return {
    path: CMP_PATH_AGO,
    archivo: CMP_ARCHIVO_AGO,
    gs: gs != null && Number.isFinite(gs) ? gs : null,
    mes: "agosto",
  };
}

export function resolverArchivoTxt(mapa: {
  molKey?: string | null;
  archivo?: string | null;
  archivoTxt?: string | null;
}): string {
  const cand = mapa.archivoTxt?.trim() || "";
  if (cand && esFuenteTxtComparacion(cand)) return cand;
  if (esNombreTxtReal(mapa.archivo) && esFuenteTxtComparacion(mapa.archivo)) {
    return mapa.archivo!.trim();
  }
  const key = mapa.molKey || "";
  if (key.startsWith("cheques:")) {
    const ym = key.slice("cheques:".length);
    return CHEQUES_POR_MES[ym] || "CHEQUES A VENCER_*.txt";
  }
  if (key.startsWith("aging:")) return ARCHIVO_SALDO_TXT;
  if (key.startsWith("luisito:") || key.startsWith("dificil:")) {
    return `${ARCHIVO_CLIENTES_XLSX} + ${ARCHIVO_SALDO_TXT}`;
  }
  // Previsión mes (PV / mercadería / clientes) · NO usar PV Y PROG como falso TXT de integridad
  if (
    key.startsWith("pv:") ||
    key.startsWith("mercaderia:") ||
    key.startsWith("clientes:")
  ) {
    return "";
  }
  if (mapa.archivo?.includes("clientes.xlsx") && mapa.archivo?.includes(".txt")) {
    return `${ARCHIVO_CLIENTES_XLSX} + ${ARCHIVO_SALDO_TXT}`;
  }
  if (
    mapa.archivo?.includes("SALDO CLIENTES") &&
    !mapa.archivo?.toUpperCase().includes("SF AL")
  ) {
    return ARCHIVO_SALDO_TXT;
  }
  return "";
}

/**
 * Burbuja solo si TXT y canon miden el MISMO objeto.
 * Off: previsión mes · Luisito stock≠cuota mes · aging/dificil (universos distintos hasta alinear).
 * On: cheques Jul/Ago (Σ líneas = pie TXT = celda canon) — lección reclamo Guido 2.3.1.50.25.
 */
export function molKeyPermiteBurbujaIntegridad(
  molKey: string | null | undefined
): boolean {
  if (!molKey) return false;
  if (molKey.startsWith("cheques:")) {
    const ym = molKey.slice("cheques:".length);
    return ym === "2026-07" || ym === "2026-08";
  }
  return false;
}

export type BadgeIntegridad = "Δ" | "TXT";

/** ¿Hay burbuja? Solo si existe canon Jul/Ago y hay señal vs TXT. */
export function evaluarIntegridadCanonTxt(opts: {
  molKey: string | null | undefined;
  mesCtx: string | null | undefined;
  txtGs: number | null | undefined;
  label?: string | null;
  archivo?: string | null;
  archivoTxt?: string | null;
}): {
  badge: BadgeIntegridad;
  canonGs: number;
  txtGs: number;
  delta: number;
  path: string;
  archivo: string;
  archivoTxt: string;
  label: string;
} | null {
  if (!molKeyPermiteBurbujaIntegridad(opts.molKey)) return null;

  const mes = mesCanonDeMol(opts.molKey, opts.mesCtx);
  if (!mes) return null;

  const c = montoCanonGs(opts.molKey, opts.mesCtx);
  if (!c.mes || c.gs == null) return null;

  const archivoTxt = resolverArchivoTxt({
    molKey: opts.molKey,
    archivo: opts.archivo,
    archivoTxt: opts.archivoTxt,
  });
  // Ley Faro: burbuja solo canon ↔ TXT real. Sin TXT → sin burbuja (no SF AL).
  if (!esFuenteTxtComparacion(archivoTxt)) return null;

  const txt = opts.txtGs;
  if (txt == null || Number.isNaN(txt)) return null;

  const delta = c.gs - txt;
  const abs = Math.abs(delta);
  if (abs <= 1 && !(c.gs === 0 && txt !== 0)) return null;

  let badge: BadgeIntegridad = "Δ";
  if ((c.gs === 0 || c.gs == null) && txt !== 0) badge = "TXT";
  else if (abs <= 1) return null;

  return {
    badge,
    canonGs: c.gs,
    txtGs: txt,
    delta,
    path: c.path,
    archivo: c.archivo,
    archivoTxt,
    label: (opts.label || opts.molKey || "concepto").trim(),
  };
}

export type ExplicacionAlerta = {
  badge: BadgeIntegridad;
  titulo: string;
  quePaso: string;
  archivoExcel: string;
  montoExcel: string;
  archivoTxt: string;
  montoTxt: string;
  delta: string;
  muestraSitFin: string;
  queHacer: string;
  concepto: string;
};

export function explicarAlerta(
  badge: BadgeIntegridad,
  mapa: MapaAlerta
): ExplicacionAlerta {
  const ev = evaluarIntegridadCanonTxt({
    molKey: mapa.molKey,
    mesCtx: mapa.mesCtx,
    txtGs: mapa.txtGs,
    label: mapa.label,
    archivo: mapa.archivo,
    archivoTxt: mapa.archivoTxt,
  });

  const concepto = (mapa.label || mapa.molKey || "fila").trim();
  const path = ev?.path || "";
  const archivoTxt = ev?.archivoTxt || resolverArchivoTxt(mapa) || "(sin TXT — no comparar)";
  const canonGs = ev?.canonGs ?? null;
  const txtGs = ev?.txtGs ?? mapa.txtGs;
  const delta = ev?.delta ?? null;
  const esDescuadre = badge === "Δ";

  return {
    badge,
    titulo: esDescuadre
      ? "Integridad: canon Guido ≠ TXT limpio"
      : "Canon sin monto · TXT tiene respaldo",
    quePaso: esDescuadre
      ? `En «${concepto}» el monto del Excel canon no coincide con la suma del TXT limpio. Revisá esos dos archivos. Sit Fin muestra el TXT como respaldo operativo.`
      : `En «${concepto}» el Excel canon no trae cifra (0/vacío) y el TXT sí. Sit Fin muestra el TXT.`,
    archivoExcel: path || "—",
    montoExcel: `${fmtGs(canonGs)} Gs`,
    archivoTxt,
    montoTxt: `${fmtGs(txtGs)} Gs`,
    delta: esDescuadre
      ? `${fmtGs(delta)} Gs  (canon − TXT)`
      : "—",
    muestraSitFin: `${fmtGs(txtGs)} Gs  ← TXT operativo`,
    queHacer: `Abrí el canon (${CMP_ARCHIVO_JUL} o ${CMP_ARCHIVO_AGO}) y el TXT. El Δ es señal de integridad — no se parchea en JSON. La comparación USD Jul↔Ago es el botón Activar comparación.`,
    concepto,
  };
}
