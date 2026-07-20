#!/usr/bin/env node
/**
 * Adapta Excel IC → convenciones CHUSAR (IC administrativa liviana).
 * Soporta:
 *  - Formato CHUSAR (filas ya en columnas A–S)
 *  - Formato ERP (COD.CLIENTE · LIST.PREC · D1–D4 · DESC.EMBARQUE) p.ej. IC-0839.xlsx
 * Marca/vendedor: por NOMBRE (COD ERP no es FK Nexus).
 * precio_evento_id: no hardcode · vacío = null en inject.
 * Columna plazo legacy — NO se modifica el texto.
 */
import fs from "fs";
import pg from "pg";
import XLSX from "xlsx";

const DEFAULT_SRC = "C:/Users/hecto/Downloads/PARA INTENCION DE COMPRA.xlsx";
const BACKUP = DEFAULT_SRC.replace(".xlsx", "_BACKUP_PRE_CHUSAR.xlsx");
const SRC = process.argv[2] || (fs.existsSync(BACKUP) ? BACKUP : DEFAULT_SRC);
const OUT = process.argv[3] || SRC.replace(/\.xlsx$/i, "_CHUSAR.xlsx");
const OUT_COPY = OUT;

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const EMBARQUE_A_ID = {
  "1RA ENERO": 1,
  "2DA ENERO": 2,
  "1RA FEBRERO": 3,
  "2DA FEBRERO": 4,
  "1RA MARZO": 5,
  "2DA MARZO": 6,
  "1RA ABRIL": 7,
  "2DA ABRIL": 8,
  "1RA MAYO": 9,
  "2DA MAYO": 10,
  "1RA JUNIO": 11,
  "2DA JUNIO": 12,
  "1RA JULIO": 13,
  "2DA JULIO": 14,
  "1RA AGOSTO": 15,
  "2DA AGOSTO": 16,
  "1RA SETIEMBRE": 17,
  "2DA SETIEMBRE": 18,
  "1RA SEPTIEMBRE": 17,
  "2DA SEPTIEMBRE": 18,
  "1RA OCTUBRE": 19,
  "2DA OCTUBRE": 20,
  "1RA NOVIEMBRE": 21,
  "2DA NOVIEMBRE": 22,
  "1RA DICIEMBRE": 23,
  "2DA DICIEMBRE": 24,
};

const MARCA_ALIAS = {
  "CARTERAS VIZZANO": "VIZZANO",
  "CARTERAS MOLEKINHA": "MOLEKINHA",
  "CARTERAS MOLECA": "MOLECA",
  BEIRA_RIO: "BEIRA RIO",
  "BEIRA RIO": "BEIRA RIO",
};

const VEND_ALIAS = {
  ADMINISTRACION: "ADM",
  ATI: "ATI",
};

const LP_TRIM = { LPN: "LPN", LPC02: "LPC02", LPC03: "LPC03", LPC04: "LPC04" };

