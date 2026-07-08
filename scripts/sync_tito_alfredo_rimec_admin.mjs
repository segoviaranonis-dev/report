/**
 * Iguala Tito y Alfredo → RIMEC ADMIN (rol_id=1, categoria=ADMIN).
 * Aprobaciones queda bloqueada por middleware Report (solo DIOS).
 * Uso: node scripts/sync_tito_alfredo_rimec_admin.mjs
 */
import fs from "fs";
import pg from "pg";

const TARGET = {
  rol_id: 1,
  categoria: "ADMIN",
  categoria_id: 2,
  ente_codigo: 1,
};

const USERS = ["Tito", "ALFREDO"];

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const ente = await client.query(
    `SELECT id_ente FROM entes WHERE codigo = $1 ORDER BY id_ente LIMIT 1`,
    [TARGET.ente_codigo],
  );
  const enteId = ente.rows[0]?.id_ente;
  if (!enteId) throw new Error(`ente codigo=${TARGET.ente_codigo} no encontrado`);

  console.log("=== ANTES ===");
  const before = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id, e.codigo AS ente_codigo
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.descp_usuario ILIKE ANY($1::text[])
     ORDER BY u.descp_usuario`,
    [USERS],
  );
  console.log(JSON.stringify(before.rows, null, 2));

  for (const name of USERS) {
    const res = await client.query(
      `UPDATE usuario_v2
       SET rol_id = $1, categoria = $2, categoria_id = $3, ente_id = $4, bloqueado = false
       WHERE descp_usuario ILIKE $5
       RETURNING id_usuario, descp_usuario`,
      [TARGET.rol_id, TARGET.categoria, TARGET.categoria_id, enteId, name],
    );
    if (!res.rowCount) {
      console.warn(`WARN: usuario '${name}' no encontrado`);
    } else {
      console.log(`OK actualizado: ${res.rows[0].descp_usuario} (id ${res.rows[0].id_usuario})`);
    }
  }

  console.log("=== DESPUÉS ===");
  const after = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id, u.ente_id, e.codigo AS ente_codigo, u.bloqueado
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.descp_usuario ILIKE ANY($1::text[])
     ORDER BY u.descp_usuario`,
    [USERS],
  );
  console.log(JSON.stringify(after.rows, null, 2));
  console.log("sync_tito_alfredo_ok");
} finally {
  await client.end();
}
