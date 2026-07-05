/**
 * Import CSV POS Bazzar → depósitos por ente (sdfm · sdsm · sdpl).
 * Calzado 654 y confecciones 638 — índice numérico independiente por proveedor_id.
 *
 * Uso: node scripts/import_bazzar_csv_deposito.mjs <ruta.csv> [--dry-run]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import {
  resolvePilaresCodigos,
  validateMatrizTienda,
  PROVEEDOR_CALZADO,
  PROVEEDOR_CONFECCIONES,
} from "./lib/pilar-proveedor-index.mjs";
import {
  buildDepositMapForEnte,
  parseBazzarCsvFilename,
} from "./lib/bazzar-csv-ente-map.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL no encontrada en .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function parseGrada(raw, ramo) {
  const s = String(raw ?? "").trim();
  if (ramo === "confecciones") {
    const m = s.match(/(\d{1,2})/);
    return m ? m[1] : s;
  }
  const m = s.match(/(\d{2})/);
  return m ? m[1] : s;
}

function qty(raw) {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function parseLpn(raw) {
  const n = Number(String(raw ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 1000 ? n / 1000 : n;
}

function parsePipeCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split("|").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("|");
    const rec = {};
    for (let j = 0; j < headers.length; j++) rec[headers[j]] = (parts[j] ?? "").trim();
    rows.push(rec);
  }
  return rows;
}

function expandRows(csvRows, batchLabel, depositMap) {
  const buckets = new Map(depositMap.map((m) => [m.tabla, { meta: m, lines: [] }]));
  const stats = {
    skipped_parse: 0,
    skipped_matriz: 0,
    calzado: 0,
    confecciones: 0,
    matriz_reasons: {},
  };

  for (const row of csvRows) {
    const codGrupo = row["COD.GRUPO"] || row["GRUPO"] || "";
    const pilares = resolvePilaresCodigos({
      cod_art_proveedor: row["COD.ART.PROVEEDOR"] ?? "",
      cod_grupo: codGrupo,
      cod_material: row["COD.MATERIAL"] ?? "",
      cod_color: row["COD.COLOR"] ?? "",
    });
    if (!pilares) {
      stats.skipped_parse += 1;
      continue;
    }

    const grada = parseGrada(row["DESCRIPCION GRADA"], pilares.ramo);
    const precio = parseLpn(row["LPN"]);

    for (const m of depositMap) {
      const cantidad = qty(row[m.col]);
      if (cantidad <= 0) continue;

      const matriz = validateMatrizTienda(m.cliente_id, pilares.tipo_v2_id, null, codGrupo);
      if (!matriz.ok) {
        stats.skipped_matriz += cantidad;
        stats.matriz_reasons[matriz.reason] = (stats.matriz_reasons[matriz.reason] ?? 0) + cantidad;
        continue;
      }

      if (pilares.ramo === "calzado") stats.calzado += cantidad;
      else stats.confecciones += cantidad;

      buckets.get(m.tabla).lines.push({
        codigo_barras: row["CODIGO ARTICULO"] ?? "",
        cod_grupo: codGrupo,
        grada,
        cantidad,
        precio_unitario: precio,
        cliente_id: m.cliente_id,
        batch_label: batchLabel,
        pilares,
      });
    }
  }

  return { buckets, stats };
}

async function assertSinBandejaAbierta(pool, cliente_id) {
  const r = await pool.query(
    `SELECT COUNT(DISTINCT staging_id)::int AS n
     FROM public.ticket_bandeja_cajero
     WHERE cliente_id = $1 AND estado = 'ABIERTO' AND activo = true`,
    [cliente_id],
  );
  if ((r.rows[0]?.n ?? 0) > 0) {
    throw new Error(`cliente_id ${cliente_id}: bandeja POS ABIERTA — cerrar antes de import CSV`);
  }
}

/** JOIN triplete (proveedor_id, codigo_proveedor) — calzado 654 */
const INSERT_CALZADO_SQL = `
INSERT INTO public.__TABLA__ (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  $1, $2, $3, $4, $5,
  l.id, r.id, mat.id, col.id,
  $6, $7, $8,
  CASE WHEN $8 IS NOT NULL THEN $7 * $8 ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  1,
  $9, 'stock', 'BAZZAR_CSV', $10,
  CURRENT_DATE, NOW(), 'import_bazzar_csv', $11
FROM public.linea l
INNER JOIN public.referencia r
  ON r.linea_id = l.id
  AND r.proveedor_id = ${PROVEEDOR_CALZADO}
  AND r.codigo_proveedor = CAST($3 AS bigint)
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CALZADO}
  AND mat.codigo_proveedor = CAST($4 AS bigint)
INNER JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CALZADO}
  AND col.codigo_proveedor = CAST($5 AS bigint)
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE l.proveedor_id = ${PROVEEDOR_CALZADO}
  AND l.codigo_proveedor = CAST($2 AS bigint)
`;

