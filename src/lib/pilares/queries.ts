import type { Pool } from "pg";
import { proveedorIdFromTipoV2 } from "./constants";
import type {
  LineaReferenciaFilterOpts,
  LineaReferenciaRow,
  LineaReferenciaThumb,
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

/** Primera fila retail (con imagen priorizada) por par linea_codigo + referencia_codigo. */
export async function loadPrimeraImagenLineaReferencia(
  pool: Pool,
  pairs: { linea_codigo: string; referencia_codigo: string }[],
  tipoV2Id?: TipoV2Id,
): Promise<Map<string, LineaReferenciaThumb>> {
  const out = new Map<string, LineaReferenciaThumb>();
  if (!pairs.length) return out;

  const lineas = pairs.map((p) => p.linea_codigo);
  const refs = pairs.map((p) => p.referencia_codigo);

  const { rows } = await pool.query<{
    linea_codigo: string;
    referencia_codigo: string;
    imagen_nombre: string | null;
    material_code: string;
    color_code: string;
  }>(
    `
    WITH pairs AS (
      SELECT u.l AS linea_codigo, u.r AS referencia_codigo
      FROM unnest($1::text[], $2::text[]) AS u(l, r)
    )
    SELECT DISTINCT ON (p.linea_codigo, p.referencia_codigo)
      p.linea_codigo,
      p.referencia_codigo,
      NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
      COALESCE(
        NULLIF(btrim(s.excel_material_code::text), ''),
        CASE
          WHEN mat.id IS NULL THEN NULL
          WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
          ELSE trim(mat.codigo_proveedor::text)
        END,
        ''
      ) AS material_code,
      COALESCE(
        NULLIF(btrim(s.excel_color_code::text), ''),
        CASE
          WHEN col.id IS NULL THEN NULL
          WHEN col.codigo_proveedor = -999001::bigint THEN NULL
          ELSE trim(col.codigo_proveedor::text)
        END,
        ''
      ) AS color_code
    FROM pairs p
    INNER JOIN public.registro_st_vt_rc_reposicion s
      ON btrim(s.linea_codigo_proveedor::text) = p.linea_codigo
      AND btrim(s.referencia_codigo_proveedor::text) = p.referencia_codigo
    LEFT JOIN public.material mat ON mat.id = s.material_id
    LEFT JOIN public.color col ON col.id = s.color_id
    WHERE ($3::int IS NULL OR s.tipo_v2_id = $3)
    ORDER BY
      p.linea_codigo,
      p.referencia_codigo,
      (CASE WHEN NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL THEN 0 ELSE 1 END),
      s.id
    `,
    [lineas, refs, tipoV2Id ?? null],
  );

  for (const r of rows) {
    out.set(`${r.linea_codigo}\0${r.referencia_codigo}`, {
      imagen_nombre: r.imagen_nombre,
      material_code: r.material_code ?? "",
      color_code: r.color_code ?? "",
    });
  }
  return out;
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

/** Garantiza columna tono_canon (única verdad filtro) — idempotente. */
export async function ensureTonoCanonColumn(pool: Pool): Promise<void> {
  await pool.query(`ALTER TABLE public.color ADD COLUMN IF NOT EXISTS tono_canon jsonb`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_color_tono_etiqueta
    ON public.color ((lower(btrim(tono_canon->>'etiqueta'))))
    WHERE tono_canon IS NOT NULL AND btrim(tono_canon->>'etiqueta') <> ''
  `);
}

export async function loadColoresResumen(pool: Pool, proveedorId: number): Promise<import("./types").ColoresResumen> {
  const [totRes, etiqRes] = await Promise.all([
    pool.query<{ total: string; sin_tono: string; con_tono: string }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE tono_canon IS NULL)::text AS sin_tono,
        COUNT(*) FILTER (WHERE tono_canon IS NOT NULL)::text AS con_tono
      FROM color c
      WHERE c.proveedor_id = $1 AND c.activo = true
      `,
      [proveedorId],
    ),
    pool.query<{ etiqueta: string; n: string }>(
      `
      SELECT btrim(tono_canon->>'etiqueta') AS etiqueta, COUNT(*)::text AS n
      FROM color c
      WHERE c.proveedor_id = $1 AND c.activo = true
        AND tono_canon IS NOT NULL
        AND btrim(tono_canon->>'etiqueta') <> ''
      GROUP BY 1
      ORDER BY COUNT(*) DESC, 1
      LIMIT 40
      `,
      [proveedorId],
    ),
  ]);
  const t = totRes.rows[0];
  return {
    total: Number(t?.total ?? 0),
    sin_tono: Number(t?.sin_tono ?? 0),
    con_tono: Number(t?.con_tono ?? 0),
    por_etiqueta: etiqRes.rows.map((r) => ({ etiqueta: r.etiqueta, count: Number(r.n) })),
  };
}

