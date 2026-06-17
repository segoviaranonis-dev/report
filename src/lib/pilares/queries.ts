import type { Pool } from "pg";
import { proveedorIdFromTipoV2 } from "./constants";
import type {
  LineaReferenciaFilterOpts,
  LineaReferenciaRow,
  LineaRow,
  LineasResumen,
  LrCascadaItem,
  LineaReferenciaCascada,
  PilaresMaestras,
  TipoV2Id,
} from "./types";

/** Marcas válidas para un tipo_v2 vía `marca_tipo_v2`; fallback líneas del proveedor. */
export async function loadMarcasForTipoV2(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  proveedorId: number,
): Promise<{ id: number; label: string }[]> {
  try {
    const { rows } = await pool.query<{ id: number; label: string }>(
      `
      SELECT m.id_marca AS id, TRIM(m.descp_marca) AS label
      FROM marca_v2 m
      JOIN marca_tipo_v2 mt ON mt.id_marca = m.id_marca
      WHERE mt.id_tipo = $1
        AND m.descp_marca IS NOT NULL
        AND TRIM(m.descp_marca) <> ''
      ORDER BY TRIM(m.descp_marca)
      `,
      [tipoV2Id],
    );
    if (rows.length) return rows;
  } catch {
    /* marca_tipo_v2 ausente en BD local antigua */
  }

  const { rows } = await pool.query<{ id: number; label: string }>(
    `
    SELECT DISTINCT m.id_marca AS id, TRIM(m.descp_marca) AS label
    FROM linea l
    JOIN marca_v2 m ON m.id_marca = l.marca_id
    WHERE l.proveedor_id = $1 AND l.activo = true
      AND m.descp_marca IS NOT NULL AND TRIM(m.descp_marca) <> ''
    ORDER BY label
    `,
    [proveedorId],
  );
  return rows;
}

/** Autocompletado de código línea por prefijo (proveedor del tipo_v2). */
export async function searchLineaCodigos(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  prefix: string,
  limit = 12,
): Promise<string[]> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  const q = prefix.trim();
  if (proveedorId == null || !q) return [];

  const cap = Math.min(Math.max(limit, 1), 30);
  const { rows } = await pool.query<{ codigo: string }>(
    `
    SELECT DISTINCT l.codigo_proveedor::text AS codigo
    FROM linea l
    WHERE l.proveedor_id = $1
      AND l.activo = true
      AND l.codigo_proveedor::text LIKE $2
    ORDER BY l.codigo_proveedor::text
    LIMIT $3
    `,
    [proveedorId, `${q}%`, cap],
  );
  return rows.map((r) => r.codigo);
}

export async function loadPilaresMaestras(pool: Pool, tipoV2Id?: TipoV2Id): Promise<PilaresMaestras> {
  const proveedorId = tipoV2Id != null ? proveedorIdFromTipoV2(tipoV2Id) : null;

  const [marcas, generos, estilos, tipos1] = await Promise.all([
    proveedorId != null && tipoV2Id != null
      ? loadMarcasForTipoV2(pool, tipoV2Id, proveedorId)
      : pool
          .query<{ id: number; label: string }>(
            `SELECT id_marca AS id, TRIM(descp_marca) AS label FROM marca_v2 WHERE descp_marca IS NOT NULL ORDER BY descp_marca`,
          )
          .then((r) => r.rows),
    pool.query<{ id: number; label: string }>(
      `SELECT id, TRIM(descripcion) AS label FROM genero WHERE descripcion IS NOT NULL ORDER BY descripcion`,
    ),
    pool.query<{ id: number; label: string }>(
      `SELECT id_grupo_estilo AS id, TRIM(descp_grupo_estilo) AS label FROM grupo_estilo_v2 ORDER BY descp_grupo_estilo`,
    ),
    pool.query<{ id: number; label: string }>(
      `SELECT id_tipo_1 AS id, TRIM(descp_tipo_1) AS label FROM tipo_1 ORDER BY id_tipo_1`,
    ),
  ]);

  return {
    marcas,
    generos: generos.rows,
    estilos: estilos.rows,
    tipos1: tipos1.rows,
  };
}