/** JOIN triplete 638 — tipo_v2=2 fijo; dimensiones enriquecibles después */
const INSERT_CONFECCIONES_SQL = `
INSERT INTO public.__TABLA__ (
  codigo_barras, linea_codigo_proveedor, referencia_codigo_proveedor,
  excel_material_code, excel_color_code,
  linea_id, referencia_id, material_id, color_id,
  grada, cantidad, precio_unitario, monto,
  marca_id, genero_id, grupo_estilo_id, tipo_1_id, tipo_v2_id,
  cliente_id, tipo_movimiento, origen_holding, batch_label,
  fecha_mov, created_at, created_by, archivo_origen
)
SELECT
  $1, $2, $3, $4, $5,
  l.id, r.id, mat.id, col.id,
  $6, $7, $8,
  CASE WHEN $8 IS NOT NULL THEN $7 * $8 ELSE NULL END,
  l.marca_id, l.genero_id, lr.grupo_estilo_id, lr.tipo_1_id,
  2,
  $9, 'stock', 'BAZZAR_CSV', $10,
  CURRENT_DATE, NOW(), 'import_bazzar_csv', $11
FROM public.linea l
INNER JOIN public.referencia r
  ON r.linea_id = l.id
  AND r.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND r.codigo_proveedor = CAST($12 AS bigint)
INNER JOIN public.material mat
  ON mat.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND mat.codigo_proveedor = CAST($13 AS bigint)
LEFT JOIN public.color col
  ON col.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND col.codigo_proveedor = CAST($14 AS bigint)
LEFT JOIN public.linea_referencia lr
  ON lr.linea_id = l.id AND lr.referencia_id = r.id
WHERE l.proveedor_id = ${PROVEEDOR_CONFECCIONES}
  AND l.codigo_proveedor = CAST($15 AS bigint)
`;

