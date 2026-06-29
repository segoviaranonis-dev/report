import {
  generateTemporaryPassword,
  hashPassword,
  legacyPasswordPlaceholder,
} from "@/lib/auth/password";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { validarTriada } from "@/lib/usuarios-admin/leyes";
import type { FuncionarioExcelRow } from "@/lib/usuarios-admin/import-funcionarios";
import {
  buildImportPreview,
  limpiarCi,
  mapExcelRowToCreateInput,
  type ImportBatchResult,
} from "@/lib/usuarios-admin/import-funcionarios";

export type RolAccesoRow = {
  id: number;
  nombre_rol: string;
  descripcion: string | null;
  nivel: number;
};

export type EnteRow = {
  id_ente: number;
  codigo: number;
  nombre: string;
  tipo: "empresa" | "tienda";
  cliente_id: number | null;
  parent_id_ente: number | null;
  activo: boolean;
  es_principal: boolean;
};

export type UsuarioCategoriaRow = {
  id_categoria: number;
  nivel: number;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
};

export type FuncionarioRow = {
  id_funcionario: number;
  ente_id: number;
  id_cliente: number | null;
  cliente_descp: string | null;
  nombre_completo: string;
  ci: string;
  cargo: string | null;
  activo: boolean;
};

export type UsuarioAdminRow = {
  id_usuario: number;
  descp_usuario: string;
  email: string | null;
  categoria: string;
  categoria_id: number | null;
  categoria_nivel: number | null;
  rol_id: number;
  rol_nivel: number | null;
  nombre_rol: string | null;
  ente_id: number | null;
  ente_codigo: number | null;
  ente_nombre: string | null;
  ente_cliente_id: number | null;
  ente_parent_id: number | null;
  funcionario_id: number | null;
  funcionario_nombre: string | null;
  es_externo: boolean;
  bloqueado: boolean;
};

export type UsuariosAdminSnapshot = {
  usuarios: UsuarioAdminRow[];
  roles: RolAccesoRow[];
  entes: EnteRow[];
  categorias: UsuarioCategoriaRow[];
  funcionarios: FuncionarioRow[];
  categoriasTableMissing: boolean;
  triadaMigrationMissing: boolean;
};

