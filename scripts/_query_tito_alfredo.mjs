import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const users = await client.query(`
    SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id,
           e.codigo AS ente_codigo, u.bloqueado
    FROM usuario_v2 u
    LEFT JOIN entes e ON e.id_ente = u.ente_id
    WHERE u.descp_usuario ILIKE '%tito%' OR u.descp_usuario ILIKE '%alfred%'
    ORDER BY u.descp_usuario
  `);
  console.log("=== Tito / Alfredo ===");
  console.log(JSON.stringify(users.rows, null, 2));

  const tito = await client.query(`
    SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id,
           e.codigo AS ente_codigo, u.bloqueado
    FROM usuario_v2 u
    LEFT JOIN entes e ON e.id_ente = u.ente_id
    WHERE u.descp_usuario ILIKE 'tito' LIMIT 1
  `);
  console.log("=== plantilla Tito ===");
  console.log(JSON.stringify(tito.rows[0] ?? null, null, 2));
} finally {
  await client.end();
}
