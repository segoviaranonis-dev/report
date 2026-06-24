/**
 * Diagnóstico post-reset: secuencias, contadores, stock prueba ACTVITTA 4202.
 */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

const CLIENTE = 2100;
const MARCA = "ACTVITTA";
const LINEA = "4202";
const REF = "500";

try {
  const seqs = await client.query(`
    SELECT sequencename, last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
      AND sequencename IN (
        'ticket_bandeja_lote_id_seq',
        'ticket_bandeja_cajero_id_seq',
        'bobeda_venta_pos_id_seq'
      )
  `);
  console.log("sequences", seqs.rows);

  const counters = await client.query(`SELECT * FROM pos_fi_fa_counter ORDER BY cliente_id`);
  console.log("fi_fa_counters", counters.rows);

  const counts = await client.query(`
    SELECT
      (SELECT count(*)::int FROM ticket_bandeja_cajero) AS bandeja,
      (SELECT count(*)::int FROM bobeda_venta_pos) AS bobeda,
      (SELECT count(*)::int FROM ticket_bandeja_cajero WHERE estado = 'ABIERTO') AS abierto,
      (SELECT count(*)::int FROM ticket_bandeja_cajero WHERE estado = 'PENDIENTE_CAJA') AS en_caja
  `);
  console.log("counts", counts.rows[0]);

  const depExists = await client.query(`
    SELECT to_regclass('public.deposito_1_2100_tienda') IS NOT NULL AS reg
  `);
  console.log("deposito_2100", depExists.rows[0]);

  if (depExists.rows[0]?.reg) {
    const stockTotal = await client.query(`
      SELECT count(*)::int AS filas, coalesce(sum(cantidad),0)::int AS pares
      FROM deposito_1_2100_tienda
    `);
    console.log("stock_2100_total", stockTotal.rows[0]);

    const stock4202 = await client.query(`
      SELECT d.grada, d.cantidad, l.codigo_proveedor AS linea, r.codigo_proveedor AS ref
      FROM deposito_1_2100_tienda d
      JOIN linea l ON l.id = d.linea_id
      JOIN referencia r ON r.id = d.referencia_id
      WHERE l.codigo_proveedor = $1 AND r.codigo_proveedor = $2
      ORDER BY d.grada
      LIMIT 20
    `, [LINEA, REF]);
    console.log(`stock_${LINEA}.${REF}_2100`, stock4202.rows);

    const marcaActvitta = await client.query(`
      SELECT count(*)::int AS n
      FROM deposito_1_2100_tienda d
      JOIN linea l ON l.id = d.linea_id
      JOIN marca m ON m.id = l.marca_id
      WHERE upper(m.descripcion) LIKE '%ACTVIT%'
    `);
    console.log("filas_actvitta_2100", marcaActvitta.rows[0]);
  }

  const bandejaCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_bandeja_cajero'
    ORDER BY ordinal_position
  `);
  console.log(
    "bandeja_columns",
    bandejaCols.rows.map((c) => `${c.column_name}:${c.data_type}`),
  );

  const estadoCheck = await client.query(`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.ticket_bandeja_cajero'::regclass
      AND contype = 'c' AND conname LIKE '%estado%'
  `);
  console.log("estado_check", estadoCheck.rows[0]?.def);
} finally {
  await client.end();
}
