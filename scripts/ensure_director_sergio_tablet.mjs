/**
 * Usuario DIRECTOR (id 5) → Nivel Dios tablet · rol_id=1 · DIOS · ente RIMEC.
 * Uso: node scripts/ensure_director_sergio_tablet.mjs
 */
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

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
  if (!enteId) throw new Error("ente codigo=1 no encontrado");

  let catId = null;
  try {
    const cat = await client.query(
      `SELECT id_categoria FROM categoria WHERE upper(trim(descripcion)) = 'DIOS' LIMIT 1`,
    );
    catId = cat.rows[0]?.id_categoria ?? null;
  } catch {
    /* categoria table optional shape */
  }

  const before = await client.query(
    `SELECT id_usuario, descp_usuario, rol_id, categoria, categoria_id, ente_id, bloqueado
     FROM usuario_v2 WHERE id_usuario = 5 OR descp_usuario ILIKE 'director' LIMIT 1`,
  );
  if (!before.rows[0]) {
    console.error("Usuario DIRECTOR (id 5) no encontrado");
    process.exit(1);
  }
  console.log("antes:", before.rows[0]);

  const params = [enteId, before.rows[0].id_usuario];
  let sql = `UPDATE usuario_v2 SET rol_id = 1, categoria = 'DIOS', ente_id = $1, bloqueado = false`;
  if (catId != null) {
    sql += `, categoria_id = $3`;
    params.push(catId);
  }
  sql += ` WHERE id_usuario = $2`;
  await client.query(sql, params);

  const after = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.ente_id, e.codigo AS ente_codigo,
            u.bloqueado, left(u.password_hash, 20) AS hash_prefix
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.id_usuario = $1`,
    [before.rows[0].id_usuario],
  );
  console.log("despues:", after.rows[0]);

  const passCheck = await client.query(
    `SELECT password, password_hash FROM usuario_v2 WHERE id_usuario = $1`,
    [before.rows[0].id_usuario],
  );
  const row = passCheck.rows[0];
  const okHash = row?.password_hash
    ? await bcrypt.compare("RIMEC", row.password_hash)
    : false;
  const okPlain = (row?.password ?? "").trim() === "RIMEC";
  console.log("login RIMEC:", { okHash, okPlain });

  console.log("director_sergio_tablet_ok");
} finally {
  await client.end();
}
