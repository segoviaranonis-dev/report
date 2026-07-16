/**
 * Crea o actualiza CAJA_RIMEC · rol_id=1 (GERENTE) · categoria CAJA · ente RIMEC.
 * Único acceso: Report → Facturación Pronta Entrega.
 * Uso: node scripts/ensure_caja_rimec.mjs [password]
 */
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const password = process.argv[2] ?? "g_adm";
const USERNAME = "CAJA_RIMEC";
const CATEGORIA = "CAJA";

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

  let cat = await client.query(
    `SELECT id_categoria FROM usuario_categoria
     WHERE upper(trim(codigo)) = $1 LIMIT 1`,
    [CATEGORIA],
  );
  let categoriaId = cat.rows[0]?.id_categoria ?? null;

  if (!categoriaId) {
    const next = await client.query(
      `SELECT COALESCE(MAX(id_categoria), 0) + 1 AS n FROM usuario_categoria`,
    );
    const idCat = Number(next.rows[0].n);
    const maxNivel = await client.query(
      `SELECT COALESCE(MAX(nivel), 0) + 1 AS n FROM usuario_categoria`,
    );
    const nivel = Number(maxNivel.rows[0].n);
    const ins = await client.query(
      `INSERT INTO usuario_categoria (id_categoria, codigo, descripcion, activo, nivel)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id_categoria, nivel`,
      [
        idCat,
        CATEGORIA,
        "Caja RIMEC · solo Facturación Pronta Entrega en Report",
        nivel,
      ],
    );
    categoriaId = ins.rows[0].id_categoria;
    console.log("categoria CAJA creada:", ins.rows[0]);
  } else {
    console.log("categoria CAJA existente id:", categoriaId);
  }

  const hash = await bcrypt.hash(password, 10);

  const existing = await client.query(
    `SELECT id_usuario FROM usuario_v2 WHERE descp_usuario ILIKE $1 LIMIT 1`,
    [USERNAME],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE usuario_v2
       SET rol_id = 1, categoria = $1, categoria_id = $2, ente_id = $3, bloqueado = false,
           password_hash = $4, password = $5
       WHERE id_usuario = $6`,
      [CATEGORIA, categoriaId, enteId, hash, password, existing.rows[0].id_usuario],
    );
    console.log("actualizado id:", existing.rows[0].id_usuario);
  } else {
    const nextId = await client.query(
      `SELECT COALESCE(MAX(id_usuario), 0) + 1 AS next_id FROM usuario_v2`,
    );
    const idUsuario = Number(nextId.rows[0].next_id);
    const ins = await client.query(
      `INSERT INTO usuario_v2
         (id_usuario, descp_usuario, categoria, password, rol_id, categoria_id, ente_id, password_hash, bloqueado)
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, false)
       RETURNING id_usuario`,
      [idUsuario, USERNAME, CATEGORIA, password, categoriaId, enteId, hash],
    );
    console.log("creado id:", ins.rows[0].id_usuario);
  }

  const after = await client.query(
    `SELECT u.id_usuario, u.descp_usuario, u.rol_id, u.categoria, u.categoria_id,
            u.ente_id, e.codigo AS ente_codigo, u.bloqueado,
            (u.password_hash IS NOT NULL) AS has_hash
     FROM usuario_v2 u
     LEFT JOIN entes e ON e.id_ente = u.ente_id
     WHERE u.descp_usuario ILIKE $1`,
    [USERNAME],
  );
  console.log("usuario:", after.rows[0]);
  console.log("password_set:", password);
  console.log("home: /facturacion/pronta-entrega");
  console.log("caja_rimec_ok");
} finally {
  await client.end();
}
