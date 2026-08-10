import type { ExcelAlRow } from "./types";

/** Origen de respaldo visual: TXT limpio vs carga manual vs cálculo. */
export type SfRespaldoOrigen = "txt" | "manual" | "calc" | "pendiente";

const MES_ES: Record<string, string> = {
  ENERO: "01",
  FEBRERO: "02",
  MARZO: "03",
  ABRIL: "04",
  MAYO: "05",
  JUNIO: "06",
  JULIO: "07",
  AGOSTO: "08",
  SEPTIEMBRE: "09",
  SETIEMBRE: "09",
  OCTUBRE: "10",
  NOVIEMBRE: "11",
  DICIEMBRE: "12",
};

/**
 * Mes embebido en el concepto Excel, p.ej. "CHEQUES A VENCER-ENERO 27" → 2027-01.
 * "HASTA ULTIMO" / cola futura → 2027+ (TXT ENE26 AL 2029).
 */
export function mesDesdeLabel(label: string): string | null {
  const u = (label || "").toUpperCase();
  if (u.includes("HASTA ULTIMO") || u.includes("ULTIMO VTO")) return "2027+";
  const m = u.match(
    /\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(\d{2,4})\b/
  );
  if (!m) return null;
  const mm = MES_ES[m[1]] || "01";
  let yy = m[2];
  if (yy.length === 2) yy = `20${yy}`;
  return `${yy}-${mm}`;
}

export function origenRespaldo(molKey: string | null): SfRespaldoOrigen | null {
  if (!molKey) return null;
  if (molKey.startsWith("disponible:")) return "calc";
  if (
    molKey.startsWith("cheques:") ||
    molKey.startsWith("clientes:") ||
    molKey.startsWith("aging:") ||
    molKey.startsWith("pv:") ||
    molKey.startsWith("mercaderia:") ||
    molKey.startsWith("luisito:") ||
    molKey.startsWith("tipo_cobro:") ||
    molKey === "dificil:total" ||
    /^dificil:v\d/.test(molKey)
  ) {
    return "txt";
  }
  // dificil:YYYY-MM = proyección mes Excel (no saldo corte TXT)
  if (molKey.startsWith("dificil:")) return "manual";
  if (molKey.startsWith("pendiente:")) return "pendiente";
  if (
    molKey.startsWith("banco:") ||
    molKey.startsWith("manual:") ||
    molKey.startsWith("bazzar:")
  ) {
    return "manual";
  }
  return null;
}

