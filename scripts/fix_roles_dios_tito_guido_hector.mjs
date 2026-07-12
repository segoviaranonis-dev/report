import fs from "fs";
import pg from "pg";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const DIOS_USERS = ["HECTOR", "Tito", "Guido"];
const ADMIN_RIMEC = "ALFREDO";

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const ente = await client.query(
    `SELECT id_ente FROM entes WHERE codigo = 1 ORDER BY id_ente LIMIT 1`,
  );
  const enteId = ente.rows[0]?.id_ente;
  if (!enteId) throw new Error("ente RIMEC no encontrado");

  console.log("=== ANTES ===");
  const before = await client.query(`
    SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id, u.bloqueado
    FROM usuario_v2 u
    WHERE u.descp_usuario ILIKE ANY($1::text[])
       OR u.descp_usuario ILIKE $2
    ORDER BY u.descp_usuario
  `, [[...DIOS_USERS.map((n) => n.toLowerCase()), ...DIOS_USERS], ADMIN_RIMEC]);
  console.log(JSON.stringify(before.rows, null, 2));

  for (const name of DIOS_USERS) {
    const r = await client.query(
      `UPDATE usuario_v2
       SET rol_id = 1, categoria = 'DIOS', categoria_id = 1, ente_id = $1, bloqueado = false
       WHERE descp_usuario ILIKE $2
       RETURNING id_usuario, descp_usuario, rol_id, categoria`,
      [enteId, name],
    );
    console.log(r.rowCount ? `DIOS OK: ${r.rows[0].descp_usuario}` : `WARN no encontrado: ${name}`);
  }

  const alfredo = await client.query(
    `UPDATE usuario_v2
     SET rol_id = 1, categoria = 'ADMIN', categoria_id = 2, ente_id = $1, bloqueado = false
     WHERE descp_usuario ILIKE $2
     RETURNING id_usuario, descp_usuario, rol_id, categoria`,
    [enteId, ADMIN_RIMEC],
  );
  console.log(alfredo.rowCount ? `ADMIN RIMEC OK: ${alfredo.rows[0].descp_usuario}` : "WARN ALFREDO no encontrado");

  console.log("=== DESPUÉS ===");
  const after = await client.query(`
    SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id, u.bloqueado
    FROM usuario_v2 u
    WHERE u.descp_usuario ILIKE ANY($1::text[])
       OR u.descp_usuario ILIKE $2
    ORDER BY u.descp_usuario
  `, [[...DIOS_USERS.map((n) => n.toLowerCase()), ...DIOS_USERS], ADMIN_RIMEC]);
  console.log(JSON.stringify(after.rows, null, 2));
  console.log("roles_corregidos_ok");
} finally {
  await client.end();
}
