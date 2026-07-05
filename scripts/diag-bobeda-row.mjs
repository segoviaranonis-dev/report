import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const codigo = process.argv[2] ?? "ORO-POS-2400-2-20260703113832-3";

const row = await pool.query(
  `
    SELECT codigo_oro, cliente_id, vendedor_nombre, vendedor_bazzar_id, vendedor_id,
           import_batch_id, bandeja_codigo, staging_id, snapshot_json
    FROM bobeda_venta_pos WHERE codigo_oro = $1
  `,
  [codigo],
);

console.log("BOBEDA:", JSON.stringify(row.rows[0], null, 2));

const batch = await pool.query(
  `
    SELECT batch_id::text, batch_label, archivo_origen, MAX(created_at)::text AS cargado
    FROM registro_st_vt_rc_reposicion
    WHERE cliente_id = 2400 OR true
    GROUP BY batch_id, batch_label, archivo_origen
    ORDER BY MAX(created_at) DESC NULLS LAST
    LIMIT 5
  `,
);
console.log("RETAIL BATCHES (top 5):", JSON.stringify(batch.rows, null, 2));

const depMeta = await pool.query(
  `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE '%deposito%sync%'
    ORDER BY 1 LIMIT 20
  `,
);
console.log("SYNC TABLES:", depMeta.rows.map((r) => r.table_name));

const depRow = await pool.query(
  `
    SELECT grada, cantidad, batch_label, created_at, cantidad_importada
    FROM deposito_1_2400_tienda
    WHERE linea_id = 50 AND referencia_id = 102 AND material_id = 34127 AND color_id = 236 AND grada = '39'
    LIMIT 3
  `,
);
console.log("DEP ROW:", JSON.stringify(depRow.rows, null, 2));

await pool.end();
