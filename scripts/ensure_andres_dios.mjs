/**
 * Crea o actualiza usuario ANDRES · rol_id=1 · categoria DIOS · ente RIMEC.
 * Contraseña: argumento o fecha hoy YYYY-MM-DD.
 * Uso: node scripts/ensure_andres_dios.mjs [password]
 */
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const password =
  process.argv[2] ??
  new Date().toISOString().slice(0, 10); // YYYY-MM-DD local UTC slice — Director ordenó fecha de hoy

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const USERNAME = "ANDRES";

await client.connect();
try {
  const ente = await client.query(
    `SELECT id_ente, codigo FROM entes WHERE codigo = 1 ORDER BY id_ente LIMIT 1`,
  );
  const enteId = ente.rows[0]?.id_ente;
  if (!enteId) throw new Error("ente codigo=1 (RIMEC) no encontrado");

  const hector = await client.query(
    `SELECT id_usuario, descp_usuario, rol_id, categoria, categoria_id, ente_id
     FROM usuario_v2 WHERE descp_usuario ILIKE 'HECTOR' LIMIT 1`,
  );
  console.log("plantilla HECTOR:", hector.rows[0] ?? null);

  const hash = await bcrypt.hash(password, 10);

  const existing = await client.query(
    `SELECT id_usuario FROM usuario_v2 WHERE descp_usuario ILIKE $1 LIMIT 1`,
    [USERNAME],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE usuario_v2
       SET rol_id = 1, categoria = 'DIOS', categoria_id = $1, ente_id = $2, bloqueado = false,
           password_hash = $3, password = $4
       WHERE id_usuario = $5`,
      [hector.rows[0]?.categoria_id ?? 1, enteId, hash, password, existing.rows[0].id_usuario],
    );
    console.log("actualizado id:", existing.rows[0].id_usuario);
  } else {
    const nextId = await client.query(
      `SELECT COALESCE(MAX(id_usuario), 0) + 1 AS next_id FROM usuario_v2`,
    );
    const idUsuario = Number(nextId.rows[0].next_id);
    const ins = await client.query(
      `INSERT INTO usuario_v2 (id_usuario, descp_usuario, categoria, password, rol_id, categoria_id, ente_id, password_hash, bloqueado)
       VALUES ($1, $2, 'DIOS', $3, 1, $4, $5, $6, false)
       RETURNING id_usuario`,
      [idUsuario, USERNAME, password, hector.rows[0]?.categoria_id ?? 1, enteId, hash],
    );
    console.log("creado id:", ins.rows[0].id_usuario);
  }

  const after = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.ente_id, e.codigo AS ente_codigo, u.bloqueado
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.descp_usuario ILIKE $1`,
    [USERNAME],
  );
  console.log("usuario:", after.rows[0]);
  console.log("password_set:", password);
  console.log("login_test:", await bcrypt.compare(password, hash));
  console.log("andres_dios_ok");
} finally {
  await client.end();
}