async function tableExists(name: string): Promise<boolean> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ reg: string | null }>(
    `SELECT to_regclass($1) AS reg`,
    [`public.${name}`],
  );
  return rows[0]?.reg != null;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS ok
    `,
    [table, column],
  );
  return Boolean(rows[0]?.ok);
}

export async function loadUsuariosAdminSnapshot(): Promise<UsuariosAdminSnapshot> {
  if (!isRimecDatabaseConfigured()) {
    return {
      usuarios: [],
      roles: [],
      entes: [],
      categorias: [],
      funcionarios: [],
      categoriasTableMissing: false,
      triadaMigrationMissing: false,
    };
  }

  const pool = getRimecPool();
  const categoriasOk = await tableExists("usuario_categoria");
  const entesOk = await tableExists("entes");
  const enteColOk = entesOk && (await columnExists("entes", "cliente_id"));
  const parentColOk = entesOk && (await columnExists("entes", "parent_id_ente"));
  const usuarioEnteOk = entesOk && (await columnExists("usuario_v2", "ente_id"));
  const triadaOk = await columnExists("usuario_v2", "categoria_id");
  const rolNivelOk = await columnExists("maestro_rol_acceso", "nivel");
  const catNivelOk = await columnExists("usuario_categoria", "nivel");

  const rolesRes = await pool.query<RolAccesoRow>(
    rolNivelOk
      ? `SELECT id, nombre_rol, descripcion, nivel FROM maestro_rol_acceso ORDER BY nivel, id`
      : `SELECT id, nombre_rol, descripcion, id AS nivel FROM maestro_rol_acceso ORDER BY id`,
  );

  const entesRes = entesOk
    ? await pool.query<EnteRow>(`
    SELECT id_ente, codigo, nombre, tipo,
           ${enteColOk ? "cliente_id" : "NULL::integer AS cliente_id"},
           ${parentColOk ? "parent_id_ente" : "NULL::integer AS parent_id_ente"},
           activo
    FROM entes
    WHERE activo = true
    ORDER BY codigo
  `)
    : { rows: [] as EnteRow[] };

  let categorias: UsuarioCategoriaRow[] = [];
  if (categoriasOk) {
    const catRes = await pool.query<UsuarioCategoriaRow>(
      catNivelOk
        ? `SELECT id_categoria, nivel, codigo, descripcion, activo
           FROM usuario_categoria ORDER BY nivel`
        : `SELECT id_categoria, rol_id AS nivel, codigo, descripcion, activo
           FROM usuario_categoria ORDER BY codigo`,
    );
    categorias = catRes.rows;
  }

  let funcionarios: FuncionarioRow[] = [];
  if (await tableExists("funcionarios")) {
    const clienteColOk = await columnExists("funcionarios", "id_cliente");
    const fnRes = await pool.query<FuncionarioRow>(
      clienteColOk
        ? `
      SELECT f.id_funcionario, f.ente_id, f.id_cliente, cv.descp_cliente AS cliente_descp,
             f.nombre_completo, f.ci, f.cargo, f.activo
      FROM funcionarios f
      LEFT JOIN cliente_v2 cv ON cv.id_cliente = f.id_cliente
      WHERE f.activo = true
      ORDER BY f.nombre_completo
      LIMIT 500
    `
        : `
      SELECT f.id_funcionario, f.ente_id, NULL::bigint AS id_cliente, NULL::text AS cliente_descp,
             f.nombre_completo, f.ci, f.cargo, f.activo
      FROM funcionarios f
      WHERE f.activo = true
      ORDER BY f.nombre_completo
      LIMIT 500
    `,
    );
    funcionarios = fnRes.rows;
  }

  const usuariosRes = await pool.query<UsuarioAdminRow>(
    usuarioEnteOk && triadaOk
      ? `
    SELECT u.id_usuario, u.descp_usuario, u.email, u.categoria, u.categoria_id,
           c.nivel AS categoria_nivel,
           u.rol_id, r.nivel AS rol_nivel, r.nombre_rol,
           u.ente_id, e.codigo AS ente_codigo, e.nombre AS ente_nombre,
           e.cliente_id AS ente_cliente_id,
           ${parentColOk ? "e.parent_id_ente AS ente_parent_id" : "NULL::integer AS ente_parent_id"},
           u.funcionario_id, f.nombre_completo AS funcionario_nombre,
           COALESCE(u.es_externo, false) AS es_externo,
           COALESCE(u.bloqueado, false) AS bloqueado
    FROM usuario_v2 u
    LEFT JOIN maestro_rol_acceso r ON r.id = u.rol_id
    LEFT JOIN usuario_categoria c ON c.id_categoria = u.categoria_id
    LEFT JOIN entes e ON e.id_ente = u.ente_id
    LEFT JOIN funcionarios f ON f.id_funcionario = u.funcionario_id
    ORDER BY e.codigo NULLS LAST, r.nivel NULLS LAST, c.nivel NULLS LAST, u.descp_usuario
  `
      : usuarioEnteOk
        ? `
    SELECT u.id_usuario, u.descp_usuario, NULL::text AS email, u.categoria, NULL::integer AS categoria_id,
           NULL::integer AS categoria_nivel,
           u.rol_id, NULL::integer AS rol_nivel, r.nombre_rol,
           u.ente_id, e.codigo AS ente_codigo, e.nombre AS ente_nombre,
           e.cliente_id AS ente_cliente_id,
           NULL::integer AS ente_parent_id,
           NULL::integer AS funcionario_id, NULL::text AS funcionario_nombre,
           false AS es_externo,
           COALESCE(u.bloqueado, false) AS bloqueado
    FROM usuario_v2 u
    LEFT JOIN maestro_rol_acceso r ON r.id = u.rol_id
    LEFT JOIN entes e ON e.id_ente = u.ente_id
    ORDER BY e.codigo NULLS LAST, u.descp_usuario
  `
        : `
    SELECT u.id_usuario, u.descp_usuario, NULL::text AS email, u.categoria, NULL::integer AS categoria_id,
           NULL::integer AS categoria_nivel,
           u.rol_id, NULL::integer AS rol_nivel, r.nombre_rol,
           NULL::integer AS ente_id, NULL::integer AS ente_codigo,
           NULL::text AS ente_nombre, NULL::integer AS ente_cliente_id,
           NULL::integer AS ente_parent_id,
           NULL::integer AS funcionario_id, NULL::text AS funcionario_nombre,
           false AS es_externo,
           COALESCE(u.bloqueado, false) AS bloqueado
    FROM usuario_v2 u
    LEFT JOIN maestro_rol_acceso r ON r.id = u.rol_id
    ORDER BY u.descp_usuario
  `,
  );

  return {
    usuarios: usuariosRes.rows.map((u) => ({
      ...u,
      email: u.email ? String(u.email) : null,
      es_externo: Boolean(u.es_externo),
      bloqueado: Boolean(u.bloqueado),
    })),
    roles: rolesRes.rows.map((r) => ({ ...r, nivel: Number(r.nivel) || r.id })),
    entes: entesRes.rows.map((e) => ({
      ...e,
      tipo: e.tipo === "tienda" ? "tienda" : "empresa",
      cliente_id: e.cliente_id != null ? Number(e.cliente_id) : null,
      parent_id_ente: e.parent_id_ente != null ? Number(e.parent_id_ente) : null,
      es_principal: e.cliente_id == null,
    })),
    categorias,
    funcionarios,
    categoriasTableMissing: !categoriasOk,
    triadaMigrationMissing: !triadaOk || !entesOk,
  };
}

export type UpdateUsuarioInput = {
  idUsuario: number;
  descpUsuario?: string;
  password?: string;
  email?: string | null;
  bloqueado?: boolean;
  rolId: number;
  categoriaId: number;
  enteId: number;
  esExterno?: boolean;
};

export type UpdateUsuarioResult = {
  password_plain?: string;
};

async function validarTriadaUsuario(input: {
  rolId: number;
  categoriaId: number;
  enteId: number;
}): Promise<{ catCodigo: string }> {
  const pool = getRimecPool();
  const { rolId, categoriaId, enteId } = input;

  const rolRow = await pool.query<{ nivel: number }>(
    `SELECT nivel FROM maestro_rol_acceso WHERE id = $1`,
    [rolId],
  );
  if (rolRow.rowCount === 0) throw new Error("rol_id inválido");
  const rolNivel = Number(rolRow.rows[0].nivel);

  const catRow = await pool.query<{ nivel: number; codigo: string }>(
    `SELECT nivel, codigo FROM usuario_categoria WHERE id_categoria = $1 AND activo = true`,
    [categoriaId],
  );
  if (catRow.rowCount === 0) throw new Error("categoria_id inválido");
  const catNivel = Number(catRow.rows[0].nivel);
  const catCodigo = catRow.rows[0].codigo;

  const enteCheck = await pool.query<{ codigo: number; cliente_id: number | null }>(
    `SELECT codigo, cliente_id FROM entes WHERE id_ente = $1 AND activo = true`,
    [enteId],
  );
  if (enteCheck.rowCount === 0) throw new Error("ente_id inválido");
  if (enteCheck.rows[0].cliente_id != null) {
    throw new Error("Ente debe ser principal (RIMEC/tienda). Punto cliente va en RRHH, no en usuario.");
  }

  const ley = validarTriada({
    enteCodigo: Number(enteCheck.rows[0].codigo),
    rolNivel,
    categoriaNivel: catNivel,
  });
  if (ley) throw new Error(ley);

  return { catCodigo };
}

/** Edición completa usuario_v2 — identidad + jerarquía + password_hash opcional. */
export async function updateUsuario(input: UpdateUsuarioInput): Promise<UpdateUsuarioResult> {
  const pool = getRimecPool();
  const {
    idUsuario,
    descpUsuario,
    password,
    email,
    bloqueado,
    rolId,
    categoriaId,
    enteId,
    esExterno,
  } = input;

  const hasTriada = await columnExists("usuario_v2", "categoria_id");
  if (!hasTriada) throw new Error("Migración 130 pendiente — categoria_id");

  const exists = await pool.query(`SELECT 1 FROM usuario_v2 WHERE id_usuario = $1`, [idUsuario]);
  if (exists.rowCount === 0) throw new Error("Usuario no encontrado");

  const { catCodigo } = await validarTriadaUsuario({ rolId, categoriaId, enteId });

  let passwordPlain: string | undefined;
  let passwordHash: string | undefined;
  if (password != null && String(password).trim().length >= 4) {
    passwordPlain = String(password).trim();
    passwordHash = await hashPassword(passwordPlain);
  }

  if (descpUsuario != null && descpUsuario.trim()) {
    const descp = descpUsuario.trim();
    const dup = await pool.query(
      `SELECT 1 FROM usuario_v2 WHERE LOWER(TRIM(descp_usuario)) = LOWER(TRIM($1)) AND id_usuario <> $2`,
      [descp, idUsuario],
    );
    if (dup.rowCount && dup.rowCount > 0) {
      throw new Error(`Usuario '${descp}' ya existe`);
    }
  }

  const sets = [
    "rol_id = $1",
    "categoria_id = $2",
    "categoria = $3",
    "ente_id = $4",
    "es_externo = $5",
  ];
  const vals: unknown[] = [rolId, categoriaId, catCodigo, enteId, Boolean(esExterno)];
  let i = 6;

  if (descpUsuario != null && descpUsuario.trim()) {
    sets.push(`descp_usuario = $${i++}`);
    vals.push(descpUsuario.trim());
  }
  if (email !== undefined) {
    sets.push(`email = $${i++}`);
    vals.push(email?.trim() || null);
  }
  if (bloqueado !== undefined) {
    sets.push(`bloqueado = $${i++}`);
    vals.push(Boolean(bloqueado));
  }
  if (passwordHash) {
    sets.push(`password_hash = $${i++}`);
    vals.push(passwordHash);
    sets.push(`password = $${i++}`);
    vals.push(legacyPasswordPlaceholder());
  }

  vals.push(idUsuario);
  await pool.query(
    `UPDATE usuario_v2 SET ${sets.join(", ")} WHERE id_usuario = $${i}`,
    vals,
  );

  return passwordPlain ? { password_plain: passwordPlain } : {};
}

export async function updateUsuarioAcceso(input: {
  idUsuario: number;
  rolId: number;
  categoriaId: number;
  enteId: number;
  esExterno?: boolean;
}): Promise<void> {
  const pool = getRimecPool();
  const { idUsuario, rolId, categoriaId, enteId, esExterno } = input;

  const rolRow = await pool.query<{ nivel: number }>(
    `SELECT nivel FROM maestro_rol_acceso WHERE id = $1`,
    [rolId],
  );
  if (rolRow.rowCount === 0) throw new Error("rol_id inválido");
  const rolNivel = Number(rolRow.rows[0].nivel);

  const catRow = await pool.query<{ nivel: number; codigo: string }>(
    `SELECT nivel, codigo FROM usuario_categoria WHERE id_categoria = $1 AND activo = true`,
    [categoriaId],
  );
  if (catRow.rowCount === 0) throw new Error("categoria_id inválido");
  const catNivel = Number(catRow.rows[0].nivel);
  const catCodigo = catRow.rows[0].codigo;

  const enteCheck = await pool.query<{ codigo: number; cliente_id: number | null }>(
    `SELECT codigo, cliente_id FROM entes WHERE id_ente = $1 AND activo = true`,
    [enteId],
  );
  if (enteCheck.rowCount === 0) throw new Error("ente_id inválido");
  if (enteCheck.rows[0].cliente_id != null) {
    throw new Error(
      "Ente debe ser principal (RIMEC/tienda). El codigo cliente (2100, 2400…) se asigna en RRHH → funcionarios.punto_ente_id",
    );
  }
  const enteCodigo = Number(enteCheck.rows[0].codigo);

  const ley = validarTriada({
    enteCodigo,
    rolNivel,
    categoriaNivel: catNivel,
  });
  if (ley) throw new Error(ley);

  const hasTriada = await columnExists("usuario_v2", "categoria_id");
  if (!hasTriada) throw new Error("Migración 130 pendiente — python scripts/aplicar_migracion_130.py");

  const hasEnteCol = await columnExists("usuario_v2", "ente_id");
  if (!hasEnteCol) throw new Error("Migración 129 pendiente — ente_id");

  await pool.query(
    `
    UPDATE usuario_v2 SET
      rol_id = $1,
      categoria_id = $2,
      categoria = $3,
      ente_id = $4,
      es_externo = $5
    WHERE id_usuario = $6
    `,
    [rolId, categoriaId, catCodigo, enteId, Boolean(esExterno), idUsuario],
  );
}

export type CreateUsuarioInput = {
  descpUsuario: string;
  password?: string;
  rolId: number;
  categoriaId: number;
  enteId: number;
  esExterno?: boolean;
  email?: string | null;
  idUsuario?: number | null;
};

export type CreateUsuarioResult = {
  id_usuario: number;
  descp_usuario: string;
  password_plain: string;
};

async function getNextUsuarioId(): Promise<number> {
  const pool = getRimecPool();
  const res = await pool.query<{ next: string }>(
    `SELECT COALESCE(MAX(id_usuario), 0) + 1 AS next FROM usuario_v2`,
  );
  return Number(res.rows[0]?.next ?? 1);
}

export async function createUsuario(input: CreateUsuarioInput): Promise<CreateUsuarioResult> {
  const pool = getRimecPool();
  const descp = input.descpUsuario.trim();
  if (!descp) throw new Error("descp_usuario requerido");

  const dup = await pool.query(
    `SELECT 1 FROM usuario_v2 WHERE LOWER(TRIM(descp_usuario)) = LOWER(TRIM($1)) LIMIT 1`,
    [descp],
  );
  if (dup.rowCount && dup.rowCount > 0) {
    throw new Error(`Usuario '${descp}' ya existe`);
  }

  const passwordPlain = (input.password ?? "").trim() || generateTemporaryPassword(10);
  const passwordHash = await hashPassword(passwordPlain);
  const passwordLegacy = legacyPasswordPlaceholder();

  const rolRow = await pool.query<{ nivel: number }>(
    `SELECT nivel FROM maestro_rol_acceso WHERE id = $1`,
    [input.rolId],
  );
  if (rolRow.rowCount === 0) throw new Error("rol_id inválido");
  const rolNivel = Number(rolRow.rows[0].nivel);

  const catRow = await pool.query<{ nivel: number; codigo: string }>(
    `SELECT nivel, codigo FROM usuario_categoria WHERE id_categoria = $1 AND activo = true`,
    [input.categoriaId],
  );
  if (catRow.rowCount === 0) throw new Error("categoria_id inválido");
  const catNivel = Number(catRow.rows[0].nivel);
  const catCodigo = catRow.rows[0].codigo;

  const enteCheck = await pool.query<{ codigo: number; cliente_id: number | null }>(
    `SELECT codigo, cliente_id FROM entes WHERE id_ente = $1 AND activo = true`,
    [input.enteId],
  );
  if (enteCheck.rowCount === 0) throw new Error("ente_id inválido");
  if (enteCheck.rows[0].cliente_id != null) {
    throw new Error("Ente debe ser principal (RIMEC/tienda), no sub-ente cliente");
  }
  const enteCodigo = Number(enteCheck.rows[0].codigo);

  const ley = validarTriada({
    enteCodigo,
    rolNivel,
    categoriaNivel: catNivel,
  });
  if (ley) throw new Error(ley);

  const hasTriada = await columnExists("usuario_v2", "categoria_id");
  if (!hasTriada) throw new Error("Migración 130 pendiente — categoria_id");

  const hasEnteCol = await columnExists("usuario_v2", "ente_id");
  if (!hasEnteCol) throw new Error("Migración 129 pendiente — ente_id");

  const idUsuario = input.idUsuario ?? (await getNextUsuarioId());

  const idCheck = await pool.query(`SELECT 1 FROM usuario_v2 WHERE id_usuario = $1`, [idUsuario]);
  if (idCheck.rowCount && idCheck.rowCount > 0) {
    throw new Error(`id_usuario ${idUsuario} ya ocupado`);
  }

  await pool.query(
    `
    INSERT INTO usuario_v2 (
      id_usuario, descp_usuario, categoria, password, password_hash,
      rol_id, categoria_id, ente_id, funcionario_id, es_externo, email, bloqueado
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, NULL, $9, $10, false
    )
    `,
    [
      idUsuario,
      descp,
      catCodigo,
      passwordLegacy,
      passwordHash,
      input.rolId,
      input.categoriaId,
      input.enteId,
      Boolean(input.esExterno),
      input.email?.trim() || null,
    ],
  );

  return { id_usuario: idUsuario, descp_usuario: descp, password_plain: passwordPlain };
}

export async function previewImportFuncionariosExcel(
  rows: FuncionarioExcelRow[],
): Promise<ReturnType<typeof buildImportPreview>> {
  const pool = getRimecPool();
  const existentes = new Set<string>();
  const usuariosRes = await pool.query<{ descp_usuario: string }>(
    `SELECT descp_usuario FROM usuario_v2`,
  );
  for (const u of usuariosRes.rows) {
    existentes.add(u.descp_usuario.trim().toLowerCase());
  }

  return buildImportPreview(rows, existentes, new Map());
}

export async function importUsuariosFromFuncionariosExcel(
  rows: FuncionarioExcelRow[],
  options?: { passwordMode?: "ci" | "random"; dryRun?: boolean },
): Promise<ImportBatchResult> {
  const preview = await previewImportFuncionariosExcel(rows);
  const passwordMode = options?.passwordMode ?? "ci";
  const dryRun = Boolean(options?.dryRun);

  const items: ImportBatchResult["items"] = [];
  let insertados = 0;
  let omitidos = 0;
  let errores = 0;

  const rowByCi = new Map<string, FuncionarioExcelRow>();
  for (const row of rows) {
    const ci = limpiarCi(row["N.º CEDULA"]);
    if (ci) rowByCi.set(ci, row);
  }

  for (const p of preview) {
    if (p.accion !== "insert") {
      omitidos += 1;
      items.push({
        id_usuario: 0,
        descp_usuario: p.descp_usuario,
        password_plain: "",
        ci: p.ci,
        accion: "skip",
        detalle: p.detalle ?? p.accion,
      });
      continue;
    }

    if (dryRun) {
      insertados += 1;
      items.push({
        id_usuario: 0,
        descp_usuario: p.descp_usuario,
        password_plain: passwordMode === "ci" ? p.ci : "(auto)",
        ci: p.ci,
        accion: "insert",
        detalle: "dry-run",
      });
      continue;
    }

    try {
      const row = rowByCi.get(p.ci);
      if (!row) throw new Error("Fila Excel no encontrada");
      const password = passwordMode === "ci" ? p.ci : undefined;
      const input = mapExcelRowToCreateInput(row, p.descp_usuario, password ?? "");
      if (password) input.password = password;
      const created = await createUsuario(input);
      insertados += 1;
      items.push({ ...created, ci: p.ci, accion: "insert" });
    } catch (e) {
      errores += 1;
      items.push({
        id_usuario: 0,
        descp_usuario: p.descp_usuario,
        password_plain: "",
        ci: p.ci,
        accion: "skip",
        detalle: e instanceof Error ? e.message : "Error insert",
      });
    }
  }

  return { insertados, omitidos, errores, items };
}

export async function updateUsuarioCategoriaCatalogo(
  idCategoria: number,
  patch: { descripcion?: string | null; activo?: boolean },
): Promise<void> {
  const pool = getRimecPool();
  const hasCatTable = await tableExists("usuario_categoria");
  if (!hasCatTable) throw new Error("Tabla usuario_categoria no existe — migración 127");

  const sets: string[] = ["updated_at = now()"];
  const vals: unknown[] = [];
  let i = 1;

  if ("descripcion" in patch) {
    sets.push(`descripcion = $${i++}`);
    vals.push(patch.descripcion);
  }
  if ("activo" in patch) {
    sets.push(`activo = $${i++}`);
    vals.push(Boolean(patch.activo));
  }

  vals.push(idCategoria);
  await pool.query(
    `UPDATE usuario_categoria SET ${sets.join(", ")} WHERE id_categoria = $${i}`,
    vals,
  );
}
