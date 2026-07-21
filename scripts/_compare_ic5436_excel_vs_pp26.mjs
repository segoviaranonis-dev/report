import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const EXCEL = "C:/Users/hecto/Downloads/ANDRES-1807/0839-7932-38/IC-5436.xlsx";
const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new pg.Pool({ connectionString: url });
const ppId = 26;

const wb = XLSX.readFile(EXCEL);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

function normIcNro(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/IC-2026-(\d+)/i);
  if (!m) return s;
  return `IC-2026-${m[1].padStart(4, "0")}`;
}

const excel = rows.map((r) => {
  const nroIc = normIcNro(r["Nº de I-C"] ?? r["N de I-C"] ?? r["Nº de IC"]);
  return {
    nro_ic: nroIc,
    cliente: Number(r["COD.CLIENTE"]),
    cod_marca: Number(r["COD.MARCA"]),
    pares: Number(String(r["CANT  "] ?? r["CANT"] ?? 0).replace(/\s/g, "")),
    bruto: Number(r["IMPORTE"] ?? 0),
    neto: Number(r["IMP.NETO"] ?? 0),
    d1: Number(r["D1"] ?? 0),
    d2: Number(r["D2"] ?? 0),
    d3: Number(r["D3"] ?? 0),
    d4: Number(r["D4"] ?? 0),
    list_prec: String(r["LIST.PREC"] ?? "").trim(),
    nro_pedido: String(r["N° PEDIDO"] ?? "").trim(),
    factura: String(r["FACTURA"] ?? "").trim(),
  };
});

const { rows: ics } = await pool.query(
  `SELECT ic.id, ic.numero_registro, ic.id_cliente, ic.id_marca, ic.cantidad_total_pares,
          ic.monto_bruto, ic.monto_neto, ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4,
          ic.listado_precio_id, icp.precio_evento_id, icp.nro_pedido_fabrica
   FROM intencion_compra_pedido icp
   JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
   WHERE icp.pedido_proveedor_id = $1`,
  [ppId],
);

const bdByNro = new Map(ics.map((ic) => [ic.numero_registro, ic]));
const excelByNro = new Map(excel.filter((e) => e.nro_ic).map((e) => [e.nro_ic, e]));

let matchOk = 0;
let diffs = [];
for (const [nro, ex] of excelByNro) {
  const bd = bdByNro.get(nro);
  if (!bd) {
    diffs.push({ nro, tipo: "solo_excel", ex });
    continue;
  }
  const issues = [];
  if (Number(bd.id_cliente) !== ex.cliente) issues.push(`cliente ${bd.id_cliente}→${ex.cliente}`);
  if (Number(bd.id_marca) !== ex.cod_marca) issues.push(`marca ${bd.id_marca}→${ex.cod_marca}`);
  if (Number(bd.cantidad_total_pares) !== ex.pares) issues.push(`pares ${bd.cantidad_total_pares}→${ex.pares}`);
  if (Math.abs(Number(bd.monto_bruto) - ex.bruto) > 1) issues.push(`bruto ${bd.monto_bruto}→${ex.bruto}`);
  if (issues.length) diffs.push({ nro, tipo: "diff", issues, ex, bd: { cliente: bd.id_cliente, marca: bd.id_marca, pares: bd.cantidad_total_pares } });
  else matchOk++;
}

const soloBd = [...bdByNro.keys()].filter((k) => !excelByNro.has(k));

console.log(
  JSON.stringify(
    {
      excel_filas: excel.length,
      excel_con_nro_ic: excelByNro.size,
      bd_ic: ics.length,
      match_ok: matchOk,
      diffs_count: diffs.length,
      solo_bd: soloBd.length,
      solo_bd_nros: soloBd.slice(0, 10),
      diffs_muestra: diffs.slice(0, 15),
      excel_pares: excel.reduce((s, e) => s + e.pares, 0),
      bd_pares: ics.reduce((s, ic) => s + Number(ic.cantidad_total_pares), 0),
      precio_evento_id: ics[0]?.precio_evento_id,
      nro_pedido_fabrica_pp: ics[0]?.nro_pedido_fabrica,
    },
    null,
    2,
  ),
);

await pool.end();
