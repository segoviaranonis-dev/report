#!/usr/bin/env node
/**
 * Inyección IC PROGRAMADO desde Excel CHUSAR → bandeja PENDIENTES.
 * Uso: node scripts/inject_ic_programado_excel.mjs [--dry-run]
 */
import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const DRY = process.argv.includes("--dry-run");
const ORDEN_INVERTIDO = !process.argv.includes("--sin-invertir");
/** Reutilizar serialización lote 2026-07-09 — IC-2026-0112…0523 */
const REUSAR_NUMEROS = !process.argv.includes("--numeros-nuevos");
const IC_SERIE_INICIO = 112;
const IC_SERIE_FIN = 523;
const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "C:/Users/hecto/Downloads/PARA INTENCION DE COMPRA.xlsx";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const LP_TO_ID = { LPN: 1, LPC02: 2, LPC03: 3, LPC04: 4 };

/** Excel col F legacy → descp_plazo BD (CHUSAR · plazo no tocado en Excel) */
const PLAZO_EXCEL_A_DESC = {
  "CR30-60-90": "30-60-90 DÍAS",
  "CR-6090120": "30-60-90-120 DÍAS",
  "CR-EFECTIV": "EFECTIVO",
  "CR-60-150": "90-120-150 DÍAS",
  "CR-CONTADO": "EFECTIVO",
  "CR-30": "30 DÍAS",
  "CR-90": "90 DÍAS",
  "CR-150": "150 DIAS",
  "CR-30/60": "30-60-90 DÍAS",
  "CR-60": "60 DÍAS",
};

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function calcularNeto(bruto, d1, d2, d3, d4) {
  let neto = bruto;
  for (const pct of [d1, d2, d3, d4]) {
    if (pct > 0) neto *= 1 - pct / 100;
  }
  return Math.round(neto * 100) / 100;
}

