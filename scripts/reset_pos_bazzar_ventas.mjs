/**
 * Reset ventas POS Bazzar (bandeja única + Bobeda) y contador FI_FA.
 * Restaura stock sesión desde filas bandeja activas antes de borrar.
 *
 * Uso: node scripts/reset_pos_bazzar_ventas.mjs
 */
import fs from "fs";
import pg from "pg";

const TABLAS_DEPOSITO = {
  2100: "deposito_1_2100_tienda",
  2900: "deposito_1_2900_tienda",
  2400: "deposito_1_2400_tienda",
  2700: "deposito_1_2700_tienda",
  3100: "deposito_1_3100_tienda",
  3200: "deposito_1_3200_tienda",
};

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

function sqlInc(tabla, p) {
  return {
    text: `
      UPDATE public.${tabla} s
      SET cantidad = cantidad + 1
      WHERE s.id = (
        SELECT id FROM public.${tabla}
        WHERE linea_id = $1 AND referencia_id = $2 AND material_id = $3 AND color_id = $4
          AND btrim(grada::text) = $5
        ORDER BY id FOR UPDATE LIMIT 1
      )
    `,
    params: [p.linea_id, p.referencia_id, p.material_id, p.color_id, p.grada.trim()],
  };
}

await client.connect();
try {
  await client.query("BEGIN");

  const lineas = await client.query(`
    SELECT linea_id, referencia_id, material_id, color_id, grada, cantidad, cliente_id
    FROM public.ticket_bandeja_cajero
    WHERE activo = true AND cantidad > 0
      AND estado IN ('ABIERTO', 'PENDIENTE_CAJA', 'CSV_DESCARGADO')
  `);

  let stockRestaurado = 0;
  for (const row of lineas.rows) {
    const tabla = TABLAS_DEPOSITO[row.cliente_id];
    if (!tabla) continue;
    for (let i = 0; i < row.cantidad; i++) {
      const q = sqlInc(tabla, row);
      await client.query(q.text, q.params);
      stockRestaurado += 1;
    }
  }

  await client.query("DELETE FROM public.ticket_bandeja_cajero");
  await client.query("DELETE FROM public.bobeda_venta_pos");
  await client.query("DELETE FROM public.ticket_venta_pos");
  await client.query("DELETE FROM public.ticket_pos_staging_linea");
  await client.query("DELETE FROM public.ticket_pos_staging");
  await client.query("DELETE FROM public.pos_fi_fa_counter");

  await client.query("ALTER SEQUENCE IF EXISTS ticket_bandeja_cajero_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE IF EXISTS ticket_bandeja_lote_id_seq RESTART WITH 1");
  await client.query("ALTER SEQUENCE IF EXISTS bobeda_venta_pos_id_seq RESTART WITH 1");

  await client.query("COMMIT");

  const check = await client.query(`
    SELECT
      (SELECT count(*)::int FROM ticket_bandeja_cajero) AS bandeja,
      (SELECT count(*)::int FROM bobeda_venta_pos) AS bobeda,
      (SELECT count(*)::int FROM ticket_venta_pos) AS legacy,
      (SELECT count(*)::int FROM pos_fi_fa_counter) AS counters
  `);

  console.log("reset_ok", { stockRestaurado, ...check.rows[0] });

  const next = await client.query(`
    SELECT
      (SELECT last_value FROM ticket_bandeja_lote_id_seq) AS next_lote,
      (SELECT count(*)::int FROM pos_fi_fa_counter) AS counters
  `);
  console.log("Proxima venta tienda 2100: staging_id (lote)=1, FI_FA=1");
  console.log("Secuencias:", next.rows[0]);
  console.log("Catálogo: reset NO borra depósito — si falta un modelo, revisar stock deposito_1_{cliente_id}_tienda");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("reset_fail", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
