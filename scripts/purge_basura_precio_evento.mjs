/**
 * Elimina precio_evento borrador sin SKUs y sin vínculo IC/PP.
 * node scripts/purge_basura_precio_evento.mjs           # dry-run
 * node scripts/purge_basura_precio_evento.mjs --execute # borra
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execute = process.argv.includes("--execute");
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error("NO DATABASE_URL");
  process.exit(1);
}
const url = m[1].trim().replace(/^"|"$/g, "");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function eliminarEvento(client, eventoId) {
  await client.query(`UPDATE intencion_compra SET precio_evento_id = NULL WHERE precio_evento_id = $1`, [
    eventoId,
  ]);
  await client.query(`UPDATE intencion_compra_pedido SET precio_evento_id = NULL WHERE precio_evento_id = $1`, [
    eventoId,
  ]);

  const skuTable = await client.query(
    `SELECT to_regclass('public.precio_evento_sku_excel') IS NOT NULL AS ok`,
  );
  if (skuTable.rows[0]?.ok) {
    await client.query(`DELETE FROM precio_evento_sku_excel WHERE evento_id = $1`, [eventoId]);
  }

  await client.query(`DELETE FROM precio_lista_staging WHERE evento_id = $1`, [eventoId]).catch(() => {});
  await client.query(`DELETE FROM precio_auditoria WHERE evento_id = $1`, [eventoId]).catch(() => {});
  await client.query(
    `DELETE FROM precio_evento_linea_excepcion
     WHERE caso_id IN (SELECT id FROM precio_evento_caso WHERE evento_id = $1)`,
    [eventoId],
  );
  await client.query(`DELETE FROM precio_lista WHERE evento_id = $1`, [eventoId]);
  await client.query(`DELETE FROM precio_evento_caso WHERE evento_id = $1`, [eventoId]);
  await client.query(`DELETE FROM precio_evento WHERE id = $1`, [eventoId]);
}

const client = await pool.connect();
try {
  const { rows: candidatos } = await client.query(`
    SELECT pe.id, pe.nombre_evento, pe.estado,
           COALESCE(pl.n, 0)::int AS skus,
           EXISTS (SELECT 1 FROM intencion_compra ic WHERE ic.precio_evento_id = pe.id) AS ic_ref,
           EXISTS (SELECT 1 FROM intencion_compra_pedido icp WHERE icp.precio_evento_id = pe.id) AS pp_ref
    FROM precio_evento pe
    LEFT JOIN (SELECT evento_id, COUNT(*) n FROM precio_lista GROUP BY evento_id) pl ON pl.evento_id = pe.id
    WHERE pe.estado = 'borrador'
      AND COALESCE(pl.n, 0) = 0
      AND NOT EXISTS (SELECT 1 FROM intencion_compra ic WHERE ic.precio_evento_id = pe.id)
      AND NOT EXISTS (SELECT 1 FROM intencion_compra_pedido icp WHERE icp.precio_evento_id = pe.id)
    ORDER BY pe.id
  `);

  console.log(`\n=== Candidatos basura: ${candidatos.length} ===`);
  candidatos.forEach((r) => console.log(`  #${r.id} · ${r.nombre_evento}`));

  if (!candidatos.length) {
    console.log("Nada que eliminar.");
    process.exit(0);
  }

  if (!execute) {
    console.log("\nDry-run. Re-ejecutar con --execute para borrar.");
    process.exit(0);
  }

  await client.query("BEGIN");
  for (const r of candidatos) {
    await eliminarEvento(client, Number(r.id));
    console.log(`  ELIMINADO #${r.id} · ${r.nombre_evento}`);
  }
  await client.query("COMMIT");
  console.log(`\nOK — ${candidatos.length} listados eliminados.`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ERROR", e.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
