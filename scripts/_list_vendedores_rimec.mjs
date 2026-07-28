import fs from "fs";
import pg from "pg";

const url = fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });

const vendedores = await pool.query(`
  SELECT v.id_vendedor, v.descp_vendedor
  FROM vendedor_v2 v
  ORDER BY v.descp_vendedor
`);
console.log("=== VENDEDORES vendedor_v2 (catálogo RIMEC) ===");
console.table(vendedores.rows);

const usuariosVendedor = await pool.query(`
  SELECT u.id_usuario, u.descp_usuario, u.categoria, u.rol_id
  FROM usuario_v2 u
  WHERE u.rol_id = 1
  ORDER BY u.categoria, u.descp_usuario
`);
console.log("=== USUARIOS RIMEC (rol_id=1) ===");
console.table(usuariosVendedor.rows);

const orphan39 = await pool.query(`
  SELECT l.id, l.nro_factura, l.id_vendedor, fi.vendedor_id AS fi_vendedor_id
  FROM logistica_pendiente_confirmacion l
  JOIN factura_interna fi ON fi.id = l.factura_interna_id
  WHERE l.id_vendedor = 39
`);
console.log("=== FI id_vendedor=39 (huérfano) ===");
console.table(orphan39.rows);

const logistica = await pool.query(`
  SELECT l.id_vendedor, COALESCE(vd.descp_vendedor, '—') AS vendedor,
         COUNT(*)::int AS n_fi
  FROM logistica_pendiente_confirmacion l
  LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
  GROUP BY l.id_vendedor, vd.descp_vendedor
  ORDER BY n_fi DESC
`);
console.log("=== LOGÍSTICA por vendedor ===");
console.table(logistica.rows);

const sinVendedor = await pool.query(`
  SELECT COUNT(*)::int AS n
  FROM logistica_pendiente_confirmacion l
  WHERE l.id_vendedor IS NULL
`);
console.log("FI logística sin id_vendedor:", sinVendedor.rows[0]?.n);

await pool.end();
