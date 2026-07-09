#!/usr/bin/env node
/**
 * Adapta Excel IC → convenciones CHUSAR (2.3.1.7.3.3).
 * Fuente: backup original si existe. Columna F (PLAZO) — NO se modifica.
 */
import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const DEFAULT_SRC = "C:/Users/hecto/Downloads/PARA INTENCION DE COMPRA.xlsx";
const BACKUP = DEFAULT_SRC.replace(".xlsx", "_BACKUP_PRE_CHUSAR.xlsx");
const SRC = process.argv[2] || (fs.existsSync(BACKUP) ? BACKUP : DEFAULT_SRC);
const OUT = process.argv[3] || DEFAULT_SRC;
const OUT_COPY = DEFAULT_SRC.replace(".xlsx", "_CHUSAR.xlsx");

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const EMBARQUE_A_ID = {
  "2DA SETIEMBRE": 18,
  "1RA SETIEMBRE": 17,
  "2DA AGOSTO": 16,
};

const MARCA_ALIAS = {
  "CARTERAS VIZZANO": "VIZZANO",
  "CARTERAS MOLEKINHA": "MOLEKINHA",
};

const VEND_ALIAS = {
  ADMINISTRACION: "ADM",
  ATI: "ATI",
};

const LP_TRIM = { LPN: "LPN", LPC02: "LPC02", LPC03: "LPC03", LPC04: "LPC04" };

const pool = new pg.Pool({ connectionString: url });

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function resolveMarca(cell, marcaById, marcaByName) {
  const n = Number(cell);
  if (Number.isFinite(n) && n > 0 && marcaById[n]) return marcaById[n];
  let txt = norm(cell);
  if (MARCA_ALIAS[txt]) txt = norm(MARCA_ALIAS[txt]);
  return marcaByName[txt] ?? null;
}

function resolveVendedor(nombreExcel, vendByName, vendFirst) {
  const key = norm(nombreExcel);
  const alias = VEND_ALIAS[key];
  if (alias && vendByName[alias]) return vendByName[alias];
  if (vendFirst[key]) return vendFirst[key];
  if (vendByName[key]) return vendByName[key];
  for (const [k, v] of Object.entries(vendFirst)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

try {
  const [mOk, vOk, provOk] = await Promise.all([
    pool.query("SELECT id_marca, TRIM(descp_marca) AS descp_marca FROM marca_v2"),
    pool.query("SELECT id_vendedor, TRIM(descp_vendedor) AS descp_vendedor FROM vendedor_v2"),
    pool.query("SELECT id, TRIM(nombre) AS nombre FROM proveedor_importacion"),
  ]);

  const marcaById = Object.fromEntries(
    mOk.rows.map((r) => [Number(r.id_marca), { id: Number(r.id_marca), label: r.descp_marca }]),
  );
  const marcaByName = Object.fromEntries(
    mOk.rows.map((r) => [norm(r.descp_marca), { id: Number(r.id_marca), label: r.descp_marca }]),
  );

  const vendByName = {};
  const vendFirst = {};
  for (const r of vOk.rows) {
    const full = norm(r.descp_vendedor);
    const obj = { id: Number(r.id_vendedor), label: r.descp_vendedor };
    vendByName[full] = obj;
    const first = full.split(" ")[0];
    if (!vendFirst[first]) vendFirst[first] = obj;
  }

  const provRow = provOk.rows.find((r) => norm(r.nombre).includes("BEIRA RIO"));
  const provBeira = provRow?.nombre || "BEIRA RIO CALZADOS";
  const provId = provRow ? Number(provRow.id) : null;

  const wb = XLSX.readFile(SRC);
  const sn = wb.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });

  data[0] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  data[1] = [
    "listado_precio_codigo",
    "proveedor_nombre",
    "marca_nombre",
    "id_cliente",
    "vendedor_nombre",
    "plazo_legacy",
    "cantidad_total_pares",
    "quincena_arribo_id",
    "monto_bruto",
    "descuento_1",
    "descuento_2",
    "descuento_3",
    "descuento_4",
    "categoria_id",
    "tipo_id",
    "id_vendedor",
    "id_marca",
    "precio_evento_id",
    "id_proveedor",
  ];

  const stats = { filas: 0, lp: 0, marca: 0, vendedor: 0, embarque: 0, errores: [] };

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (row[3] === "" || row[3] == null) continue;
    stats.filas++;

    const lpRaw = norm(String(row[0]).replace(/\s+/g, ""));
    const lpKey = lpRaw.startsWith("LPC") ? lpRaw.slice(0, 5) : lpRaw.slice(0, 3);
    if (LP_TRIM[lpKey]) {
      row[0] = LP_TRIM[lpKey];
      stats.lp++;
    }

    row[1] = provBeira;

    const marca = resolveMarca(row[2], marcaById, marcaByName);
    if (marca) {
      row[2] = marca.label;
      stats.marca++;
    } else {
      stats.errores.push({ fila: i + 1, col: "C", valor: row[2] });
    }

    row[3] = Number(row[3]);

    const vend = resolveVendedor(row[4], vendByName, vendFirst);
    if (vend) {
      row[4] = vend.label;
      stats.vendedor++;
    } else {
      stats.errores.push({ fila: i + 1, col: "E", valor: row[4] });
    }

    // F — PLAZO: intacto (orden Director)

    row[6] = Math.trunc(Number(row[6]) || 0);

    const embKey = norm(row[7]);
    const qId = EMBARQUE_A_ID[embKey];
    if (qId) {
      row[7] = qId;
      stats.embarque++;
    } else if (Number(row[7]) >= 1 && Number(row[7]) <= 24) {
      stats.embarque++;
    } else {
      stats.errores.push({ fila: i + 1, col: "H", valor: row[7] });
    }

    row[8] = Math.round(Number(row[8]) || 0);
    for (let c = 9; c <= 12; c++) row[c] = Number(row[c]) || 0;

    row[13] = 3;
    row[14] = 1;
    row[15] = vend?.id ?? "";
    row[16] = marca?.id ?? "";
    row[17] = 37;
    row[18] = provId ?? "";
  }

  wb.Sheets[sn] = XLSX.utils.aoa_to_sheet(data);
  XLSX.writeFile(wb, OUT);
  XLSX.writeFile(wb, OUT_COPY);

  console.log(
    JSON.stringify(
      {
        fuente: SRC,
        salida: OUT,
        copia: OUT_COPY,
        stats,
        errores: stats.errores,
      },
      null,
      2,
    ),
  );

  if (stats.errores.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