async function importTabla(pool, tabla, lines, dryRun) {
  if (!lines.length) {
    console.log(`  ${tabla}: sin filas — omitido`);
    return { deleted: 0, inserted: 0, fk_miss: 0 };
  }
  const cliente_id = lines[0].cliente_id;
  await assertSinBandejaAbierta(pool, cliente_id);

  const calz = lines.filter((l) => l.pilares.ramo === "calzado").length;
  const conf = lines.length - calz;

  if (dryRun) {
    const unidades = lines.reduce((s, l) => s + l.cantidad, 0);
    console.log(
      `  ${tabla}: [dry-run] ${lines.length} filas (${calz} calzado · ${conf} conf.) · ${unidades} uds · cliente ${cliente_id}`,
    );
    return { deleted: 0, inserted: lines.length, fk_miss: 0 };
  }

  const sqlCalz = INSERT_CALZADO_SQL.replace("__TABLA__", tabla);
  const sqlConf = INSERT_CONFECCIONES_SQL.replace("__TABLA__", tabla);
  const client = await pool.connect();
  let fkMiss = 0;
  try {
    await client.query("BEGIN");
    const del = await client.query(`DELETE FROM public.${tabla}`);
    let inserted = 0;
    for (const line of lines) {
      const p = line.pilares;
      let res;
      if (p.ramo === "calzado") {
        res = await client.query(sqlCalz, [
          line.codigo_barras,
          p.linea_codigo_proveedor,
          p.referencia_codigo_proveedor,
          p.excel_material_code,
          p.excel_color_code,
          line.grada,
          line.cantidad,
          line.precio_unitario,
          line.cliente_id,
          line.batch_label,
          line.batch_label,
        ]);
      } else {
        if (!p.color_codigo_bigint) {
          fkMiss += 1;
          continue;
        }
        res = await client.query(sqlConf, [
          line.codigo_barras,
          p.linea_codigo_proveedor,
          p.referencia_codigo_proveedor,
          p.excel_material_code,
          p.excel_color_code,
          line.grada,
          line.cantidad,
          line.precio_unitario,
          line.cliente_id,
          line.batch_label,
          line.batch_label,
          p.referencia_codigo_bigint,
          p.material_codigo_bigint,
          p.color_codigo_bigint,
          p.linea_codigo_bigint,
        ]);
      }
      inserted += res.rowCount ?? 0;
      if ((res.rowCount ?? 0) === 0) fkMiss += 1;
    }
    await client.query("COMMIT");
    console.log(
      `  ${tabla}: DELETE ${del.rowCount ?? 0} · INSERT ${inserted}/${lines.length} · FK miss ${fkMiss} (${calz} calz · ${conf} conf.)`,
    );
    return { deleted: del.rowCount ?? 0, inserted, fk_miss: fkMiss };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const csvPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!csvPath) {
    console.error("Uso: node scripts/import_bazzar_csv_deposito.mjs <ruta.csv> [--dry-run]");
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  const base = path.basename(abs);
  const parsed = parseBazzarCsvFilename(base);
  if (!parsed.ok) {
    console.error("ERROR nombre archivo:", parsed.reason);
    process.exit(1);
  }
  const depositMap = buildDepositMapForEnte(parsed.ente);
  const batchLabel = path.basename(abs, path.extname(abs));
  const text = fs.readFileSync(abs, { encoding: "latin1" });
  const csvRows = parsePipeCsv(text);
  console.log(`CSV: ${abs}`);
  console.log(`Ente: ${parsed.ente} · lote ${parsed.lote} · prefijo ${parsed.prefix}`);
  console.log(`Filas: ${csvRows.length} · batch: ${batchLabel}${dryRun ? " · DRY-RUN" : ""}`);
  console.log(`Destinos: ${depositMap.map((d) => d.tabla).join(" · ")}`);
  console.log(`Índice: calzado ${PROVEEDOR_CALZADO} · confecciones ${PROVEEDOR_CONFECCIONES}\n`);

  const { buckets, stats } = expandRows(csvRows, batchLabel, depositMap);
  console.log("Resolución pilares:");
  console.log(`  calzado 654: ${stats.calzado} uds`);
  console.log(`  confecciones 638: ${stats.confecciones} uds`);
  console.log(`  omitidas parse: ${stats.skipped_parse} filas CSV`);
  console.log(`  omitidas matriz: ${stats.skipped_matriz} uds`);
  if (Object.keys(stats.matriz_reasons).length) {
    for (const [reason, n] of Object.entries(stats.matriz_reasons)) {
      console.log(`    · ${reason}: ${n} uds`);
    }
  }
  console.log("");

  const url = loadEnv();
  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });

  try {
    for (const [tabla, { lines }] of buckets) {
      await importTabla(pool, tabla, lines, dryRun);
    }
    console.log("\nOK — FK por proveedor_id · tipo_v2 independiente 1|2");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
