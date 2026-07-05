/**
 * Asegura usuario Director (HECTOR) con rol_id=1 · DIOS · ente RIMEC (cod 1).
 * Uso: node scripts/ensure_director_tablet_access.mjs
 */
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
  const ente = await client.query(
    `SELECT id_ente, codigo FROM entes WHERE codigo = 1 ORDER BY id_ente LIMIT 1`,
  );
  const enteId = ente.rows[0]?.id_ente;
  if (!enteId) throw new Error("ente codigo=1 (RIMEC) no encontrado");

  const before = await client.query(
    `SELECT id_usuario, descp_usuario, rol_id, categoria, ente_id
     FROM usuario_v2 WHERE descp_usuario ILIKE 'HECTOR' LIMIT 1`,
  );
  console.log("antes:", before.rows[0] ?? null);

  if (!before.rows[0]) {
    console.error("Usuario HECTOR no encontrado en usuario_v2");
    process.exit(1);
  }

  await client.query(
    `UPDATE usuario_v2
     SET rol_id = 1, categoria = 'DIOS', ente_id = $1
     WHERE id_usuario = $2`,
    [enteId, before.rows[0].id_usuario],
  );

  const after = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.ente_id, e.codigo AS ente_codigo
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.id_usuario = $1`,
    [before.rows[0].id_usuario],
  );
  console.log("despues:", after.rows[0]);
  console.log("director_tablet_ok");
} finally {
  await client.end();
}
