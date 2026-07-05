/**
 * Congela trazabilidad import en snapshot_json de filas ORO existentes.
 * Solo completa claves faltantes en snapshot.
 */
import fs from "fs";
import pg from "pg";

const TIENDAS = {
  2100: "deposito_1_2100_tienda",
  2900: "deposito_1_2900_tienda",
  2400: "deposito_1_2400_tienda",
  2700: "deposito_1_2700_tienda",
  3100: "deposito_1_3100_tienda",
};

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL missing");

const dry = process.argv.includes("--dry");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function traz(clienteId, pilares) {
  const tabla = TIENDAS[clienteId];
  if (!tabla) return null;
  const r = await pool.query(
    `SELECT batch_label, created_at FROM public.${tabla}
     WHERE linea_id=$1 AND referencia_id=$2 AND material_id=$3 AND color_id=$4 AND grada=$5
     ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [pilares.linea_id, pilares.referencia_id, pilares.material_id, pilares.color_id, pilares.grada],
  );
  const row = r.rows[0];
  if (!row) return { deposito_tabla: tabla, import_batch_label: null, import_fecha: null };
  return {
    deposito_tabla: tabla,
    import_batch_label: row.batch_label?.trim() || null,
    import_fecha: row.created_at?.toISOString() ?? null,
  };
}

const { rows } = await pool.query(`
  SELECT codigo_oro, cliente_id, linea_id, referencia_id, material_id, color_id, grada, snapshot_json
  FROM bobeda_venta_pos ORDER BY created_at DESC
`);

let updated = 0;
let skipped = 0;

for (const row of rows) {
  const snap = row.snapshot_json ?? {};
  if (snap.deposito_tabla && snap.import_batch_label) {
    skipped++;
    continue;
  }
  const tr = await traz(Number(row.cliente_id), {
    linea_id: Number(row.linea_id),
    referencia_id: Number(row.referencia_id),
    material_id: Number(row.material_id),
    color_id: Number(row.color_id),
    grada: row.grada,
  });
  if (!tr?.import_batch_label) {
    skipped++;
    continue;
  }
  const merged = {
    ...snap,
    deposito_tabla: tr.deposito_tabla,
    import_batch_label: tr.import_batch_label,
    import_fecha: tr.import_fecha,
    retail_batch_label: tr.import_batch_label,
    batch_label: tr.import_batch_label,
  };
  if (!dry) {
    await pool.query(`UPDATE bobeda_venta_pos SET snapshot_json = $2::jsonb WHERE codigo_oro = $1`, [
      row.codigo_oro,
      JSON.stringify(merged),
    ]);
  }
  updated++;
  console.log(dry ? "[dry]" : "[ok]", row.codigo_oro, tr.import_batch_label);
}

console.log({ total: rows.length, updated, skipped, dry });
await pool.end();
