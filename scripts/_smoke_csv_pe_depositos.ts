/**
 * Smoke CSV PE · formato Director (DEPOSITO cabecera · Cant. Pares por artículo).
 */
import {
  auditPeCsvTierIntegrity,
  ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS,
} from "../src/lib/facturacion/csv-pe-tier-audit";
import {
  buildPeVentasCsvContent,
  resolveColumnaDepositoCarlos,
  resolvePreciosLineaPeCsv,
  type PeVentasCsvRow,
} from "../src/lib/facturacion/csv-pe-ventas-export";
import { precioNetoCascada } from "../src/app/aprobaciones/lib/aprobaciones-utils";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolveColumnaDepositoCarlos("S00_D1", null) === "S00_D1", "S00_D1");
assert(resolveColumnaDepositoCarlos(null, "D1") === "S00_D1", "D1→S00_D1");
assert(precioNetoCascada(131400, 10, 25, 0, 0) === 88695, "neto 88695");

// LPC03: snapshot LPN no debe ganar sobre precio_unit/precio_neto FI
const lpc03 = resolvePreciosLineaPeCsv(
  {
    cliente_id: "1",
    plazo_id: "1",
    pedido_id: null,
    lista_precio_id: "3",
    descuento_1: "10",
    descuento_2: "25",
    descuento_3: "0",
    descuento_4: "0",
    vendedor_id: null,
    vendedor_nombre: null,
    fecha_pedido: null,
    linea_snapshot: { precio_base: "100000" },
    precio_unit: "112000",
    precio_neto: "75600",
    precio_lista: "100000",
    precio_base_snap: "100000",
    unit_fob_ajustado: null,
    ppd_precio_lpn: "100000",
    ppd_precio_lpc03: "112000",
    ppd_precio_lpc02: null,
    ppd_precio_lpc04: null,
    fid_id: 99,
    payload_json: null,
    caso: null,
    cod_oper_carlos: null,
    codigo_barras: "654.1",
    pares: "1",
    columna_stock_legal: null,
    deposito_codigo: null,
  },
  3,
);
assert(lpc03.bruto === "112000", `LPC03 bruto=${lpc03.bruto}`);
assert(lpc03.neto === "75600", `LPC03 neto=${lpc03.neto}`);

const rows: PeVentasCsvRow[] = [
  {
    cliente_id: "930",
    cod_oper: "CR-90-150",
    fecha_pedido: "04/08/2026",
    lista_precios: "LPC03",
    vendedor: "25",
    deposito: "S00_D1",
    descuento_1: "10",
    descuento_2: "25",
    descuento_3: "",
    descuento_4: "",
    codigo_articulo: "654.260.157",
    cant_pares: "10",
    precio_sin_descuento: "131400",
    precio_con_descuento: "88695",
    fid_id: 1,
  },
  {
    cliente_id: "930",
    cod_oper: "CR-90-150",
    fecha_pedido: "04/08/2026",
    lista_precios: "LPC03",
    vendedor: "25",
    deposito: "S00_D1",
    descuento_1: "10",
    descuento_2: "25",
    descuento_3: "",
    descuento_4: "",
    codigo_articulo: "654.260.158",
    cant_pares: "2",
    precio_sin_descuento: "100000",
    precio_con_descuento: "67500",
    fid_id: 2,
  },
];

const csv = buildPeVentasCsvContent(rows);
const lines = csv.trim().split(/\r?\n/);
const h = lines[0].split("\t");
assert(h.length === 15, `15 cols header got ${h.length}`);
assert(h[6] === "DEPOSITO", `col G=${h[6]}`);
assert(h[12] === "Cant. Pares", `col M=${h[12]}`);
assert(h[13] === "Precio con descuento", `col N=${h[13]}`);
assert(h[14] === "Precio sin descuento", `col O=${h[14]}`);
assert(!h.includes("S00_DEP2") || h.filter((x) => x.startsWith("S00_")).length === 0, "no tres cols S00_");

const r1 = lines[1].split("\t");
assert(r1[5] === "25", `vendedor=${r1[5]}`);
assert(r1[6] === "S00_D1", `deposito=${r1[6]}`);
assert(r1[12] === "10", `cant=${r1[12]}`);
assert(r1[13] === "88695", `neto=${r1[13]}`);
assert(r1[14] === "131400", `bruto=${r1[14]}`);

const r2 = lines[2].split("\t");
assert(r2[6] === "", "DEPOSITO vacío en fila 2");
assert(r2[5] === "", "vendedor vacío en fila 2");
assert(r2[11] === "654.260.158", "art fila 2");
assert(r2[12] === "2", "cant fila 2");

const detAudit = {
  fid_id: 99,
  descuento_1: "10",
  descuento_2: "25",
  descuento_3: "0",
  descuento_4: "0",
  precio_unit: "112000",
  precio_neto: "75600",
  precio_base_snap: "100000",
  ppd_precio_lpn: "100000",
  ppd_precio_lpc03: "112000",
  ppd_precio_lpc02: null,
  ppd_precio_lpc04: null,
  codigo_barras: "654.1",
};
const okCsv = [
  {
    ...rows[0],
    fid_id: 99,
    codigo_articulo: "654.1",
    precio_sin_descuento: "112000",
    precio_con_descuento: "75600",
  },
];
assert(auditPeCsvTierIntegrity([detAudit], okCsv, 3).length === 0, "audit OK LPC03");
const badCsv = [{ ...okCsv[0], precio_sin_descuento: "100000", precio_con_descuento: "67500" }];
const viol = auditPeCsvTierIntegrity([detAudit], badCsv, 3);
assert(viol.length === 1 && viol[0].code === ERROR_CSV_PE_RENTABILIDAD_NIVEL_DIOS, "audit detecta LPN");

console.log("OK smoke csv pe formato Director");
console.log(lines[0]);
console.log(lines[1]);
console.log(lines[2]);