export async function loadColores(
  pool: Pool,
  proveedorId: number,
  opts: { q?: string | null; sinTono?: boolean; limit?: number; offset?: number },
): Promise<{ rows: import("./types").ColorRow[]; total: number }> {
  const where: string[] = ["c.proveedor_id = $1", "c.activo = true"];
  const params: unknown[] = [proveedorId];

  if (opts.sinTono) {
    where.push("c.tono_canon IS NULL");
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    const i = params.length;
    where.push(
      `(c.nombre ILIKE $${i} OR c.tono_canon->>'etiqueta' ILIKE $${i} OR c.codigo_proveedor::text ILIKE $${i})`,
    );
  }

  const whereSql = where.join(" AND ");
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [listRes, countRes] = await Promise.all([
    pool.query<{
      id: number;
      codigo_proveedor: string;
      nombre: string | null;
      tono_canon: Record<string, unknown> | null;
    }>(
      `
      SELECT c.id, c.codigo_proveedor::text, c.nombre, c.tono_canon
      FROM color c
      WHERE ${whereSql}
      ORDER BY c.codigo_proveedor
      LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    ),
    pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM color c WHERE ${whereSql}`, params),
  ]);

  const { colorPredominante } = await import("./color-canon");

  const rows = listRes.rows.map((r) => ({
    id: r.id,
    codigo_proveedor: r.codigo_proveedor,
    nombre: r.nombre,
    tono_canon: r.tono_canon,
    predominante: colorPredominante(r.nombre),
  }));

  return { rows, total: Number(countRes.rows[0]?.n ?? 0) };
}

