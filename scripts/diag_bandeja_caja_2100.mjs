/** ¿Hay facturas en bandeja para caja 2100? */
import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  const all = await c.query(`
    SELECT staging_id, estado, activo, count(*)::int AS filas,
           max(numero_fi_fa) AS fi_fa, max(cedula_cliente) AS cedula,
           max(snapshot_cliente->>'nombre') AS nombre,
           max(snapshot_cliente->>'apellido') AS apellido,
           max(created_at) AS created_at
    FROM ticket_bandeja_cajero
    WHERE cliente_id = 2100
    GROUP BY staging_id, estado, activo
    ORDER BY max(created_at) DESC
  `);
  const pendientes = await c.query(`
    SELECT id, staging_id, estado, activo, numero_fi_fa, grada, cantidad,
           cedula_cliente, codigo_bandeja, created_at, cerrado_at
    FROM ticket_bandeja_cajero
    WHERE cliente_id = 2100 AND estado = 'PENDIENTE_CAJA' AND activo = true
    ORDER BY created_at DESC LIMIT 20
  `);
  const counters = await c.query(`SELECT * FROM pos_fi_fa_counter WHERE cliente_id = 2100`);
  console.log(JSON.stringify({ resumen: all.rows, pendientes: pendientes.rows, counters: counters.rows }, null, 2));
} finally {
  await c.end();
}