export async function loadLineas(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  opts: { marca?: string | null; genero?: string | null; limit?: number; offset?: number } = {},
): Promise<{ rows: LineaRow[]; total: number }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { rows: [], total: 0 };

  const where = ["l.activo = true", "l.proveedor_id = $1"];
  const params: unknown[] = [proveedorId];

  if (opts.marca === "__null__") {
    where.push("l.marca_id IS NULL");
  } else if (opts.marca) {
    params.push(opts.marca);
    where.push(`mv.descp_marca = $${params.length}`);
  }
  if (opts.genero === "__null__") {
    where.push("l.genero_id IS NULL");
  } else if (opts.genero) {
    params.push(opts.genero);
    where.push(`g.descripcion = $${params.length}`);
  }

  const whereSql = where.join(" AND ");
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000);
  const offset = Math.max(opts.offset ?? 0, 0);

  const countRes = await pool.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM linea l
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    LEFT JOIN genero g ON g.id = l.genero_id
    WHERE ${whereSql}
    `,
    params,
  );

  params.push(limit, offset);
  const { rows } = await pool.query<LineaRow>(
    `
    SELECT
      l.id,
      l.codigo_proveedor::text AS codigo_proveedor,
      NULLIF(TRIM(l.descripcion), '') AS descripcion,
      l.marca_id,
      COALESCE(mv.descp_marca, '') AS marca,
      l.genero_id,
      COALESCE(g.descripcion, '') AS descp_genero
    FROM linea l
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    LEFT JOIN genero g ON g.id = l.genero_id
    WHERE ${whereSql}
    ORDER BY l.codigo_proveedor::text
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );

  return { rows, total: Number(countRes.rows[0]?.total ?? 0) };
}

/** Marcas y géneros distintos en `linea` del proveedor (paridad Streamlit get_valores_filtro_lineas). */
export async function loadLineasFiltros(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<{ marcas: string[]; generos: string[] }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { marcas: [], generos: [] };

  const [marcasRes, generosRes] = await Promise.all([
    pool.query<{ v: string }>(
      `
      SELECT DISTINCT TRIM(mv.descp_marca) AS v
      FROM linea l
      JOIN marca_v2 mv ON mv.id_marca = l.marca_id
      WHERE l.proveedor_id = $1 AND l.activo = true AND mv.descp_marca IS NOT NULL
      ORDER BY v
      `,
      [proveedorId],
    ),
    pool.query<{ v: string }>(
      `
      SELECT DISTINCT TRIM(g.descripcion) AS v
      FROM linea l
      JOIN genero g ON g.id = l.genero_id
      WHERE l.proveedor_id = $1 AND l.activo = true AND g.descripcion IS NOT NULL
      ORDER BY v
      `,
      [proveedorId],
    ),
  ]);

  return {
    marcas: marcasRes.rows.map((r) => r.v),
    generos: generosRes.rows.map((r) => r.v),
  };
}

export async function loadLineaReferenciaFiltros(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<{ marcas: string[] }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { marcas: [] };

  const { rows } = await pool.query<{ v: string }>(
    `
    SELECT DISTINCT TRIM(mv.descp_marca) AS v
    FROM linea l
    JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    WHERE l.proveedor_id = $1 AND l.activo = true AND mv.descp_marca IS NOT NULL
    ORDER BY v
    `,
    [proveedorId],
  );
  return { marcas: rows.map((r) => r.v) };
}

const LR_JOIN = `
FROM linea_referencia lr
JOIN linea l ON l.id = lr.linea_id
JOIN referencia r ON r.id = lr.referencia_id
JOIN proveedor_importacion pi ON pi.id = lr.proveedor_id
LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
`;

type LrExcludeDim = "marca" | "estilo" | "tipo1" | "linea";

