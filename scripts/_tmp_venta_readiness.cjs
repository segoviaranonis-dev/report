const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const checks = [];

async function reg(name) {
  const r = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${name}`]);
  return Boolean(r.rows[0]?.ok);
}

(async () => {
  const tables = [
    "deposito_1_2100_tienda",
    "deposito_1_2900_tienda",
    "vendedor_bazzar",
    "ticket_pos_staging",
    "ticket_pos_staging_linea",
    "ticket_venta_pos",
    "clients_bazaar",
    "funcionarios",
    "entes",
  ];
  for (const t of tables) {
    const ok = await reg(t);
    let extra = "";
    if (ok) {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM public.${t}`);
      extra = ` (${c.rows[0].n} rows)`;
    }
    checks.push({ item: t, ok, extra });
  }

  const vb = await pool.query(`
    SELECT vb.codigo_pin, vb.nombre_display, e.nombre AS ente
    FROM vendedor_bazzar vb JOIN entes e ON e.id_ente = vb.ente_id
    WHERE vb.activo ORDER BY e.codigo, vb.codigo_pin
  `);

  const stock2100 = await pool.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(cantidad),0)::float AS p FROM deposito_1_2100_tienda`);

  console.log(JSON.stringify({ checks, vendedores: vb.rows, stock_2100: stock2100.rows[0] }, null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
