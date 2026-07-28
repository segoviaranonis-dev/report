/**
 * Parser Excel Logística Rimec (cabecera Carlos + líneas L+R+M+C).
 * Fuente: csv's/Logistica/Logistica Rimec.xlsx
 */
import type { EntidadAmLogistica } from "@/lib/logistica-ok/constants";

export type ExcelRimecLinea = {
  articulo: string;
  lineaRef: string;
  materialCode: string;
  colorCode: string;
  grada: string;
  cantVend: number;
  pVentaGs: number;
  tVentaGs: number;
};

export type ExcelRimecCabecera = {
  facturaCarlos: string;
  facturaPv: string | null;
  fecha: string;
  codigoCliente: number;
  codigoVendedor: number;
  listaPrecio: string;
  nroPedidoExterno: string;
  entidadAm: EntidadAmLogistica;
  observacion: string;
  cantTotal: number;
  montoNeto: number;
  articulos: ExcelRimecLinea[];
};

export type ExcelRimecParseResult = {
  cabeceras: ExcelRimecCabecera[];
  stats: {
    facturas: number;
    articulos: number;
    montoTotal: number;
    paresTotal: number;
    porTipo: Record<string, number>;
  };
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return Number(String(v).replace(/,/g, "")) || 0;
}

/** Excel serial → YYYY-MM-DD (UTC). */
export function excelSerialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function parseFecha(v: unknown): string {
  if (typeof v === "number" && v > 20000) return excelSerialToIso(v);
  const s = str(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 10);
}

export function mapTipoEntidad(tipo: string): EntidadAmLogistica {
  const t = tipo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
  if (t.includes("PRONTA") || t === "PE") return "PE";
  if (t.includes("PROGRAMADO")) return "PROGRAMADO";
  if (t.includes("COMPRA") || t === "CP") return "CP";
  return "CP";
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && str(row[k]) !== "") return row[k];
  }
  // fuzzy: trim keys
  for (const [rk, rv] of Object.entries(row)) {
    const n = rk.trim().toLowerCase();
    for (const k of keys) {
      if (n === k.trim().toLowerCase() && rv != null && str(rv) !== "") return rv;
    }
  }
  return null;
}

/**
 * Filas sheet_to_json (1 fila = 1 línea de artículo).
 */
export function parseLogisticaRimecExcelRows(
  rows: Record<string, unknown>[],
): ExcelRimecParseResult {
  const byFactura = new Map<string, ExcelRimecCabecera>();
  const porTipo: Record<string, number> = {};

  for (const row of rows) {
    const facturaCarlos = str(pick(row, "Factura ", "Factura", "FACTURA"));
    if (!facturaCarlos || facturaCarlos.toLowerCase().startsWith("factura")) continue;

    const facturaPvRaw = pick(row, "Factura _1", "Factura_1");
    const facturaPv = facturaPvRaw != null ? str(facturaPvRaw) : null;
    const tipoRaw = str(pick(row, "Tipo", "TIPO"));
    const entidadAm = mapTipoEntidad(tipoRaw);
    porTipo[entidadAm] = (porTipo[entidadAm] || 0) + 1;

    const linea: ExcelRimecLinea = {
      articulo: str(pick(row, "ART-CARLOS", "ART_CARLOS", "CODIGO")).replace(/-/g, ".") || "—",
      lineaRef: str(pick(row, "LINEA+REFERENCIA", "LINEA+REFERENCIA ", "LINEA_REFERENCIA")),
      materialCode: str(pick(row, "MATERIAL")),
      colorCode: str(pick(row, "COLOR")),
      grada: str(pick(row, "GRADA")),
      cantVend: num(pick(row, "CANTIDAD")),
      pVentaGs: num(pick(row, "MONTO UNITARIO", "MONTO_UNITARIO")),
      tVentaGs: num(pick(row, "MONTO GRAL", "MONTO_GRAL")),
    };

    let cab = byFactura.get(facturaCarlos);
    if (!cab) {
      cab = {
        facturaCarlos,
        facturaPv,
        fecha: parseFecha(pick(row, "Fecha de emidion de factura", "Fecha de emision de factura")),
        codigoCliente: Math.round(num(pick(row, "Cod. Cliente_v2", "Cod. Cliente_v2 ", "Cod Cliente"))),
        codigoVendedor: Math.round(num(pick(row, "Codigo vededor_2", "Codigo vendedor_2", "Codigo vendedor"))),
        listaPrecio: str(pick(row, "LIST.PRECIO:", "LIST.PRECIO", "LISTA")),
        nroPedidoExterno: str(pick(row, "Numero de pedido ecterno", "Numero de pedido externo")),
        entidadAm,
        observacion: str(pick(row, "Obsevacion Logistica ", "Observacion Logistica", "Observacion")),
        cantTotal: 0,
        montoNeto: 0,
        articulos: [],
      };
      byFactura.set(facturaCarlos, cab);
    }
    cab.articulos.push(linea);
    cab.cantTotal += linea.cantVend;
    cab.montoNeto += linea.tVentaGs;
  }

  const cabeceras = [...byFactura.values()];
  return {
    cabeceras,
    stats: {
      facturas: cabeceras.length,
      articulos: cabeceras.reduce((s, c) => s + c.articulos.length, 0),
      montoTotal: cabeceras.reduce((s, c) => s + c.montoNeto, 0),
      paresTotal: cabeceras.reduce((s, c) => s + c.cantTotal, 0),
      porTipo,
    },
  };
}
