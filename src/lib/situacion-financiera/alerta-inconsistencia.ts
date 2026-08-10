/**
 * Burbuja de inconsistencia para Guido.
 *
 * COMPARATIVA oficial = solo canones:
 *   Z:\hector\SF\07.SITUACION FINANCIERA 01072026.xlsx
 *   Z:\hector\SF\08.SITUACION FINANCIERA 01082026.xlsx
 *
 * SF AL 03-08.xlsx = SOLO CONTEXTO · errores conocidos · EXCLUIDO de la comparativa.
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
  origen: string;
  estado: string;
  excelGs: number | null;
  txtGs: number | null;
  canonGs: number | null;
  delta: number | null;
  archivo: string | null;
  label?: string | null;
  archivoExcel?: string | null;
  archivoTxt?: string | null;
  mesCtx?: string | null;
};

/** Réplica grilla — contexto; NUNCA comparativa. */
export const ARCHIVO_EXCEL_AL = "SF AL 03-08.xlsx";
export const ARCHIVO_EXCEL_AL_NOTA =
  "EXCLUIDO de la comparativa · errores conocidos · solo contexto de grilla";

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

function stemConcepto(molKey: string | null | undefined): string | null {
  if (!molKey) return null;
  if (molKey.startsWith("aging:") || molKey.startsWith("dificil:")) return molKey;
  if (molKey.startsWith("banco:")) {
    // banco:CONTINENTAL:USD → buscar claves canon banco:continental_usd
    const parts = molKey.split(":");
    if (parts.length >= 3) {
      return `banco:${parts[1].toLowerCase()}_${parts[2].toLowerCase()}`;
    }
  }
  const stem = molKey.split(":")[0];
  return stem || null;
}

function mesDeMol(molKey: string | null | undefined, mesCtx?: string | null): string | null {
  if (molKey && /:(\d{4}-\d{2})/.test(molKey)) {
    return molKey.match(/:(\d{4}-\d{2})/)?.[1] || null;
  }
  if (
    molKey &&
    (molKey.startsWith("aging:") ||
      molKey.startsWith("dificil:") ||
      molKey.startsWith("banco:"))
  ) {
    return "2026-08"; // aging/banco del corte → canon Agosto
  }
  return mesCtx || null;
}

/** Monto Gs del Excel canon (07 o 08) para el concepto. */
export function montoCanonGs(
  molKey: string | null | undefined,
  mesCtx?: string | null
): { path: string; archivo: string; gs: number | null; mes: "julio" | "agosto" | null } {
  const mes = mesDeMol(molKey, mesCtx);
  const stem = stemConcepto(molKey);

  if (mes === "2026-07") {
    const base = (julCanon as { base_mes?: BaseMes }).base_mes || {};
    const gs = stem && base[stem] ? Number(base[stem].gs) : null;
    return {
      path: CMP_PATH_JUL,
      archivo: CMP_ARCHIVO_JUL,
      gs: gs != null && Number.isFinite(gs) ? gs : null,
      mes: "julio",
    };
  }

  if (mes === "2026-08") {
    const base = (agoCanon as { base_mes?: BaseMes }).base_mes || {};
    // alias banco
    let gs: number | null = null;
    if (stem && base[stem]) gs = Number(base[stem].gs);
    else if (stem?.startsWith("banco:")) {
      // intentar continental_usd etc.
      const alt = stem;
      if (base[alt]) gs = Number(base[alt].gs);
    }
    return {
      path: CMP_PATH_AGO,
      archivo: CMP_ARCHIVO_AGO,
      gs: gs != null && Number.isFinite(gs) ? gs : null,
      mes: "agosto",
    };
  }

  // Otros meses (sep…): no hay Excel canon mensual — NO usar SF AL
  return {
    path: "",
    archivo: "",
    gs: null,
    mes: null,
  };
}

export function resolverArchivoTxt(mapa: MapaAlerta): string {
  if (mapa.archivoTxt && mapa.archivoTxt.trim()) return mapa.archivoTxt.trim();
  if (esNombreTxtReal(mapa.archivo)) return mapa.archivo!.trim();

  const key = mapa.molKey || "";
  if (key.startsWith("cheques:")) {
    const ym = key.slice("cheques:".length);
    return CHEQUES_POR_MES[ym] || mapa.archivo || "CHEQUES A VENCER_*.txt";
  }
  if (key.startsWith("aging:")) return ARCHIVO_SALDO_TXT;
  if (key.startsWith("luisito:") || key.startsWith("dificil:")) {
    return `${ARCHIVO_CLIENTES_XLSX} + ${ARCHIVO_SALDO_TXT}`;
  }
  if (key.startsWith("pv:") || key.startsWith("mercaderia:")) {
    return "PV Y PROG.txt (contexto; comparativa = canones Jul/Ago)";
  }
  if (mapa.archivo?.includes("clientes.xlsx")) {
    return `${ARCHIVO_CLIENTES_XLSX} + ${ARCHIVO_SALDO_TXT}`;
  }
  if (mapa.archivo?.includes("SALDO CLIENTES")) return ARCHIVO_SALDO_TXT;
  return mapa.archivo?.trim() || "TXT limpio del intake (ver pestaña Auditoría)";
}

