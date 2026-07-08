import pg from "pg";
import fs from "fs";

const pool = new pg.Pool({
  connectionString: fs.readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
});

const u = await pool.query(`SELECT id_usuario, descp_usuario, rol_id FROM usuario_v2 WHERE descp_usuario ILIKE '%FRANCIS%'`);
console.log("usuarios FRANCIS:", u.rows);

const c = await pool.query(`
  SELECT conname, pg_get_constraintdef(oid) def
  FROM pg_constraint
  WHERE conrelid = 'factura_interna'::regclass AND conname ILIKE '%vendedor%'
`);
console.log("constraints:", c.rows);

await pool.end();