export async function patchColorTono(
  pool: Pool,
  id: number,
  proveedorId: number,
  tonoCanon: Record<string, unknown> | null,
): Promise<boolean> {
  const res = await pool.query(
    `UPDATE color SET tono_canon = $3::jsonb WHERE id = $1 AND proveedor_id = $2`,
    [id, proveedorId, tonoCanon ? JSON.stringify(tonoCanon) : null],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Rango codigo_proveedor — asigna tono_canon (misma herramienta que líneas por rango). */
export async function patchColorRango(
  pool: Pool,
  proveedorId: number,
  desde: string,
  hasta: string,
  opts: {
    tonoFijo?: Record<string, unknown> | null;
    hexDefault?: string;
    usarPredominante?: boolean;
    soloSinTono?: boolean;
    catalog?: import("./colores-estandar").ColorEstandar[];
  },
): Promise<number> {
  const d = desde.trim();
  const h = hasta.trim();
  if (!d || !h) return 0;

  const where: string[] = [
    "c.proveedor_id = $1",
    "c.activo = true",
    "c.codigo_proveedor::text >= $2",
    "c.codigo_proveedor::text <= $3",
  ];
  const params: unknown[] = [proveedorId, d, h];
  if (opts.soloSinTono) where.push("c.tono_canon IS NULL");

  if (opts.tonoFijo) {
    params.push(JSON.stringify(opts.tonoFijo));
    const res = await pool.query(
      `UPDATE color c SET tono_canon = $${params.length}::jsonb WHERE ${where.join(" AND ")}`,
      params,
    );
    return res.rowCount ?? 0;
  }

  if (!opts.usarPredominante) return 0;

  const { rows } = await pool.query<{ id: number; nombre: string | null }>(
    `SELECT c.id, c.nombre FROM color c WHERE ${where.join(" AND ")} ORDER BY c.codigo_proveedor`,
    params,
  );

  const { sugerirColorEstandarFromCatalog, sugerirColorEstandar } = await import("./colores-estandar");
  const { tonoSolido } = await import("./color-canon");
  const sugerir = (nombre: string | null) =>
    opts.catalog ? sugerirColorEstandarFromCatalog(nombre, opts.catalog) : sugerirColorEstandar(nombre);
  let updated = 0;
  for (const row of rows) {
    const std = sugerir(row.nombre);
    if (!std) continue;
    const tono = tonoSolido(std.etiqueta, std.hex);
    const ok = await patchColorTono(pool, row.id, proveedorId, tono);
    if (ok) updated += 1;
  }
  return updated;
}

/** Tabla catálogo tonos estándar (paleta admin · orden por dominancia). */
export async function ensureColorTonoEstandarTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.color_tono_estandar (
      id serial PRIMARY KEY,
      proveedor_id bigint NOT NULL,
      etiqueta text NOT NULL,
      hex text NOT NULL,
      aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
      orden int NOT NULL DEFAULT 999,
      uso_count int NOT NULL DEFAULT 0,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT color_tono_estandar_proveedor_etiqueta_key UNIQUE (proveedor_id, etiqueta)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_color_tono_estandar_proveedor_orden
    ON public.color_tono_estandar (proveedor_id, orden)
    WHERE activo = true
  `);
}

export async function seedColorTonoEstandarIfEmpty(pool: Pool, proveedorId: number): Promise<void> {
  const check = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM color_tono_estandar WHERE proveedor_id = $1`,
    [proveedorId],
  );
  if (Number(check.rows[0]?.n ?? 0) > 0) return;

  const peer = proveedorId === 638 ? 654 : null;
  if (peer) {
    await pool.query(
      `
      INSERT INTO color_tono_estandar (proveedor_id, etiqueta, hex, aliases, orden, uso_count)
      SELECT $1, etiqueta, hex, aliases, orden, 0
      FROM color_tono_estandar WHERE proveedor_id = $2
      ON CONFLICT (proveedor_id, etiqueta) DO NOTHING
      `,
      [proveedorId, peer],
    );
    return;
  }

  const { COLORES_ESTANDAR_DEFAULT } = await import("./colores-estandar");
  for (let i = 0; i < COLORES_ESTANDAR_DEFAULT.length; i++) {
    const c = COLORES_ESTANDAR_DEFAULT[i];
    await pool.query(
      `
      INSERT INTO color_tono_estandar (proveedor_id, etiqueta, hex, aliases, orden)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (proveedor_id, etiqueta) DO NOTHING
      `,
      [proveedorId, c.etiqueta, c.hex, JSON.stringify(c.aliases), (i + 1) * 10],
    );
  }
}

/** Sincroniza hex/aliases canónicos y recalcula orden (dominante primero). */
export async function loadAndRecalcColoresEstandar(
  pool: Pool,
  proveedorId: number,
): Promise<import("./colores-estandar").ColorEstandar[]> {
  await ensureColorTonoEstandarTable(pool);
  await seedColorTonoEstandarIfEmpty(pool, proveedorId);

  const { COLORES_ESTANDAR_DEFAULT, computeUsoPorEstandar, ordenarCatalogoPorUso, rowToColorEstandar } =
    await import("./colores-estandar");

  for (const c of COLORES_ESTANDAR_DEFAULT) {
    await pool.query(
      `
      UPDATE color_tono_estandar
      SET hex = $3, aliases = $4::jsonb, updated_at = now()
      WHERE proveedor_id = $1 AND etiqueta = $2
      `,
      [proveedorId, c.etiqueta, c.hex, JSON.stringify(c.aliases)],
    );
  }

  const [allColors, catRes] = await Promise.all([
    pool.query<{ nombre: string | null; tono_canon: Record<string, unknown> | null }>(
      `SELECT nombre, tono_canon FROM color WHERE proveedor_id = $1 AND activo = true`,
      [proveedorId],
    ),
    pool.query<{
      etiqueta: string;
      hex: string;
      aliases: unknown;
      orden: number;
      uso_count: number;
    }>(
      `
      SELECT etiqueta, hex, aliases, orden, uso_count
      FROM color_tono_estandar
      WHERE proveedor_id = $1 AND activo = true
      ORDER BY orden, etiqueta
      `,
      [proveedorId],
    ),
  ]);

  const catalog = catRes.rows.map(rowToColorEstandar);
  const uso = computeUsoPorEstandar(allColors.rows, catalog);
  const sorted = ordenarCatalogoPorUso(catalog, uso);

  await Promise.all(
    sorted.map((c, i) =>
      pool.query(
        `
        UPDATE color_tono_estandar
        SET orden = $1, uso_count = $2, updated_at = now()
        WHERE proveedor_id = $3 AND etiqueta = $4
        `,
        [i + 1, uso.get(c.etiqueta) ?? 0, proveedorId, c.etiqueta],
      ),
    ),
  );

  return sorted.map((c, i) => ({
    ...c,
    orden: i + 1,
    uso_count: uso.get(c.etiqueta) ?? 0,
  }));
}