function appendLrFilters(
  where: string[],
  params: unknown[],
  opts: LineaReferenciaFilterOpts,
  exclude?: LrExcludeDim,
) {
  if (exclude !== "linea" && opts.lineaCodigos?.length) {
    params.push(opts.lineaCodigos);
    where.push(`l.codigo_proveedor::text = ANY($${params.length}::text[])`);
  }
  if (exclude !== "marca") {
    if (opts.marca === "__null__") where.push("l.marca_id IS NULL");
    else if (opts.marca) {
      params.push(opts.marca);
      where.push(`mv.descp_marca = $${params.length}`);
    }
  }
  if (exclude !== "estilo") {
    if (opts.estiloNull) where.push("lr.grupo_estilo_id IS NULL");
    else if (opts.estiloId != null) {
      params.push(opts.estiloId);
      where.push(`lr.grupo_estilo_id = $${params.length}`);
    }
  }
  if (exclude !== "tipo1") {
    if (opts.tipo1Null) where.push("lr.tipo_1_id IS NULL");
    else if (opts.tipo1Id != null) {
      params.push(opts.tipo1Id);
      where.push(`lr.tipo_1_id = $${params.length}`);
    }
  }
}

function lrFilterOptsFromParams(opts: {
  marca?: string | null;
  estiloId?: number | null;
  tipo1Id?: number | null;
  estiloNull?: boolean;
  tipo1Null?: boolean;
  lineaCodigos?: string[] | null;
}): LineaReferenciaFilterOpts {
  return {
    marca: opts.marca ?? null,
    estiloId: opts.estiloId ?? null,
    tipo1Id: opts.tipo1Id ?? null,
    estiloNull: opts.estiloNull,
    tipo1Null: opts.tipo1Null,
    lineaCodigos: opts.lineaCodigos ?? null,
  };
}

