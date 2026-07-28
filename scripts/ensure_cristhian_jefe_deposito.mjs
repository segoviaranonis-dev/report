/**
 * Crea/actualiza CRISTHIAN · misma autorización que EVERT:
 * rol_id=1 · categoria=JEFE_DEPOSITO · ente RIMEC
 * Hub: Depósito RIMEC + Logística OK (Confirmadas / Entregas / Exitosas)
 * Uso: node scripts/ensure_cristhian_jefe_deposito.mjs [password]
 */
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const password = process.argv[2] ?? "1701";
const USERNAME = "CRISTHIAN";
const CATEGORIA = "JEFE_DEPOSITO";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const evert = await client.query(
    `SELECT id_usuario, rol_id, categoria, categoria_id, ente_id, funcionario_id
     FROM usuario_v2 WHERE descp_usuario ILIKE 'EVERT' LIMIT 1`,
  );
  if (!evert.rows[0]) throw new Error("EVERT no encontrado — crear EVERT primero");
  const plantilla = evert.rows[0];

  const ente = await client.query(
    `SELECT id_ente FROM entes WHERE codigo = 1 ORDER BY id_ente LIMIT 1`,
  );
  const enteId = plantilla.ente_id ?? ente.rows[0]?.id_ente;
  if (!enteId) throw new Error("ente RIMEC no encontrado");

  let categoriaId = plantilla.categoria_id;
  const catRow = await client.query(
    `SELECT id_categoria FROM usuario_categoria
     WHERE upper(trim(codigo)) = $1 LIMIT 1`,
    [CATEGORIA],
  );
  if (catRow.rows[0]) categoriaId = catRow.rows[0].id_categoria;
  if (!categoriaId) {
    // fallback: insertar codigo si la tabla lo permite
    try {
      const insCat = await client.query(
        `INSERT INTO usuario_categoria (codigo, descp_categoria)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING id_categoria`,
        [CATEGORIA, "Jefe depósito RIMEC"],
      );
      categoriaId = insCat.rows[0]?.id_categoria ?? null;
      if (!categoriaId) {
        const again = await client.query(
          `SELECT id_categoria FROM usuario_categoria WHERE upper(trim(codigo)) = $1 LIMIT 1`,
          [CATEGORIA],
        );
        categoriaId = again.rows[0]?.id_categoria ?? null;
      }
    } catch {
      /* usa categoria_id de EVERT */
      categoriaId = plantilla.categoria_id;
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const legacyPwd = `__hash_${Date.now()}__`;

  const existing = await client.query(
    `SELECT id_usuario FROM usuario_v2 WHERE descp_usuario ILIKE $1 LIMIT 1`,
    [USERNAME],
  );

  let row;
  if (existing.rows[0]) {
    const up = await client.query(
      `UPDATE usuario_v2
       SET rol_id = 1,
           categoria = $1,
           categoria_id = $2,
           ente_id = $3,
           bloqueado = false,
           password_hash = $4,
           password = $5
       WHERE id_usuario = $6
       RETURNING id_usuario, descp_usuario, rol_id, categoria, ente_id`,
      [CATEGORIA, categoriaId, enteId, hash, legacyPwd, existing.rows[0].id_usuario],
    );
    row = up.rows[0];
    console.log("actualizado:", row);
  } else {
    const nextId = await client.query(
      `SELECT COALESCE(MAX(id_usuario), 0) + 1 AS n FROM usuario_v2`,
    );
    const idUsuario = Number(nextId.rows[0].n);
    const ins = await client.query(
      `INSERT INTO usuario_v2
         (id_usuario, descp_usuario, categoria, password, rol_id, categoria_id, ente_id,
          password_hash, bloqueado)
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, false)
       RETURNING id_usuario, descp_usuario, rol_id, categoria, ente_id`,
      [idUsuario, USERNAME, CATEGORIA, legacyPwd, categoriaId, enteId, hash],
    );
    row = ins.rows[0];
    console.log("creado:", row);
  }

  const check = await bcrypt.compare(password, hash);
  console.log(
    JSON.stringify(
      {
        ok: true,
        usuario: row.descp_usuario,
        password_ok: check,
        rol_id: row.rol_id,
        categoria: row.categoria,
        igual_que: "EVERT",
        hub: ["Depósito RIMEC", "Logística OK"],
        pestañas_logistica: ["confirmadas", "entregas", "exitosas"],
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