/** Resuelve clave molecular para una fila Excel + mes de contexto (columna Mes). */
export function molKeyForExcelRow(
  row: ExcelAlRow,
  mesCtx: string | null
): string | null {
  if (
    row.kind === "spacer" ||
    row.kind === "tasa" ||
    row.kind === "prevision" ||
    row.kind === "section" ||
    row.kind === "subheader"
  ) {
    return null;
  }
  const label = (row.label || "").trim().toUpperCase();
  /** Prioridad: mes en el texto del concepto > columna Mes > contexto de bloque */
  const mesLabel = mesDesdeLabel(row.label || "");
  const mes = mesLabel || row.mes || mesCtx;

  if (label.includes("BANCO CONTINENTAL") && label.includes("USD"))
    return "banco:CONTINENTAL:USD";
  if (label.includes("BANCO CONTINENTAL")) return "banco:CONTINENTAL:GS";
  if (label.includes("ITAU")) return "banco:ITAU:GS";
  if (label.includes("BANCOOP") && label.includes("USD"))
    return "banco:BANCOOP:USD";
  if (label.includes("BANCOOP")) return "banco:BANCOOP:GS";
  if (label.includes("GNB")) return "banco:GNB:GS";
  if (label.includes("BNF")) return "banco:BNF:GS";

  if (label.includes("CHEQUES A VENCER") && mes) return `cheques:${mes}`;

  const labNorm = label.replace(/\s+/g, " ");
  /** Difícil cobro: Excel Sit Fin (sin filtro DIFICIL/SALEMMA en TXT) */
  if (labNorm.includes("DIF") && labNorm.includes("COBRO")) {
    if (labNorm.includes("TOTAL")) return "dificil:total";
    if (labNorm.includes("MAYOR") && labNorm.includes("180"))
      return "dificil:v180p";
    if (labNorm.includes("VENCIDOS A 30")) return "dificil:v30";
    if (labNorm.includes("VENCIDOS A 60")) return "dificil:v60";
    if (labNorm.includes("VENCIDOS A 90")) return "dificil:v90";
    if (labNorm.includes("VENCIDOS A 120") || labNorm.includes("120 DIAS"))
      return "dificil:v120";
    if (labNorm.includes("VENCIDOS A 150") || labNorm.includes("150 DIAS"))
      return "dificil:v150";
    if (labNorm.includes("VENCIDOS A 180") || labNorm.includes("180 DIAS"))
      return "dificil:v180";
    if (mes) return `dificil:${mes}`;
    return "dificil:total";
  }

  if (label === "SALDO DE CLIENTES" || label.startsWith("SALDO DE CLIENTES ")) {
    if (labNorm.includes("MAYOR") && labNorm.includes("180"))
      return "aging:v180p";
    if (labNorm.includes("VENCIDOS A 30")) return "aging:v30";
    if (labNorm.includes("VENCIDOS A 60")) return "aging:v60";
    if (labNorm.includes("VENCIDOS A 90")) return "aging:v90";
    if (labNorm.includes("VENCIDOS A 120")) return "aging:v120";
    if (labNorm.includes("VENCIDOS A 150")) return "aging:v150";
    if (labNorm.includes("VENCIDOS A 180")) return "aging:v180";
    return mes ? `clientes:${mes}` : "clientes:corte";
  }
  if (labNorm.includes("CLIENTES VENCIDOS") || labNorm.includes("VENCIDOS")) {
    if (labNorm.includes("MAYOR") && labNorm.includes("180"))
      return "aging:v180p";
    if (labNorm.includes("30")) return "aging:v30";
    if (labNorm.includes("60")) return "aging:v60";
    if (labNorm.includes("90")) return "aging:v90";
    if (labNorm.includes("120")) return "aging:v120";
    if (labNorm.includes("150")) return "aging:v150";
    if (labNorm.includes("180")) return "aging:v180";
  }
  if (labNorm.includes("MAYORES A 180")) return "aging:v180p";
  if (
    (label.includes("MERCADERIAS A ENTREGAR") ||
      label.includes("PV Y PROG")) &&
    mes
  ) {
    return label.includes("MERCADER") ? `mercaderia:${mes}` : `pv:${mes}`;
  }
  if (label.includes("PAGOS") && label.includes("BAZZAR")) return "bazzar:manual";
  if (label.includes("LUISITO")) {
    if (mes) return `luisito:${mes}`;
    return "luisito:cuadro";
  }
  if (label.includes("PAGO A PROVEEDORES")) return "manual:PAGO A PROVEEDORES";
  if (label.includes("GASTOS DE DESPACHO")) return "manual:GASTOS DE DESPACHO";
  if (label.includes("PREVISION GASTOS"))
    return "manual:PREVISION GASTOS OPERATIVOS";
  if (label.includes("PRESTAMO")) return "manual:PRESTAMO BANCARIO";

  if (row.kind === "total_yellow" && mes) return `disponible:${mes}`;
  if (row.kind === "total_yellow") {
    const ym = mesDesdeLabel(row.label || "") || mes;
    if (ym && !ym.includes("+")) return `disponible:${ym}`;
  }

  return null;
}

/** Mes implícito del bloque agosto (filas sin columna Mes al inicio). */
export function inferMesContext(
  row: ExcelAlRow,
  prev: string | null
): string | null {
  if (row.mes) return row.mes;
  if (row.kind === "total_yellow") {
    const k = molKeyForExcelRow(row, prev);
    if (k?.startsWith("disponible:")) return k.slice("disponible:".length);
  }
  // Primer bloque Excel AL = agosto 2026 hasta el primer mescol
  if (!prev && row.kind === "row") return "2026-08";
  return prev;
}