export async function loadLineaReferenciaCascada(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  opts: LineaReferenciaFilterOpts,
): Promise<LineaReferenciaCascada> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { marcas: [], estilos: [], tipos1: [], lineas: [] };

  const queryDim = async (
    exclude: LrExcludeDim,
    selectSql: string,
  ): Promise<LrCascadaItem[]> => {
    const where = ["lr.proveedor_id = $1", "l.activo = true"];
    const params: unknown[] = [proveedorId];
    appendLrFilters(where, params, opts, exclude);
    const { rows } = await pool.query<{ key: string; label: string; count: string }>(
      `SELECT ${selectSql} ${LR_JOIN} WHERE ${where.join(" AND ")} GROUP BY 1, 2 ORDER BY COUNT(*) DESC, 2 LIMIT 50`,
      params,
    );
    return rows.map((r) => ({ key: r.key, label: r.label, count: Number(r.count) }));
  };

  const [marcas, estilos, tipos1, lineas] = await Promise.all([
    queryDim(
      "marca",
      `CASE WHEN l.marca_id IS NULL THEN '__null__' ELSE TRIM(mv.descp_marca) END AS key,
       COALESCE(NULLIF(TRIM(mv.descp_marca), ''), '— Sin marca —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "estilo",
      `CASE WHEN lr.grupo_estilo_id IS NULL THEN '__null__' ELSE lr.grupo_estilo_id::text END AS key,
       COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), NULLIF(TRIM(lr.descp_grupo_estilo), ''), '— Sin estilo —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "tipo1",
      `CASE WHEN lr.tipo_1_id IS NULL THEN '__null__' ELSE lr.tipo_1_id::text END AS key,
       COALESCE(NULLIF(TRIM(t1.descp_tipo_1), ''), NULLIF(TRIM(lr.descp_tipo_1), ''), '— Sin tipo —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "linea",
      `l.codigo_proveedor::text AS key,
       l.codigo_proveedor::text AS label,
       COUNT(*)::text AS count`,
    ),
  ]);

  return { marcas, estilos, tipos1, lineas };
}

const LINEA_BASE_WHERE = `l.proveedor_id = $1 AND l.activo = true`;

/** Contadores globales del proveedor — mismos criterios que filtros/grilla. */
export async function loadLineasResumen(pool: Pool, tipoV2Id: TipoV2Id): Promise<LineasResumen> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) {
    return {
      total: 0,
      sin_marca: 0,
      sin_genero: 0,
      marcas_distintas: 0,
      generos_distintos: 0,
      por_marca: [],
      por_genero: [],
      genero_por_marca: [],
    };
  }

  const [totals, porMarca, porGenero, generoPorMarca] = await Promise.all([
    pool.query<{ total: string; sin_marca: string; sin_genero: string }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE l.marca_id IS NULL)::text AS sin_marca,
        COUNT(*) FILTER (WHERE l.genero_id IS NULL)::text AS sin_genero
      FROM linea l
      WHERE ${LINEA_BASE_WHERE}
      `,
      [proveedorId],
    ),
    pool.query<{ marca: string; lineas: string }>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(mv.descp_marca), ''), '— Sin marca —') AS marca,
        COUNT(*)::text AS lineas
      FROM linea l
      LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
      WHERE ${LINEA_BASE_WHERE}
      GROUP BY mv.descp_marca
      ORDER BY COUNT(*) DESC, marca
      `,
      [proveedorId],
    ),
    pool.query<{ genero: string; lineas: string }>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(g.descripcion), ''), '— Sin género —') AS genero,
        COUNT(*)::text AS lineas
      FROM linea l
      LEFT JOIN genero g ON g.id = l.genero_id
      WHERE ${LINEA_BASE_WHERE}
      GROUP BY g.descripcion
      ORDER BY COUNT(*) DESC, genero
      `,
      [proveedorId],
    ),
    pool.query<{ marca: string; genero: string; lineas: string }>(
      `
      SELECT
        COALESCE(NULLIF(TRIM(mv.descp_marca), ''), '— Sin marca —') AS marca,
        COALESCE(NULLIF(TRIM(g.descripcion), ''), '— Sin género —') AS genero,
        COUNT(*)::text AS lineas
      FROM linea l
      LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
      LEFT JOIN genero g ON g.id = l.genero_id
      WHERE ${LINEA_BASE_WHERE}
      GROUP BY mv.descp_marca, g.descripcion
      ORDER BY marca, genero
      `,
      [proveedorId],
    ),
  ]);

  const t = totals.rows[0];
  const por_marca = porMarca.rows.map((r) => ({ marca: r.marca, lineas: Number(r.lineas) }));
  const por_genero = porGenero.rows.map((r) => ({ genero: r.genero, lineas: Number(r.lineas) }));

  return {
    total: Number(t?.total ?? 0),
    sin_marca: Number(t?.sin_marca ?? 0),
    sin_genero: Number(t?.sin_genero ?? 0),
    marcas_distintas: por_marca.filter((m) => m.marca !== "— Sin marca —").length,
    generos_distintos: por_genero.filter((g) => g.genero !== "— Sin género —").length,
    por_marca,
    por_genero,
    genero_por_marca: generoPorMarca.rows.map((r) => ({
      marca: r.marca,
      genero: r.genero,
      lineas: Number(r.lineas),
    })),
  };
}