async function nextNumero(client, year) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_registro, '-', 3) AS INTEGER)), 0)::int AS ultimo
     FROM intencion_compra WHERE numero_registro LIKE $1`,
    [`IC-${year}-%`],
  );
  return `IC-${year}-${String(rows[0].ultimo + 1).padStart(4, "0")}`;
}

const pool = new pg.Pool({ connectionString: url });

try {
  const { rows: plazosBd } = await pool.query("SELECT id_plazo, descp_plazo FROM plazo_v2");
  const plazoByDesc = Object.fromEntries(
    plazosBd.map((r) => [norm(r.descp_plazo), Number(r.id_plazo)]),
  );
  const plazoFromExcel = {};
  for (const [excel, desc] of Object.entries(PLAZO_EXCEL_A_DESC)) {
    plazoFromExcel[norm(excel)] = plazoByDesc[norm(desc)] ?? null;
  }

  const wb = XLSX.readFile(EXCEL);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = data.slice(2).filter((r) => r[3] !== "" && r[3] != null);

  console.log(`Excel: ${EXCEL} · filas: ${rows.length} · dry-run: ${DRY}`);

  const errores = [];
  const parsed = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fila = i + 3;
    const lpCod = norm(String(r[0]).replace(/\s+/g, ""));
    const listado_precio_id = LP_TO_ID[lpCod];
    const id_proveedor = Number(r[18]);
    const id_marca = Number(r[16]);
    const id_cliente = Number(r[3]);
    const id_vendedor = Number(r[15]);
    const tipo_id = Number(r[14]) || 1;
    const categoria_id = Number(r[13]) || 3;
    const cantidad_total_pares = Math.trunc(Number(r[6]) || 0);
    const quincena_arribo_id = Number(r[7]);
    const monto_bruto = Number(r[8]) || 0;
    const d1 = Number(r[9]) || 0;
    const d2 = Number(r[10]) || 0;
    const d3 = Number(r[11]) || 0;
    const d4 = Number(r[12]) || 0;
    const precio_evento_id = Number(r[17]) || null;
    const plazoKey = norm(String(r[5]));
    const id_plazo = plazoFromExcel[plazoKey] ?? null;

    if (!listado_precio_id) errores.push({ fila, msg: `LP inválido: ${r[0]}` });
    if (!id_cliente) errores.push({ fila, msg: "id_cliente vacío" });
    if (!id_vendedor) errores.push({ fila, msg: "id_vendedor vacío" });
    if (!id_marca) errores.push({ fila, msg: "id_marca vacío" });
    if (!id_proveedor) errores.push({ fila, msg: "id_proveedor vacío" });
    if (cantidad_total_pares <= 0) errores.push({ fila, msg: "pares <= 0" });
    if (!quincena_arribo_id || quincena_arribo_id < 1 || quincena_arribo_id > 24) {
      errores.push({ fila, msg: `quincena inválida: ${r[7]}` });
    }
    if (id_plazo == null) errores.push({ fila, msg: `plazo legacy sin mapa BD: ${r[5]}` });

    parsed.push({
      fila,
      listado_precio_id,
      id_proveedor,
      id_marca,
      id_cliente,
      id_vendedor,
      tipo_id,
      categoria_id,
      cantidad_total_pares,
      quincena_arribo_id,
      monto_bruto,
      d1,
      d2,
      d3,
      d4,
      precio_evento_id,
      id_plazo,
    });
  }

  if (errores.length) {
    console.error("ERRORES PREVIEW:", JSON.stringify(errores.slice(0, 30), null, 2));
    console.error(`Total errores: ${errores.length}`);
    process.exit(1);
  }

  const n = parsed.length;
  const serieFin = REUSAR_NUMEROS ? IC_SERIE_INICIO + n - 1 : IC_SERIE_FIN;
  if (REUSAR_NUMEROS && n > IC_SERIE_FIN - IC_SERIE_INICIO + 1) {
    console.error(`Filas ${n} exceden cupo fijo ${IC_SERIE_FIN - IC_SERIE_INICIO + 1}`);
    process.exit(1);
  }

  /** Fila Excel 3 → último número; fila 4 → penúltimo… */
  function numeroParaIndice(i) {
    if (!REUSAR_NUMEROS) return null;
    const seq = ORDEN_INVERTIDO ? serieFin - i : IC_SERIE_INICIO + i;
    return `IC-2026-${String(seq).padStart(4, "0")}`;
  }

  if (DRY) {
    const muestra = [
      { excelFila: parsed[0].fila, numero: numeroParaIndice(0) },
      { excelFila: parsed[1]?.fila, numero: numeroParaIndice(1) },
      { excelFila: parsed[n - 1]?.fila, numero: numeroParaIndice(n - 1) },
    ];
    console.log(
      "DRY-RUN OK ·",
      n,
      "IC · orden invertido:",
      ORDEN_INVERTIDO,
      "· reutiliza números:",
      REUSAR_NUMEROS,
      "· muestra:",
      JSON.stringify(muestra),
    );
    process.exit(0);
  }

  const client = await pool.connect();
  const year = new Date().getFullYear();
  const fecha_registro = new Date().toISOString().slice(0, 10);
  const insertados = [];

  try {
    await client.query("BEGIN");

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const numero = REUSAR_NUMEROS ? numeroParaIndice(i) : await nextNumero(client, year);
      const neto = calcularNeto(p.monto_bruto, p.d1, p.d2, p.d3, p.d4);

      const { rows } = await client.query(
        `INSERT INTO intencion_compra (
          numero_registro, id_proveedor, id_cliente, id_vendedor, id_marca, id_plazo,
          tipo_id, categoria_id, cantidad_total_pares,
          monto_bruto, descuento_1, descuento_2, descuento_3, descuento_4,
          monto_neto, fecha_registro, quincena_arribo_id,
          estado, precio_evento_id, listado_precio_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          'PENDIENTE_OPERATIVO',$18,$19
        ) RETURNING id, numero_registro`,
        [
          numero,
          p.id_proveedor,
          p.id_cliente,
          p.id_vendedor,
          p.id_marca,
          p.id_plazo,
          p.tipo_id,
          p.categoria_id,
          p.cantidad_total_pares,
          p.monto_bruto,
          p.d1,
          p.d2,
          p.d3,
          p.d4,
          neto,
          fecha_registro,
          p.quincena_arribo_id,
          p.precio_evento_id,
          p.listado_precio_id,
        ],
      );
      insertados.push(rows[0]);
    }

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          ok: true,
          insertadas: insertados.length,
          estado: "PENDIENTE_OPERATIVO",
          orden_invertido: ORDEN_INVERTIDO,
          reutiliza_numeros: REUSAR_NUMEROS,
          primera_excel_fila3: insertados[0]?.numero_registro,
          ultima_excel_ultima_fila: insertados[insertados.length - 1]?.numero_registro,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const { rows: pend } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM intencion_compra WHERE estado = 'PENDIENTE_OPERATIVO' AND categoria_id = 3",
  );
  console.log("BD pendientes PROGRAMADO:", pend[0].n);
} finally {
  await pool.end();
}
