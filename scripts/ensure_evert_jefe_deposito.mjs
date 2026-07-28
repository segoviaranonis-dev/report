/**
 * Crea/actualiza EVERT · JEFE_DEPOSITO · vinculado a funcionario
 * EVERT RUBEN GONZALEZ SERVIAN (JEFE DEPOSITO 1).
 * Solo módulos: /deposito-rimec · /stock-pronta-entrega
 * Uso: node scripts/ensure_evert_jefe_deposito.mjs [password]
 */
import fs from "fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const password = process.argv[2] ?? "2207";
const USERNAME = "EVERT";
const CATEGORIA = "JEFE_DEPOSITO";
const FUNCIONARIO_ID = 62; // EVERT RUBEN GONZALEZ SERVIAN

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
  const ente = await client.query(
    `SELECT id_ente FROM entes WHERE codigo = 1 ORDER BY id_ente LIMIT 1`,
  );
  const enteId = ente.rows[0]?.id_ente;
  if (!enteId) throw new Error("ente RIMEC no encontrado");

  const func = await client.query(
    `SELECT id_funcionario, nombre_completo, cargo, departamento, activo
     FROM funcionarios WHERE id_funcionario = $1`,
    [FUNCIONARIO_ID],
  );
  if (!func.rows[0]) throw new Error(`funcionario ${FUNCIONARIO_ID} no encontrado`);
  console.log("funcionario:", func.rows[0]);

  let cat = await client.query(
    `SELECT id_categoria FROM usuario_categoria WHERE upper(trim(codigo)) = $1 LIMIT 1`,
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
       RETURNING id_categoria, codigo`,
      [
        idCat,
        CATEGORIA,
        "Jefe Depósito RIMEC · solo hub Depósito + Stock PE (sin asignar descuentos)",
        nivel,
      ],
    );
    categoriaId = ins.rows[0].id_categoria;
    console.log("categoria creada:", ins.rows[0]);
  } else {
    console.log("categoria existente id:", categoriaId);
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
       SET rol_id = 1, categoria = $1, categoria_id = $2, ente_id = $3,
           funcionario_id = $4, bloqueado = false,
           password_hash = $5, password = $6
       WHERE id_usuario = $7
       RETURNING id_usuario, descp_usuario, rol_id, categoria, categoria_id,
                 ente_id, funcionario_id, bloqueado`,
      [
        CATEGORIA,
        categoriaId,
        enteId,
        FUNCIONARIO_ID,
        hash,
        legacyPwd,
        existing.rows[0].id_usuario,
      ],
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
         (id_usuario, descp_usuario, categoria, password, rol_id, categoria_id,
          ente_id, funcionario_id, password_hash, bloqueado)
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, false)
       RETURNING id_usuario, descp_usuario, rol_id, categoria, categoria_id,
                 ente_id, funcionario_id, bloqueado`,
      [
        idUsuario,
        USERNAME,
        CATEGORIA,
        legacyPwd,
        categoriaId,
        enteId,
        FUNCIONARIO_ID,
        hash,
      ],
    );
    row = ins.rows[0];
    console.log("creado:", row);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        usuario: row.descp_usuario,
        password_set: password,
        categoria: row.categoria,
        funcionario_id: row.funcionario_id,
        funcionario: func.rows[0].nombre_completo,
        cargo: func.rows[0].cargo,
        modulos: ["/deposito-rimec", "/stock-pronta-entrega"],
        asignacion_descuentos: "PROHIBIDO — solo DIOS",
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