export async function loadLineaReferencia(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  opts: {
    marca?: string | null;
    lineaCodigos?: string[] | null;
    estiloId?: number | null;
    tipo1Id?: number | null;
    estiloNull?: boolean;
    tipo1Null?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: LineaReferenciaRow[]; total: number }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { rows: [], total: 0 };

  const where = ["lr.proveedor_id = $1", "l.activo = true"];
  const params: unknown[] = [proveedorId];
  appendLrFilters(where, params, lrFilterOptsFromParams(opts));

  const whereSql = where.join(" AND ");
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const countRes = await pool.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM linea_referencia lr
    JOIN linea l ON l.id = lr.linea_id
    JOIN referencia r ON r.id = lr.referencia_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    WHERE ${whereSql}
    `,
    params,
  );

  params.push(limit, offset);
  const { rows } = await pool.query<LineaReferenciaRow>(
    `
    SELECT
      lr.id,
      lr.proveedor_id,
      pi.codigo::text AS proveedor_cod,
      l.id AS linea_id,
      l.codigo_proveedor::text AS linea_codigo,
      r.codigo_proveedor::text AS referencia_codigo,
      COALESCE(mv.descp_marca, '') AS marca,
      COALESCE(ge.descp_grupo_estilo, lr.descp_grupo_estilo, '') AS descp_grupo_estilo,
      COALESCE(t1.descp_tipo_1, lr.descp_tipo_1, '') AS descp_tipo_1,
      lr.grupo_estilo_id,
      lr.tipo_1_id
    FROM linea_referencia lr
    JOIN linea l ON l.id = lr.linea_id
    JOIN referencia r ON r.id = lr.referencia_id
    JOIN proveedor_importacion pi ON pi.id = lr.proveedor_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    WHERE ${whereSql}
    ORDER BY l.codigo_proveedor::text, r.codigo_proveedor::text
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );

  return { rows, total: Number(countRes.rows[0]?.total ?? 0) };
}

export async function patchLinea(
  pool: Pool,
  id: number,
  proveedorId: number,
  fields: { marca_id?: number | null; genero_id?: number | null },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [id, proveedorId];

  if ("marca_id" in fields) {
    params.push(fields.marca_id);
    sets.push(`marca_id = $${params.length}`);
  }
  if ("genero_id" in fields) {
    params.push(fields.genero_id);
    sets.push(`genero_id = $${params.length}`);
  }
  if (!sets.length) return false;

  const res = await pool.query(
    `UPDATE linea SET ${sets.join(", ")} WHERE id = $1 AND proveedor_id = $2 AND activo = true`,
    params,
  );
  return (res.rowCount ?? 0) > 0;
}

export async function patchLineaRangoGenero(
  pool: Pool,
  proveedorId: number,
  desde: string,
  hasta: string,
  generoId: number,
): Promise<number> {
  const res = await pool.query(
    `
    UPDATE linea
    SET genero_id = $4
    WHERE proveedor_id = $1
      AND activo = true
      AND codigo_proveedor::text >= $2
      AND codigo_proveedor::text <= $3
    `,
    [proveedorId, desde, hasta, generoId],
  );
  return res.rowCount ?? 0;
}

/** Edición por rango de código línea — estilo y/o tipo 1 en todas las filas L×R del proveedor. */
export async function patchLineaReferenciaRango(
  pool: Pool,
  proveedorId: number,
  desde: string,
  hasta: string,
  fields: { grupo_estilo_id?: number; tipo_1_id?: number },
): Promise<number> {
  const sets: string[] = [];
  const params: unknown[] = [proveedorId, desde, hasta];

  if (fields.grupo_estilo_id != null) {
    params.push(fields.grupo_estilo_id);
    sets.push(`grupo_estilo_id = $${params.length}`);
  }
  if (fields.tipo_1_id != null) {
    params.push(fields.tipo_1_id);
    sets.push(`tipo_1_id = $${params.length}`);
  }
  if (!sets.length) return 0;

  const res = await pool.query(
    `
    UPDATE linea_referencia lr
    SET ${sets.join(", ")}
    FROM linea l
    WHERE l.id = lr.linea_id
      AND lr.proveedor_id = $1
      AND l.proveedor_id = $1
      AND l.activo = true
      AND l.codigo_proveedor::text >= $2
      AND l.codigo_proveedor::text <= $3
    `,
    params,
  );
  return res.rowCount ?? 0;
}

function buildLrScopeWhere(
  proveedorId: number,
  opts: LineaReferenciaFilterOpts,
): { whereSql: string; params: unknown[] } {
  const where = ["lr.proveedor_id = $1", "l.activo = true"];
  const params: unknown[] = [proveedorId];
  appendLrFilters(where, params, opts);
  return { whereSql: where.join(" AND "), params };
}

