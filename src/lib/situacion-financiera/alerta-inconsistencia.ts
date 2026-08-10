/**
 * Texto de burbuja para Guido — nombres de archivo REALES del intake AL.
 * Implementación: claridad > jerga. Canon isla = TXT cuando hay respaldo limpio.
 */

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
  /** Si el mapa ya trae pares explícitos */
  archivoExcel?: string | null;
  archivoTxt?: string | null;
};

/** Excel de la hoja que Guido ve en Report (réplica AL). */
export const ARCHIVO_EXCEL_AL = "SF AL 03-08.xlsx";

/** Saldo ERP usado en cruce Luisito / DIFICIL (stock clientes). */
export const ARCHIVO_SALDO_TXT = "SALDO CLIENTES DETALLADO AL 03-08.txt";

/** Maestro de tipo cobro (columna TIPO COBRO). */
export const ARCHIVO_CLIENTES_XLSX = "clientes.xlsx";

const CHEQUES_POR_MES: Record<string, string> = {
  "2026-08": "1.CHEQUES A VENCER_AGO26.txt",
  "2026-09": "2.CHEQUES A VENCER_SEPT26.txt",
  "2026-10": "3.CHEQUES A VENCER_OCT26.txt",
  "2026-11": "4.CHEQUES A VENCER_NOV26.txt",
  "2026-12": "5.CHEQUES A VENCER_DIC26.txt",
  "2027-01": "6.CHEQUES A VENCER_ENE26 AL 2029.txt",
};

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

/** Resuelve el archivo TXT limpio que respalda la fila. */
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
    return "PV Y PROG.txt (referencia; canon mes = Excel Guido)";
  }
  if (mapa.archivo?.includes("clientes.xlsx")) {
    return `${ARCHIVO_CLIENTES_XLSX} + ${ARCHIVO_SALDO_TXT}`;
  }
  if (mapa.archivo?.includes("SALDO CLIENTES")) return ARCHIVO_SALDO_TXT;
  return mapa.archivo?.trim() || "TXT limpio del intake (ver pestaña Auditoría)";
}

/** Excel admin / plantilla de la celda. */
export function resolverArchivoExcel(mapa: MapaAlerta): string {
  if (mapa.archivoExcel && mapa.archivoExcel.trim())
    return mapa.archivoExcel.trim();
  if (mapa.archivo?.includes("DIF.COBRO")) {
    return `${ARCHIVO_EXCEL_AL} · bloque DIF.COBRO`;
  }
  if (mapa.origen === "excel_prevision" || mapa.estado === "excel_prevision") {
    return `${ARCHIVO_EXCEL_AL} · celda de previsión mes`;
  }
  return ARCHIVO_EXCEL_AL;
}

export type ExplicacionAlerta = {
  badge: "Δ" | "TXT";
  titulo: string;
  quePaso: string;
  archivoExcel: string;
  archivoTxt: string;
  montoExcel: string;
  montoTxt: string;
  delta: string;
  canon: string;
  queHacer: string;
  concepto: string;
};

export function explicarAlerta(
  badge: "Δ" | "TXT",
  mapa: MapaAlerta
): ExplicacionAlerta {
  const archivoExcel = resolverArchivoExcel(mapa);
  const archivoTxt = resolverArchivoTxt(mapa);
  const concepto = (mapa.label || mapa.molKey || "fila").trim();
  const esDescuadre = badge === "Δ";

  return {
    badge,
    titulo: esDescuadre
      ? "Inconsistencia: el Excel y el TXT no coinciden"
      : "Excel vacío · el monto viene del TXT",
    quePaso: esDescuadre
      ? `En la fila «${concepto}» el número del Excel NO es igual a la suma del TXT limpio. Sit Fin (isla) muestra el TXT como verdad; el Δ queda visible para revisar el mapeo — no se “arregla” editando el JSON.`
      : `En la fila «${concepto}» la celda del Excel estaba en 0 o vacía. El TXT limpio sí tiene monto; por eso la pantalla muestra el TXT.`,
    archivoExcel,
    archivoTxt,
    montoExcel: `${fmtGs(mapa.excelGs)} Gs`,
    montoTxt: `${fmtGs(mapa.txtGs)} Gs`,
    delta: esDescuadre
      ? `${fmtGs(mapa.delta)} Gs  (Excel − TXT)`
      : "— (Excel vacío)",
    canon: `${fmtGs(mapa.canonGs ?? mapa.txtGs)} Gs  ← TXT manda`,
    queHacer: esDescuadre
      ? "Compará esos dos archivos con el mismo concepto. Si el Excel admin proyecta distinto al stock TXT, está bien: el Δ es señal, no error de pantalla."
      : "Abrí el TXT indicado; ahí está el detalle molecular (▸). El Excel no aportó cifra en esa celda.",
    concepto,
  };
}
