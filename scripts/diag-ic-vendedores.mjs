import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL missing");

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const q1 = await pool.query(`
  SELECT DISTINCT u.id_usuario AS id, u.descp_usuario AS label
  FROM usuario_v2 u
  JOIN maestro_rol_acceso r ON u.rol_id = r.id
  WHERE r.nombre_rol IN ('VENDEDOR', 'ADMIN')
  ORDER BY u.descp_usuario
`);
console.log("vendedores (query actual):", q1.rows.length, q1.rows.slice(0, 5));

try {
  const v2 = await pool.query(
    "SELECT id_vendedor AS id, descp_vendedor AS label FROM vendedor_v2 ORDER BY descp_vendedor LIMIT 15",
  );
  console.log("vendedor_v2:", v2.rows.length, v2.rows);
} catch (e) {
  console.log("vendedor_v2: tabla no existe o error", e.message);
}

const qEjecutor = await pool.query(`
  SELECT DISTINCT u.id_usuario AS id, u.descp_usuario AS label
  FROM usuario_v2 u
  JOIN maestro_rol_acceso r ON u.rol_id = r.id
  WHERE r.nombre_rol IN ('EJECUTOR', 'ADMINISTRADOR', 'GERENTE')
  ORDER BY u.descp_usuario
`);
console.log("fallback EJECUTOR+ADMIN+GERENTE:", qEjecutor.rows.length, qEjecutor.rows.slice(0, 5));

const roles = await pool.query(`SELECT id, nombre_rol FROM maestro_rol_acceso ORDER BY nombre_rol`);
console.log("roles:", roles.rows);

const usuarios = await pool.query(`
  SELECT u.id_usuario, u.descp_usuario, r.nombre_rol
  FROM usuario_v2 u
  LEFT JOIN maestro_rol_acceso r ON u.rol_id = r.id
  ORDER BY u.descp_usuario
  LIMIT 20
`);
console.log("usuarios sample:", usuarios.rows);

await pool.end();