export async function patchLineaGeneroByLineas(
  pool: Pool,
  proveedorId: number,
  codigos: string[],
  generoId: number,
): Promise<number> {
  if (!codigos.length) return 0;
  const res = await pool.query(
    `
    UPDATE linea
    SET genero_id = $3
    WHERE proveedor_id = $1
      AND activo = true
      AND codigo_proveedor::text = ANY($2::text[])
    `,
    [proveedorId, codigos, generoId],
  );
  return res.rowCount ?? 0;
}

export async function patchLineaGeneroByScope(
  pool: Pool,
  proveedorId: number,
  opts: LineaReferenciaFilterOpts,
  generoId: number,
): Promise<number> {
  const { whereSql, params } = buildLrScopeWhere(proveedorId, opts);
  params.push(generoId);
  const res = await pool.query(
    `
    UPDATE linea lo
    SET genero_id = $${params.length}
    WHERE lo.proveedor_id = $1
      AND lo.activo = true
      AND EXISTS (
        SELECT 1
        FROM linea_referencia lr
        JOIN linea l ON l.id = lr.linea_id
        LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
        WHERE l.id = lo.id AND ${whereSql}
      )
    `,
    params,
  );
  return res.rowCount ?? 0;
}

export async function patchLineaReferenciaByLineas(
  pool: Pool,
  proveedorId: number,
  codigos: string[],
  fields: { grupo_estilo_id?: number; tipo_1_id?: number },
): Promise<number> {
  if (!codigos.length) return 0;
  const sets: string[] = [];
  const params: unknown[] = [proveedorId, codigos];

  if (fields.grupo_estilo_id != null) {
    params.push(fields.grupo_estilo_id);
    sets.push(`grupo_estilo_id = $${params.length}`);
  }
  if (fields.tipo_1_id != null) {
    params.push(fields.tipo_1_id);
    sets.push(`tipo_1_id = $${params.length}`);
  }
  if (!sets.length) return 0;

  const res = await pool.query(
    `
    UPDATE linea_referencia lr
    SET ${sets.join(", ")}
    FROM linea l
    WHERE l.id = lr.linea_id
      AND lr.proveedor_id = $1
      AND l.proveedor_id = $1
      AND l.activo = true
      AND l.codigo_proveedor::text = ANY($2::text[])
    `,
    params,
  );
  return res.rowCount ?? 0;
}

export async function patchLineaReferenciaByScope(
  pool: Pool,
  proveedorId: number,
  opts: LineaReferenciaFilterOpts,
  fields: { grupo_estilo_id?: number; tipo_1_id?: number },
): Promise<number> {
  const sets: string[] = [];
  const { whereSql, params } = buildLrScopeWhere(proveedorId, opts);

  if (fields.grupo_estilo_id != null) {
    params.push(fields.grupo_estilo_id);
    sets.push(`lr.grupo_estilo_id = $${params.length}`);
  }
  if (fields.tipo_1_id != null) {
    params.push(fields.tipo_1_id);
    sets.push(`lr.tipo_1_id = $${params.length}`);
  }
  if (!sets.length) return 0;

  const res = await pool.query(
    `
    UPDATE linea_referencia lr
    SET ${sets.join(", ")}
    FROM linea l
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    WHERE l.id = lr.linea_id AND ${whereSql}
    `,
    params,
  );
  return res.rowCount ?? 0;
}

export async function patchLineaReferencia(
  pool: Pool,
  id: number,
  proveedorId: number,
  fields: { grupo_estilo_id?: number | null; tipo_1_id?: number | null },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [id, proveedorId];

  if ("grupo_estilo_id" in fields) {
    params.push(fields.grupo_estilo_id);
    sets.push(`grupo_estilo_id = $${params.length}`);
  }
  if ("tipo_1_id" in fields) {
    params.push(fields.tipo_1_id);
    sets.push(`tipo_1_id = $${params.length}`);
  }
  if (!sets.length) return false;

  const res = await pool.query(
    `UPDATE linea_referencia SET ${sets.join(", ")} WHERE id = $1 AND proveedor_id = $2`,
    params,
  );
  return (res.rowCount ?? 0) > 0;
}
