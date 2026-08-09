import type { ExcelAlRow } from "./types";

/** Origen de respaldo visual: TXT limpio vs carga manual vs cálculo. */
export type SfRespaldoOrigen = "txt" | "manual" | "calc" | "pendiente";

export function origenRespaldo(molKey: string | null): SfRespaldoOrigen | null {
  if (!molKey) return null;
  if (molKey.startsWith("disponible:")) return "calc";
  if (
    molKey.startsWith("cheques:") ||
    molKey.startsWith("clientes:") ||
    molKey.startsWith("aging:") ||
    molKey.startsWith("pv:") ||
    molKey.startsWith("mercaderia:")
  ) {
    return "txt";
  }
  if (molKey.startsWith("luisito:")) return "pendiente";
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
  const mes = row.mes || mesCtx;

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
  if (label === "SALDO DE CLIENTES" || label.startsWith("SALDO DE CLIENTES ")) {
    if (label.includes("VENCIDOS A 30")) return "aging:v30";
    if (label.includes("VENCIDOS A 60")) return "aging:v60";
    if (label.includes("VENCIDOS A 90")) return "aging:v90";
    if (label.includes("VENCIDOS A 120")) return "aging:v120";
    if (label.includes("VENCIDOS A 150")) return "aging:v150";
    if (label.includes("VENCIDOS A 180") && !label.includes("MAYOR"))
      return "aging:v180";
    if (label.includes("MAYOR A 180") || label.includes(">180"))
      return "aging:v180p";
    return mes ? `clientes:${mes}` : "clientes:corte";
  }
  if (label.includes("CLIENTES VENCIDOS") || label.includes("VENCIDOS")) {
    if (label.includes("30")) return "aging:v30";
    if (label.includes("60")) return "aging:v60";
    if (label.includes("90")) return "aging:v90";
    if (label.includes("120")) return "aging:v120";
    if (label.includes("150")) return "aging:v150";
    if (label.includes("180") && label.includes("MAYOR")) return "aging:v180p";
    if (label.includes("180")) return "aging:v180";
  }
  if (
    (label.includes("MERCADERIAS A ENTREGAR") ||
      label.includes("PV Y PROG")) &&
    mes
  ) {
    return label.includes("MERCADER") ? `mercaderia:${mes}` : `pv:${mes}`;
  }
  if (label.includes("PAGOS") && label.includes("BAZZAR")) return "bazzar:manual";
  if (label.includes("LUISITO")) return "luisito:cuadro";
  if (label.includes("PAGO A PROVEEDORES")) return "manual:PAGO A PROVEEDORES";
  if (label.includes("GASTOS DE DESPACHO")) return "manual:GASTOS DE DESPACHO";
  if (label.includes("PREVISION GASTOS"))
    return "manual:PREVISION GASTOS OPERATIVOS";
  if (label.includes("PRESTAMO")) return "manual:PRESTAMO BANCARIO";

  if (row.kind === "total_yellow" && mes) return `disponible:${mes}`;
  if (row.kind === "total_yellow") {
    const m = label.match(
      /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*(\d{4})/i
    );
    if (m) {
      const map: Record<string, string> = {
        ENERO: "01",
        FEBRERO: "02",
        MARZO: "03",
        ABRIL: "04",
        MAYO: "05",
        JUNIO: "06",
        JULIO: "07",
        AGOSTO: "08",
        SEPTIEMBRE: "09",
        OCTUBRE: "10",
        NOVIEMBRE: "11",
        DICIEMBRE: "12",
      };
      const ym = `${m[2]}-${map[m[1].toUpperCase()] || "01"}`;
      return `disponible:${ym}`;
    }
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