export type ExplicacionAlerta = {
  badge: "Δ" | "TXT";
  titulo: string;
  quePaso: string;
  /** Comparativa = canon Guido (nunca SF AL) */
  archivoExcel: string;
  pathExcel: string;
  montoExcel: string;
  tieneCanon: boolean;
  archivoTxt: string;
  montoTxt: string;
  /** Contexto grilla SF AL — excluido */
  contextoSfAl: string;
  montoContextoSfAl: string;
  delta: string;
  deltaNota: string;
  muestraSitFin: string;
  queHacer: string;
  concepto: string;
};

export function explicarAlerta(
  badge: "Δ" | "TXT",
  mapa: MapaAlerta
): ExplicacionAlerta {
  const concepto = (mapa.label || mapa.molKey || "fila").trim();
  const esDescuadre = badge === "Δ";
  const archivoTxt = resolverArchivoTxt(mapa);
  const canon = montoCanonGs(mapa.molKey, mapa.mesCtx);
  const tieneCanon = !!canon.mes && canon.path !== "";

  const montoCanon = canon.gs;
  const montoTxt = mapa.txtGs;
  const deltaCanonTxt =
    montoCanon != null && montoTxt != null
      ? montoCanon - montoTxt
      : null;

  const archivoExcel = tieneCanon
    ? canon.path
    : "Sin Excel canon para este mes (solo Jul y Ago tienen canones Guido)";
  const pathExcel = tieneCanon ? canon.path : "";
  const montoExcelStr = tieneCanon
    ? `${fmtGs(montoCanon)} Gs`
    : "— (no hay canon mensual)";

  return {
    badge,
    titulo: esDescuadre
      ? tieneCanon
        ? "Revisar vs canon Guido (no vs SF AL)"
        : "TXT vs grilla · SF AL excluido de la comparativa"
      : "Celda vacía en grilla · monto desde TXT",
    quePaso: esDescuadre
      ? tieneCanon
        ? `Fila «${concepto}». La comparativa oficial es el Excel canon Guido vs el TXT limpio. «${ARCHIVO_EXCEL_AL}» tiene errores conocidos y NO entra en la comparativa (solo contexto de grilla).`
        : `Fila «${concepto}» (mes fuera de Jul/Ago). No hay Excel canon Guido para este mes. «${ARCHIVO_EXCEL_AL}» está excluido (errores conocidos). El TXT limpio es el respaldo operativo que muestra Sit Fin.`
      : `Fila «${concepto}»: la grilla no traía monto; el TXT sí. Sit Fin muestra el TXT. «${ARCHIVO_EXCEL_AL}» no se usa para comparar.`,
    archivoExcel,
    pathExcel,
    montoExcel: montoExcelStr,
    tieneCanon,
    archivoTxt,
    montoTxt: `${fmtGs(montoTxt)} Gs`,
    contextoSfAl: `${ARCHIVO_EXCEL_AL} · ${ARCHIVO_EXCEL_AL_NOTA}`,
    montoContextoSfAl: `${fmtGs(mapa.excelGs)} Gs (solo contexto)`,
    delta:
      tieneCanon && deltaCanonTxt != null
        ? `${fmtGs(deltaCanonTxt)} Gs  (canon − TXT)`
        : esDescuadre
          ? `${fmtGs(mapa.delta)} Gs  (grilla SF AL − TXT · no oficial)`
          : "—",
    deltaNota: tieneCanon
      ? `Canon: ${canon.archivo}`
      : "Δ grilla≠canon · no usar SF AL para decidir",
    muestraSitFin: `${fmtGs(mapa.canonGs ?? mapa.txtGs)} Gs  ← TXT operativo`,
    queHacer: tieneCanon
      ? `Abrí ${canon.path} y el TXT indicado. Si difieren, el Δ es señal. No parchees JSON. No uses ${ARCHIVO_EXCEL_AL} para cerrar la cifra.`
      : `Para métricas Jul↔Ago usá Activar comparación (canones ${CMP_ARCHIVO_JUL} ↔ ${CMP_ARCHIVO_AGO}). Este mes no tiene Excel canon: mirá el TXT; ignorá ${ARCHIVO_EXCEL_AL} en la comparativa.`,
    concepto,
  };
}
