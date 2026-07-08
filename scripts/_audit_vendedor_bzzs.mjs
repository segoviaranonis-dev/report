import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const cols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='vendedor_v2' ORDER BY ordinal_position
`);
console.log("vendedor_v2 cols:", cols.rows.map((r) => r.column_name).join(", "));

const u = await pool.query(`
  SELECT id_usuario, descp_usuario, rol_id FROM usuario_v2 WHERE id_usuario=9 OR descp_usuario ILIKE '%BZZS%'
`);
console.log("usuario BZZS:", u.rows);

const v = await pool.query(`SELECT * FROM vendedor_v2 WHERE id_vendedor=9 LIMIT 1`);
console.log("vendedor id 9:", v.rows[0]);

const ic = await pool.query(`
  SELECT ic.id, ic.numero_registro, ic.id_vendedor, vd.descp_vendedor
  FROM intencion_compra ic
  JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
  JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
  WHERE icp.pedido_proveedor_id = 15 LIMIT 2
`);
console.log("IC vendedor:", ic.rows);

await pool.end();