const HEADER_CHUSAR = [
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

const pool = new pg.Pool({ connectionString: url });

function norm(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function resolveMarcaByName(cell, marcaByName) {
  let txt = norm(cell);
  if (MARCA_ALIAS[txt]) txt = norm(MARCA_ALIAS[txt]);
  if (MARCA_ALIAS[String(cell ?? "").trim().toUpperCase()]) {
    txt = norm(MARCA_ALIAS[String(cell ?? "").trim().toUpperCase()]);
  }
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

function colIndex(headerRow, ...names) {
  const wanted = names.map((n) => norm(n));
  for (let i = 0; i < headerRow.length; i++) {
    if (wanted.includes(norm(headerRow[i]))) return i;
  }
  return -1;
}

function isErpFormat(headerRow) {
  const h = headerRow.map((c) => norm(c));
  return h.includes("COD.CLIENTE") || h.includes("COD CLIENTE") || h.includes("LIST.PREC");
}

try {
  const [mOk, vOk, provOk] = await Promise.all([
    pool.query("SELECT id_marca, TRIM(descp_marca) AS descp_marca FROM marca_v2"),
    pool.query("SELECT id_vendedor, TRIM(descp_vendedor) AS descp_vendedor FROM vendedor_v2"),
    pool.query("SELECT id, TRIM(nombre) AS nombre FROM proveedor_importacion"),
  ]);

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
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
  if (!raw.length) {
    console.error("Excel vacío");
    process.exit(1);
  }

  const erp = isErpFormat(raw[0]);
  const stats = {
    filas: 0,
    formato: erp ? "ERP" : "CHUSAR",
    lp: 0,
    marca: 0,
    vendedor: 0,
    embarque: 0,
    errores: [],
  };

  const outRows = [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], HEADER_CHUSAR];

  if (erp) {
    const h = raw[0];
    const iCli = colIndex(h, "COD.CLIENTE", "COD CLIENTE");
    const iVendNom = colIndex(h, "NOMBRE VENDEDOR");
    const iMarcaNom = colIndex(h, "DESCRIPCION MARCA", "DESC.MARCA");
    const iLp = colIndex(h, "LIST.PREC", "LIST PREC");
    const iD1 = colIndex(h, "D1");
    const iD2 = colIndex(h, "D2");
    const iD3 = colIndex(h, "D3");
    const iD4 = colIndex(h, "D4");
    const iCant = colIndex(h, "CANT  ", "CANT", "CANT.");
    const iImp = colIndex(h, "IMPORTE");
    const iPlazo = colIndex(h, "PLAZO");
    const iEmbDesc = colIndex(h, "DESC.EMBARQUE", "DESC EMBARQUE");
    const iEmbCode = colIndex(h, "EMBARQUE");

    for (let i = 1; i < raw.length; i++) {
      const src = raw[i];
      const idCliente = Number(src[iCli]);
      if (!idCliente) continue;
      stats.filas++;

      const lpRaw = norm(String(src[iLp] ?? "").replace(/\s+/g, ""));
      const lpKey = lpRaw.startsWith("LPC") ? lpRaw.slice(0, 5) : lpRaw.slice(0, 3);
      const lpCod = LP_TRIM[lpKey] || "";
      if (lpCod) stats.lp++;

      const marca = resolveMarcaByName(src[iMarcaNom], marcaByName);
      if (marca) stats.marca++;
      else stats.errores.push({ fila: i + 1, col: "marca", valor: src[iMarcaNom] });

      const vend = resolveVendedor(src[iVendNom], vendByName, vendFirst);
      if (vend) stats.vendedor++;
      else stats.errores.push({ fila: i + 1, col: "vendedor", valor: src[iVendNom] });

      let qId = null;
      const embDesc = iEmbDesc >= 0 ? src[iEmbDesc] : "";
      const embCode = iEmbCode >= 0 ? Number(src[iEmbCode]) : NaN;
      const fromText = EMBARQUE_A_ID[norm(embDesc)];
      if (fromText) qId = fromText;
      else if (Number.isFinite(embCode) && embCode >= 1 && embCode <= 24) qId = embCode;

      if (qId) stats.embarque++;
      else stats.errores.push({ fila: i + 1, col: "embarque", valor: embDesc || embCode });

      outRows.push([
        lpCod,
        provBeira,
        marca?.label ?? norm(src[iMarcaNom]),
        idCliente,
        vend?.label ?? String(src[iVendNom] ?? "").trim(),
        String(src[iPlazo] ?? "").trim(),
        Math.trunc(Number(src[iCant]) || 0),
        qId ?? "",
        Math.round(Number(src[iImp]) || 0),
        Number(src[iD1]) || 0,
        Number(src[iD2]) || 0,
        Number(src[iD3]) || 0,
        Number(src[iD4]) || 0,
        3,
        1,
        vend?.id ?? "",
        marca?.id ?? "",
        "", // precio_evento_id opcional
        provId ?? "",
      ]);
    }
  } else {
    const data = raw;
    for (let i = 2; i < data.length; i++) {
      const row = [...data[i]];
      if (row[3] === "" || row[3] == null) continue;
      stats.filas++;

      const lpRaw = norm(String(row[0]).replace(/\s+/g, ""));
      const lpKey = lpRaw.startsWith("LPC") ? lpRaw.slice(0, 5) : lpRaw.slice(0, 3);
      if (LP_TRIM[lpKey]) {
        row[0] = LP_TRIM[lpKey];
        stats.lp++;
      } else if (!lpRaw) {
        row[0] = "";
      }

      row[1] = provBeira;

      const marca = resolveMarcaByName(row[2], marcaByName);
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
      row[17] = ""; // evento opcional — no hardcode 37
      row[18] = provId ?? "";
      outRows.push(row.slice(0, 19));
    }
  }

  const outWb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(outRows);
  XLSX.utils.book_append_sheet(outWb, sheet, "IC");
  XLSX.writeFile(outWb, OUT);
  if (OUT_COPY !== OUT) XLSX.writeFile(outWb, OUT_COPY);

  console.log(
    JSON.stringify(
      {
        fuente: SRC,
        salida: OUT,
        stats,
        errores: stats.errores.slice(0, 20),
        total_errores: stats.errores.length,
      },
      null,
      2,
    ),
  );

  if (stats.errores.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
