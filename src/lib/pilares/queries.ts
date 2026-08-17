import type { Pool } from "pg";
import { proveedorIdFromTipoV2 } from "./constants";
import { loadEstilosForTipoV2, loadTipos1ForTipoV2 } from "./validar-maestras-pilares";
import type {
  LineaReferenciaFilterOpts,
  LineaReferenciaProblemasEstiloResumen,
  LineaReferenciaRow,
  LineaReferenciaThumb,
  LineaRow,
  LineasResumen,
  LrCascadaItem,
  LineaReferenciaCascada,
  PilaresMaestras,
  TipoV2Id,
} from "./types";
import { decodeCodGrupo } from "./cod-grupo-decode";

/** SQL: estilo NULL o etiqueta OTROS (problema FOCO 2.3.5.5). */
const SQL_PROBLEMA_ESTILO = `(
  lr.grupo_estilo_id IS NULL
  OR upper(btrim(COALESCE(ge.descp_grupo_estilo, lr.descp_grupo_estilo, ''))) = 'OTROS'
)`;

/**
 * SQL: hay imagen usable en Admin L×R.
 * 654 = retail L×R **o** molécula PPD **o** CP `v_stock_rimec` (Web) · ley 2.3.5.19.
 * 638 = solo línea (retail o v_stock_rimec.imagen_url).
 */
function sqlExisteImagenRetail(tipoParamIndex: number, matchByLineaOnly = false): string {
  if (matchByLineaOnly) {
    return `(
      EXISTS (
        SELECT 1
        FROM public.registro_st_vt_rc_reposicion s
        WHERE btrim(s.linea_codigo_proveedor::text) = btrim(l.codigo_proveedor::text)
          AND ($${tipoParamIndex}::int IS NULL OR s.tipo_v2_id = $${tipoParamIndex}::int)
          AND NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.v_stock_rimec v
        WHERE btrim(v.linea_codigo::text) = btrim(l.codigo_proveedor::text)
          AND NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
      )
    )`;
  }
  return `(
    EXISTS (
      SELECT 1
      FROM public.registro_st_vt_rc_reposicion s
      WHERE btrim(s.linea_codigo_proveedor::text) = btrim(l.codigo_proveedor::text)
        AND btrim(s.referencia_codigo_proveedor::text) = btrim(r.codigo_proveedor::text)
        AND ($${tipoParamIndex}::int IS NULL OR s.tipo_v2_id = $${tipoParamIndex}::int)
        AND NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.pedido_proveedor_detalle ppd
      JOIN public.linea ll ON ll.id = ppd.linea_id
      JOIN public.referencia rr ON rr.id = ppd.referencia_id
      WHERE btrim(ll.codigo_proveedor::text) = btrim(l.codigo_proveedor::text)
        AND btrim(rr.codigo_proveedor::text) = btrim(r.codigo_proveedor::text)
        AND NULLIF(btrim(ppd.material_code::text), '') IS NOT NULL
        AND NULLIF(btrim(ppd.color_code::text), '') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.v_stock_rimec v
      WHERE btrim(v.linea_codigo::text) = btrim(l.codigo_proveedor::text)
        AND btrim(v.referencia_codigo::text) = btrim(r.codigo_proveedor::text)
        AND (
          NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
          OR (
            NULLIF(btrim(v.material_code::text), '') IS NOT NULL
            AND NULLIF(btrim(v.color_code::text), '') IS NOT NULL
          )
        )
    )
  )`;
}

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
    tipoV2Id != null
      ? loadEstilosForTipoV2(pool, tipoV2Id)
      : pool
          .query<{ id: number; label: string }>(
            `SELECT id_grupo_estilo AS id, TRIM(descp_grupo_estilo) AS label FROM grupo_estilo_v2 ORDER BY descp_grupo_estilo`,
          )
          .then((r) => r.rows),
    tipoV2Id != null
      ? loadTipos1ForTipoV2(pool, tipoV2Id)
      : pool
          .query<{ id: number; label: string }>(
            `SELECT id_tipo_1 AS id, TRIM(descp_tipo_1) AS label FROM tipo_1 ORDER BY id_tipo_1`,
          )
          .then((r) => r.rows),
  ]);

  return {
    marcas,
    generos: generos.rows,
    estilos,
    tipos1,
  };
}

function appendLineaAdminFilters(
  where: string[],
  params: unknown[],
  opts: LineaReferenciaFilterOpts,
  tipoV2Id: TipoV2Id,
) {
  if (opts.buscar?.trim()) {
    params.push(`%${opts.buscar.trim().toLowerCase()}%`);
    where.push(`(
      lower(l.codigo_proveedor::text) LIKE $${params.length}
      OR lower(COALESCE(l.descripcion, '')) LIKE $${params.length}
      OR lower(COALESCE(mv.descp_marca, '')) LIKE $${params.length}
    )`);
  }
  if (opts.lineaIds?.length) {
    params.push(opts.lineaIds);
    where.push(`l.id = ANY($${params.length}::int[])`);
  }
  if (opts.marcaNull || opts.marca === "__null__") where.push("l.marca_id IS NULL");
  else if (opts.marcaIds?.length) {
    params.push(opts.marcaIds);
    where.push(`l.marca_id = ANY($${params.length}::int[])`);
  } else if (opts.marca) {
    params.push(opts.marca);
    where.push(`mv.descp_marca = $${params.length}`);
  }
  if (opts.generoNull) where.push("l.genero_id IS NULL");
  else if (opts.generoIds?.length) {
    params.push(opts.generoIds);
    where.push(`l.genero_id = ANY($${params.length}::int[])`);
  } else if (opts.generoId != null) {
    params.push(opts.generoId);
    where.push(`l.genero_id = $${params.length}`);
  } else if (opts.genero) {
    params.push(opts.genero);
    where.push(`g.descripcion = $${params.length}`);
  }

  const lrBits: string[] = ["lr.linea_id = l.id"];
  if (opts.estiloNull) lrBits.push("lr.grupo_estilo_id IS NULL");
  else if (opts.problemasEstilo) {
    lrBits.push("(lr.grupo_estilo_id IS NULL OR upper(trim(COALESCE(lr.descp_grupo_estilo, ge.descp_grupo_estilo, ''))) = 'OTROS')");
  } else if (opts.estiloIds?.length) {
    params.push(opts.estiloIds);
    lrBits.push(`lr.grupo_estilo_id = ANY($${params.length}::int[])`);
  }
  if (opts.tipo1Null) lrBits.push("lr.tipo_1_id IS NULL");
  else if (opts.tipo1Ids?.length) {
    params.push(opts.tipo1Ids);
    lrBits.push(`lr.tipo_1_id = ANY($${params.length}::int[])`);
  }
  if (opts.referenciaIds?.length) {
    params.push(opts.referenciaIds);
    lrBits.push(`lr.referencia_id = ANY($${params.length}::int[])`);
  }
  const needLr =
    opts.estiloNull ||
    opts.problemasEstilo ||
    (opts.estiloIds?.length ?? 0) > 0 ||
    opts.tipo1Null ||
    (opts.tipo1Ids?.length ?? 0) > 0 ||
    (opts.referenciaIds?.length ?? 0) > 0;
  if (needLr) {
    where.push(`EXISTS (
      SELECT 1 FROM linea_referencia lr
      LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
      WHERE ${lrBits.join(" AND ")}
    )`);
  }

  if (opts.origenTipo === "PRONTA_ENTREGA" || opts.depositoCodigo?.trim()) {
    params.push(tipoV2Id);
    const tipoIdx = params.length;
    const proveedorPe = proveedorIdFromTipoV2(tipoV2Id);
    params.push(proveedorPe);
    const provIdx = params.length;
    let dep = "";
    if (opts.depositoCodigo?.trim()) {
      params.push(opts.depositoCodigo.trim());
      dep = ` AND btrim(pe.deposito_codigo::text) = $${params.length}`;
    }
    where.push(`EXISTS (
      SELECT 1 FROM stock_pronta_entrega_rimec pe
      WHERE pe.linea_id = l.id
        AND pe.tipo_v2_id = $${tipoIdx}::int
        AND pe.proveedor_id = $${provIdx}::int
        ${dep}
        AND EXISTS (
          SELECT 1 FROM registro_st_vt_rc_reposicion s
          WHERE s.linea_id = l.id
            AND s.tipo_v2_id = $${tipoIdx}::int
            AND lower(btrim(COALESCE(s.tipo_movimiento::text, ''))) = 'stock'
            AND COALESCE(s.cantidad, 0) > 0
        )
    )`);
  }
  if (opts.origenTipo === "CP") {
    params.push(tipoV2Id);
    where.push(`EXISTS (
      SELECT 1 FROM public.registro_st_vt_rc_reposicion s
      WHERE s.linea_id = l.id
        AND s.tipo_v2_id = $${params.length}::int
    )`);
  }

  const tgs = (opts.tipoGrupos ?? []).map((x) => x.toLowerCase());
  if (tgs.length) {
    const cg = `LPAD(LEFT(regexp_replace(TRIM(s.cod_grupo::text), '[^0-9]', '', 'g'), 10), 10, '0')`;
    const d45 = `SUBSTRING(${cg}, 5, 2)`;
    const d67 = `SUBSTRING(${cg}, 7, 2)`;
    const parts: string[] = [];
    if (tipoV2Id === 1) {
      if (tgs.includes("normal")) parts.push(`${d45} IN ('01','06','08')`);
      if (tgs.includes("promo")) parts.push(`${d45} = '02'`);
      if (tgs.includes("liquidacion")) parts.push(`${d45} = '04'`);
      if (tgs.includes("comun")) parts.push(`${d45} = '06'`);
    } else {
      if (tgs.includes("promo")) parts.push(`${d67} = '03'`);
      if (tgs.includes("liquidacion")) parts.push(`${d67} = '04'`);
      if (tgs.includes("normal")) parts.push(`${d67} IN ('01','02','00')`);
    }
    if (parts.length) {
      where.push(`EXISTS (
        SELECT 1 FROM stock_pronta_entrega_rimec s
        WHERE s.linea_id = l.id AND (${parts.join(" OR ")})
      )`);
    }
  }
}

export async function loadLineas(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  opts: LineaReferenciaFilterOpts & { limit?: number; offset?: number } = {},
): Promise<{ rows: LineaRow[]; total: number }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { rows: [], total: 0 };

  const where = ["l.activo = true", "l.proveedor_id = $1"];
  const params: unknown[] = [proveedorId];
  appendLineaAdminFilters(where, params, opts, tipoV2Id);

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

  const exact = opts.buscar?.trim() || null;
  const listParams = [...params, exact, limit, offset];
  const n = params.length;
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
    ORDER BY
      CASE
        WHEN $${n + 1}::text IS NOT NULL
         AND lower(l.codigo_proveedor::text) = lower($${n + 1}::text) THEN 0
        ELSE 1
      END,
      l.codigo_proveedor::text
    LIMIT $${n + 2} OFFSET $${n + 3}
    `,
    listParams,
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
LEFT JOIN genero g ON g.id = l.genero_id
LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
`;

type LrExcludeDim =
  | "genero"
  | "marca"
  | "estilo"
  | "tipo1"
  | "linea"
  | "referencia"
  | "material"
  | "color";

function appendLrFilters(
  where: string[],
  params: unknown[],
  opts: LineaReferenciaFilterOpts,
  exclude?: LrExcludeDim,
  extra?: { tipoV2Id?: TipoV2Id | null },
) {
  if (exclude !== "linea") {
    if (opts.lineaIds?.length) {
      params.push(opts.lineaIds);
      where.push(`l.id = ANY($${params.length}::int[])`);
    } else if (opts.lineaCodigos?.length) {
      params.push(opts.lineaCodigos);
      where.push(`l.codigo_proveedor::text = ANY($${params.length}::text[])`);
    }
  }
  if (exclude !== "referencia" && opts.referenciaIds?.length) {
    params.push(opts.referenciaIds);
    where.push(`r.id = ANY($${params.length}::int[])`);
  }
  if (opts.buscar?.trim()) {
    params.push(`%${opts.buscar.trim().toLowerCase()}%`);
    where.push(`(
      lower(l.codigo_proveedor::text) LIKE $${params.length}
      OR lower(r.codigo_proveedor::text) LIKE $${params.length}
      OR lower(COALESCE(mv.descp_marca, '')) LIKE $${params.length}
      OR lower(COALESCE(lr.descp_grupo_estilo, '')) LIKE $${params.length}
    )`);
  }

  const tipoV2 = extra?.tipoV2Id ?? null;
  const byLinea638 = tipoV2 === 2;
  const refMatchSql = byLinea638
    ? ""
    : `AND btrim(s.referencia_codigo_proveedor::text) = btrim(r.codigo_proveedor::text)`;

  // PE / depósito = scope venta hoy sobre la MAESTRA L×R (no inventa FKs).
  // Ley 2.3.5.12: linea + linea_referencia = verdad de filtros Web/AM/PE;
  // SDRM/PE solo delimitan qué filas editar. Match por linea_id + tipo/proveedor.
  if (opts.depositoCodigo?.trim() || opts.origenTipo === "PRONTA_ENTREGA") {
    params.push(tipoV2);
    const tipoIdx = params.length;
    const proveedorPe = tipoV2 != null ? proveedorIdFromTipoV2(tipoV2) : null;
    params.push(proveedorPe);
    const provIdx = params.length;
    let depClause = "";
    if (opts.depositoCodigo?.trim()) {
      params.push(opts.depositoCodigo.trim());
      depClause = ` AND btrim(pe.deposito_codigo::text) = $${params.length}`;
    }
    const refPe = byLinea638 ? "TRUE" : "pe.referencia_id = r.id";
    const refSdrm = byLinea638 ? "" : "AND s.referencia_id = r.id";
    where.push(`EXISTS (
      SELECT 1 FROM public.stock_pronta_entrega_rimec pe
      WHERE pe.linea_id = l.id
        AND (${refPe})
        AND pe.tipo_v2_id = $${tipoIdx}::int
        AND pe.proveedor_id = $${provIdx}::int
        ${depClause}
        AND EXISTS (
          SELECT 1 FROM public.registro_st_vt_rc_reposicion s
          WHERE s.linea_id = l.id
            AND s.tipo_v2_id = $${tipoIdx}::int
            AND lower(btrim(COALESCE(s.tipo_movimiento::text, ''))) = 'stock'
            AND COALESCE(s.cantidad, 0) > 0
            ${refSdrm}
        )
    )`);
  }

  if (opts.origenTipo === "CP") {
    // Compra previa = universo RIMEC Web (v_stock_rimec · tránsito) · ley 2.3.5.19.
    where.push(`EXISTS (
      SELECT 1 FROM public.v_stock_rimec v
      WHERE v.linea_id = l.id
        AND (${byLinea638 ? "TRUE" : "v.referencia_id = r.id"})
        AND COALESCE(v.cantidad_pares, 0) > 0
    )`);
  }

  const tgs = (opts.tipoGrupos ?? []).map((x) => x.toLowerCase());
  if (tgs.length) {
    params.push(tipoV2);
    const tipoIdx = params.length;
    const cg = `LPAD(LEFT(regexp_replace(TRIM(s.cod_grupo::text), '[^0-9]', '', 'g'), 10), 10, '0')`;
    const d45 = `SUBSTRING(${cg}, 5, 2)`;
    const d67 = `SUBSTRING(${cg}, 7, 2)`;
    const parts: string[] = [];
    if (tipoV2 === 2) {
      if (tgs.includes("promo")) parts.push(`${d67} = '03'`);
      if (tgs.includes("liquidacion")) parts.push(`${d67} = '04'`);
      if (tgs.includes("normal")) parts.push(`${d67} IN ('01','02','00')`);
      if (tgs.includes("actual")) parts.push(`${d67} = '01'`);
      if (tgs.includes("anterior")) parts.push(`${d67} = '02'`);
    } else {
      if (tgs.includes("normal")) parts.push(`${d45} IN ('01','06','08')`);
      if (tgs.includes("promo")) parts.push(`${d45} = '02'`);
      if (tgs.includes("liquidacion")) parts.push(`${d45} = '04'`);
      if (tgs.includes("comun")) parts.push(`${d45} = '06'`);
    }
    if (parts.length) {
      // Match por linea_id (no código): evita cruzar gemelos 654↔638.
      const refSdrm = byLinea638 ? "" : "AND s.referencia_id = r.id";
      where.push(`EXISTS (
        SELECT 1 FROM public.registro_st_vt_rc_reposicion s
        WHERE s.linea_id = l.id
          ${refSdrm}
          AND s.tipo_v2_id = $${tipoIdx}::int
          AND (${parts.join(" OR ")})
      )`);
    }
  }

  if (exclude !== "material" && opts.materialFamilias?.length) {
    params.push(opts.materialFamilias.map((x) => x.trim().toUpperCase()).filter(Boolean));
    const famIdx = params.length;
    params.push(tipoV2);
    const tipoIdx = params.length;
    const refSdrm = byLinea638 ? "" : "AND s.referencia_id = r.id";
    where.push(`EXISTS (
      SELECT 1 FROM public.registro_st_vt_rc_reposicion s
      LEFT JOIN public.material mat ON mat.id = s.material_id
      WHERE s.linea_id = l.id
        ${refSdrm}
        AND s.tipo_v2_id = $${tipoIdx}::int
        AND upper(btrim(COALESCE(
          NULLIF(s.excel_material_code::text, ''),
          NULLIF(mat.codigo_proveedor::text, ''),
          'SIN'
        ))) = ANY($${famIdx}::text[])
    )`);
  }

  if (exclude !== "color" && opts.colorFamilias?.length) {
    params.push(opts.colorFamilias.map((x) => x.trim().toUpperCase()).filter(Boolean));
    const famIdx = params.length;
    params.push(tipoV2);
    const tipoIdx = params.length;
    const refSdrm = byLinea638 ? "" : "AND s.referencia_id = r.id";
    where.push(`EXISTS (
      SELECT 1 FROM public.registro_st_vt_rc_reposicion s
      LEFT JOIN public.color col ON col.id = s.color_id
      WHERE s.linea_id = l.id
        ${refSdrm}
        AND s.tipo_v2_id = $${tipoIdx}::int
        AND upper(btrim(COALESCE(
          NULLIF(s.excel_color_code::text, ''),
          NULLIF(col.codigo_proveedor::text, ''),
          NULLIF(col.tono_canon->>'etiqueta', ''),
          'SIN'
        ))) = ANY($${famIdx}::text[])
    )`);
  }

  if (exclude !== "genero") {
    if (opts.generoNull) where.push("l.genero_id IS NULL");
    else if (opts.generoIds?.length) {
      params.push(opts.generoIds);
      where.push(`l.genero_id = ANY($${params.length}::int[])`);
    } else if (opts.generoId != null) {
      params.push(opts.generoId);
      where.push(`l.genero_id = $${params.length}`);
    } else if (opts.genero) {
      params.push(opts.genero);
      where.push(`g.descripcion = $${params.length}`);
    }
  }
  if (exclude !== "marca") {
    if (opts.marcaNull || opts.marca === "__null__") where.push("l.marca_id IS NULL");
    else if (opts.marcaIds?.length) {
      params.push(opts.marcaIds);
      where.push(`l.marca_id = ANY($${params.length}::int[])`);
    } else if (opts.marca) {
      params.push(opts.marca);
      where.push(`mv.descp_marca = $${params.length}`);
    }
  }
  if (exclude !== "estilo") {
    if (opts.problemasEstilo) {
      where.push(SQL_PROBLEMA_ESTILO);
    } else if (opts.estiloNull) {
      where.push("lr.grupo_estilo_id IS NULL");
    } else if (opts.estiloIds?.length) {
      params.push(opts.estiloIds);
      where.push(`lr.grupo_estilo_id = ANY($${params.length}::int[])`);
    } else if (opts.estiloId != null) {
      params.push(opts.estiloId);
      where.push(`lr.grupo_estilo_id = $${params.length}`);
    }
  }
  if (exclude !== "tipo1") {
    if (opts.tipo1Null) where.push("lr.tipo_1_id IS NULL");
    else if (opts.tipo1Ids?.length) {
      params.push(opts.tipo1Ids);
      where.push(`lr.tipo_1_id = ANY($${params.length}::int[])`);
    } else if (opts.tipo1Id != null) {
      params.push(opts.tipo1Id);
      where.push(`lr.tipo_1_id = $${params.length}`);
    }
  }
  if (opts.conImagen === true || opts.conImagen === false) {
    params.push(extra?.tipoV2Id ?? null);
    const byLinea = extra?.tipoV2Id === 2;
    const exists = sqlExisteImagenRetail(params.length, byLinea);
    where.push(opts.conImagen ? exists : `NOT ${exists}`);
  }
}

function lrFilterOptsFromParams(opts: LineaReferenciaFilterOpts): LineaReferenciaFilterOpts {
  return {
    marca: opts.marca ?? null,
    marcaIds: opts.marcaIds ?? null,
    marcaNull: opts.marcaNull,
    generoId: opts.generoId ?? null,
    generoIds: opts.generoIds ?? null,
    generoNull: opts.generoNull,
    estiloId: opts.estiloId ?? null,
    estiloIds: opts.estiloIds ?? null,
    tipo1Id: opts.tipo1Id ?? null,
    tipo1Ids: opts.tipo1Ids ?? null,
    estiloNull: opts.estiloNull,
    tipo1Null: opts.tipo1Null,
    lineaCodigos: opts.lineaCodigos ?? null,
    lineaIds: opts.lineaIds ?? null,
    referenciaIds: opts.referenciaIds ?? null,
    buscar: opts.buscar ?? null,
    materialFamilias: opts.materialFamilias ?? null,
    colorFamilias: opts.colorFamilias ?? null,
    origenTipo: opts.origenTipo ?? null,
    depositoCodigo: opts.depositoCodigo ?? null,
    tipoGrupos: opts.tipoGrupos ?? null,
    problemasEstilo: opts.problemasEstilo,
    conImagen: opts.conImagen ?? null,
  };
}

export async function loadLineaReferenciaCascada(
  pool: Pool,
  tipoV2Id: TipoV2Id,
  opts: LineaReferenciaFilterOpts,
): Promise<LineaReferenciaCascada> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) {
    return {
      generos: [],
      marcas: [],
      estilos: [],
      tipos1: [],
      lineas: [],
      referencias: [],
      materiales: [],
      colores: [],
    };
  }

  const queryDim = async (
    exclude: LrExcludeDim,
    selectSql: string,
    limit = 50,
  ): Promise<LrCascadaItem[]> => {
    const where = ["lr.proveedor_id = $1", "l.activo = true"];
    const params: unknown[] = [proveedorId];
    appendLrFilters(where, params, opts, exclude, { tipoV2Id });
    const { rows } = await pool.query<{ key: string; label: string; count: string }>(
      `SELECT ${selectSql} ${LR_JOIN} WHERE ${where.join(" AND ")} GROUP BY 1, 2 ORDER BY COUNT(*) DESC, 2 LIMIT ${limit}`,
      params,
    );
    return rows.map((r) => ({ key: r.key, label: r.label, count: Number(r.count) }));
  };

  const [generos, marcas, estilos, tipos1, lineas, referencias, materiales, colores] =
    await Promise.all([
    queryDim(
      "genero",
      `CASE WHEN l.genero_id IS NULL THEN '__null__' ELSE l.genero_id::text END AS key,
       COALESCE(NULLIF(TRIM(g.descripcion), ''), '— Sin género —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "marca",
      `CASE WHEN l.marca_id IS NULL THEN '__null__' ELSE l.marca_id::text END AS key,
       COALESCE(NULLIF(TRIM(mv.descp_marca), ''), '— Sin marca —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "estilo",
      `CASE WHEN lr.grupo_estilo_id IS NULL THEN '__null__' ELSE lr.grupo_estilo_id::text END AS key,
       COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), NULLIF(TRIM(lr.descp_grupo_estilo), ''), '— Sin estilo —') AS label,
       COUNT(*)::text AS count`,
      80,
    ),
    queryDim(
      "tipo1",
      `CASE WHEN lr.tipo_1_id IS NULL THEN '__null__' ELSE lr.tipo_1_id::text END AS key,
       COALESCE(NULLIF(TRIM(t1.descp_tipo_1), ''), NULLIF(TRIM(lr.descp_tipo_1), ''), '— Sin tipo —') AS label,
       COUNT(*)::text AS count`,
    ),
    queryDim(
      "linea",
      `l.id::text AS key,
       l.codigo_proveedor::text AS label,
       COUNT(*)::text AS count`,
      80,
    ),
    queryDim(
      "referencia",
      `r.id::text AS key,
       r.codigo_proveedor::text AS label,
       COUNT(*)::text AS count`,
      80,
    ),
    loadLrCascadaFamilias(pool, proveedorId, tipoV2Id, opts, "material"),
    loadLrCascadaFamilias(pool, proveedorId, tipoV2Id, opts, "color"),
  ]);

  return {
    generos,
    marcas,
    estilos,
    tipos1,
    lineas,
    referencias,
    materiales,
    colores,
  };
}

/** Familias M/C desde retail staging del universo filtrado. */
async function loadLrCascadaFamilias(
  pool: Pool,
  proveedorId: number,
  tipoV2Id: TipoV2Id,
  opts: LineaReferenciaFilterOpts,
  kind: "material" | "color",
): Promise<LrCascadaItem[]> {
  const where = ["lr.proveedor_id = $1", "l.activo = true"];
  const params: unknown[] = [proveedorId];
  appendLrFilters(where, params, opts, kind, { tipoV2Id });
  const byLinea = tipoV2Id === 2;
  const refJoin = byLinea
    ? ""
    : `AND btrim(s.referencia_codigo_proveedor::text) = btrim(r.codigo_proveedor::text)`;
  const expr =
    kind === "material"
      ? `upper(btrim(COALESCE(
          NULLIF(s.excel_material_code::text, ''),
          NULLIF(mat.codigo_proveedor::text, ''),
          'SIN'
        )))`
      : `upper(btrim(COALESCE(
          NULLIF(s.excel_color_code::text, ''),
          NULLIF(col.codigo_proveedor::text, ''),
          NULLIF(col.tono_canon->>'etiqueta', ''),
          'SIN'
        )))`;
  params.push(tipoV2Id);
  const tipoIdx = params.length;
  const { rows } = await pool.query<{ key: string; label: string; count: string }>(
    `
    SELECT ${expr} AS key, ${expr} AS label, COUNT(DISTINCT lr.id)::text AS count
    ${LR_JOIN}
    INNER JOIN public.registro_st_vt_rc_reposicion s
      ON btrim(s.linea_codigo_proveedor::text) = btrim(l.codigo_proveedor::text)
      ${refJoin}
      AND ($${tipoIdx}::int IS NULL OR s.tipo_v2_id = $${tipoIdx}::int)
    LEFT JOIN public.material mat ON mat.id = s.material_id
    LEFT JOIN public.color col ON col.id = s.color_id
    WHERE ${where.join(" AND ")}
      AND ${expr} IS NOT NULL
      AND ${expr} <> ''
    GROUP BY 1, 2
    ORDER BY COUNT(DISTINCT lr.id) DESC, 2
    LIMIT 60
    `,
    params,
  );
  return rows.map((r) => ({ key: r.key, label: r.label, count: Number(r.count) }));
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
  opts: LineaReferenciaFilterOpts & { limit?: number; offset?: number } = {},
): Promise<{ rows: LineaReferenciaRow[]; total: number }> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { rows: [], total: 0 };

  const filterOpts = lrFilterOptsFromParams(opts);
  const where = ["lr.proveedor_id = $1", "l.activo = true"];
  const params: unknown[] = [proveedorId];
  appendLrFilters(where, params, filterOpts, undefined, { tipoV2Id });

  const whereSql = where.join(" AND ");
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const countJoinGe = filterOpts.problemasEstilo
    ? "LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id"
    : "";

  const countRes = await pool.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM linea_referencia lr
    JOIN linea l ON l.id = lr.linea_id
    JOIN referencia r ON r.id = lr.referencia_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    ${countJoinGe}
    WHERE ${whereSql}
    `,
    params,
  );

  let orderByImg = "";
  if (filterOpts.problemasEstilo) {
    params.push(tipoV2Id);
    orderByImg = `CASE WHEN ${sqlExisteImagenRetail(params.length, tipoV2Id === 2)} THEN 0 ELSE 1 END,`;
  }
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;
  /**
   * Cola viva arriba: L×R en stock CP (v_stock_rimec) con tipo_1 vacío.
   * 638 · Director 2026-08-16 — las 4 CP primero (JOIN, no EXISTS correlacionado).
   */
  const { rows } = await pool.query<LineaReferenciaRow>(
    `
    WITH cp_stock AS (
      SELECT DISTINCT linea_id, referencia_id
      FROM v_stock_rimec
      WHERE proveedor_importacion_id = $1
        AND COALESCE(cantidad_pares, 0) > 0
    )
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
    LEFT JOIN cp_stock cp
      ON cp.linea_id = lr.linea_id
     AND cp.referencia_id = lr.referencia_id
     AND lr.tipo_1_id IS NULL
    WHERE ${whereSql}
    ORDER BY
      CASE WHEN cp.linea_id IS NOT NULL THEN 0 ELSE 1 END,
      ${orderByImg}
      CASE WHEN l.codigo_proveedor::text ~ '^[0-9]+$' THEN l.codigo_proveedor::numeric ELSE NULL END NULLS LAST,
      l.codigo_proveedor::text,
      r.codigo_proveedor::text
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    params,
  );

  return { rows, total: Number(countRes.rows[0]?.total ?? 0) };
}

/** Contadores cola problemas estilo (654/638). */
export async function loadLineaReferenciaProblemasEstiloResumen(
  pool: Pool,
  tipoV2Id: TipoV2Id,
): Promise<LineaReferenciaProblemasEstiloResumen> {
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  if (proveedorId == null) return { total: 0, con_imagen: 0, sin_imagen: 0 };

  const img = sqlExisteImagenRetail(2, tipoV2Id === 2);
  const { rows } = await pool.query<{ total: string; con_imagen: string; sin_imagen: string }>(
    `
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE ${img})::text AS con_imagen,
      COUNT(*) FILTER (WHERE NOT ${img})::text AS sin_imagen
    FROM linea_referencia lr
    JOIN linea l ON l.id = lr.linea_id
    JOIN referencia r ON r.id = lr.referencia_id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    WHERE lr.proveedor_id = $1
      AND l.activo = true
      AND ${SQL_PROBLEMA_ESTILO}
    `,
    [proveedorId, tipoV2Id],
  );
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    con_imagen: Number(r?.con_imagen ?? 0),
    sin_imagen: Number(r?.sin_imagen ?? 0),
  };
}

/**
 * Sugerencia de estilo desde COD.GRUPO (retail) — solo si decode ≠ OTROS.
 * Nunca auto-aplica; el operador confirma.
 */
export async function loadEstiloSugeridoLineaReferencia(
  pool: Pool,
  pairs: { linea_codigo: string; referencia_codigo: string }[],
  tipoV2Id: TipoV2Id,
  estilos: { id: number; label: string }[],
): Promise<Map<string, { id: number; label: string }>> {
  const out = new Map<string, { id: number; label: string }>();
  if (!pairs.length || !estilos.length) return out;

  const lineas = pairs.map((p) => p.linea_codigo);
  const refs = pairs.map((p) => p.referencia_codigo);
  const { rows } = await pool.query<{
    linea_codigo: string;
    referencia_codigo: string;
    cod_grupo: string | null;
  }>(
    `
    WITH pairs AS (
      SELECT u.l AS linea_codigo, u.r AS referencia_codigo
      FROM unnest($1::text[], $2::text[]) AS u(l, r)
    )
    SELECT DISTINCT ON (p.linea_codigo, p.referencia_codigo)
      p.linea_codigo,
      p.referencia_codigo,
      NULLIF(btrim(s.cod_grupo::text), '') AS cod_grupo
    FROM pairs p
    INNER JOIN public.registro_st_vt_rc_reposicion s
      ON btrim(s.linea_codigo_proveedor::text) = p.linea_codigo
      AND btrim(s.referencia_codigo_proveedor::text) = p.referencia_codigo
    WHERE ($3::int IS NULL OR s.tipo_v2_id = $3)
    ORDER BY
      p.linea_codigo,
      p.referencia_codigo,
      (CASE WHEN NULLIF(btrim(s.cod_grupo::text), '') IS NOT NULL THEN 0 ELSE 1 END),
      s.id
    `,
    [lineas, refs, tipoV2Id],
  );

  const byLabel = new Map(estilos.map((e) => [e.label.trim().toUpperCase(), e] as const));

  for (const r of rows) {
    if (!r.cod_grupo) continue;
    const decoded = decodeCodGrupo(r.cod_grupo);
    const label = decoded.estiloLabel?.trim().toUpperCase() ?? "";
    if (!label || label === "OTROS") continue;
    const match = byLabel.get(label);
    if (!match) continue;
    out.set(`${r.linea_codigo}\0${r.referencia_codigo}`, match);
  }
  return out;
}

/**
 * Primera molécular con imagen usable para Admin L×R.
 * 654 = retail L×R · si no → PPD · si no → CP `v_stock_rimec` (RIMEC Web · 2.3.5.19).
 * 638 = solo línea (retail; si no → v_stock_rimec.imagen_url).
 */
export async function loadPrimeraImagenLineaReferencia(
  pool: Pool,
  pairs: { linea_codigo: string; referencia_codigo: string }[],
  tipoV2Id?: TipoV2Id,
): Promise<Map<string, LineaReferenciaThumb>> {
  const out = new Map<string, LineaReferenciaThumb>();
  if (!pairs.length) return out;

  const byLineaOnly = tipoV2Id === 2;

  if (byLineaOnly) {
    const lineas = [...new Set(pairs.map((p) => p.linea_codigo))];
    const { rows } = await pool.query<{
      linea_codigo: string;
      imagen_nombre: string | null;
      material_code: string;
      color_code: string;
    }>(
      `
      SELECT DISTINCT ON (btrim(s.linea_codigo_proveedor::text))
        btrim(s.linea_codigo_proveedor::text) AS linea_codigo,
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
      FROM public.registro_st_vt_rc_reposicion s
      LEFT JOIN public.material mat ON mat.id = s.material_id
      LEFT JOIN public.color col ON col.id = s.color_id
      WHERE btrim(s.linea_codigo_proveedor::text) = ANY($1::text[])
        AND s.tipo_v2_id = $2::int
        AND NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL
      ORDER BY
        btrim(s.linea_codigo_proveedor::text),
        s.id
      `,
      [lineas, tipoV2Id ?? 2],
    );

    const byLinea = new Map<string, LineaReferenciaThumb>();
    for (const r of rows) {
      byLinea.set(r.linea_codigo, {
        imagen_nombre: r.imagen_nombre,
        material_code: r.material_code ?? "",
        color_code: r.color_code ?? "",
      });
    }

    const missing = lineas.filter((L) => !byLinea.has(L));
    if (missing.length) {
      const { rows: cpRows } = await pool.query<{
        linea_codigo: string;
        imagen_nombre: string | null;
        color_code: string;
      }>(
        `
        SELECT DISTINCT ON (btrim(v.linea_codigo::text))
          btrim(v.linea_codigo::text) AS linea_codigo,
          NULLIF(btrim(v.imagen_url::text), '') AS imagen_nombre,
          COALESCE(NULLIF(btrim(v.color_code::text), ''), '') AS color_code
        FROM public.v_stock_rimec v
        JOIN public.linea l ON l.id = v.linea_id AND l.proveedor_id = 638
        WHERE btrim(v.linea_codigo::text) = ANY($1::text[])
          AND NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
        ORDER BY
          btrim(v.linea_codigo::text),
          v.det_id
        `,
        [missing],
      );
      for (const r of cpRows) {
        byLinea.set(r.linea_codigo, {
          imagen_nombre: r.imagen_nombre,
          material_code: "",
          color_code: r.color_code ?? "",
        });
      }
    }

    for (const p of pairs) {
      const thumb = byLinea.get(p.linea_codigo);
      if (thumb) out.set(`${p.linea_codigo}\0${p.referencia_codigo}`, thumb);
    }
    return out;
  }

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

  /** 654 · sin retail (ej. solo PROGRAMADO): stem L-R-M-C desde PPD = misma foto que Magno. */
  const missing654 = pairs.filter(
    (p) => {
      const t = out.get(`${p.linea_codigo}\0${p.referencia_codigo}`);
      if (!t) return true;
      const hasName = Boolean(t.imagen_nombre?.trim());
      const hasMol = Boolean(t.material_code?.trim() && t.color_code?.trim());
      return !hasName && !hasMol;
    },
  );
  if (missing654.length) {
    const lineasM = missing654.map((p) => p.linea_codigo);
    const refsM = missing654.map((p) => p.referencia_codigo);
    const { rows: ppdRows } = await pool.query<{
      linea_codigo: string;
      referencia_codigo: string;
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
        NULLIF(btrim(ppd.material_code::text), '') AS material_code,
        NULLIF(btrim(ppd.color_code::text), '') AS color_code
      FROM pairs p
      JOIN public.linea l ON btrim(l.codigo_proveedor::text) = p.linea_codigo
      JOIN public.referencia r ON btrim(r.codigo_proveedor::text) = p.referencia_codigo
      JOIN public.pedido_proveedor_detalle ppd
        ON ppd.linea_id = l.id AND ppd.referencia_id = r.id
      WHERE NULLIF(btrim(ppd.material_code::text), '') IS NOT NULL
        AND NULLIF(btrim(ppd.color_code::text), '') IS NOT NULL
      ORDER BY
        p.linea_codigo,
        p.referencia_codigo,
        ppd.id
      `,
      [lineasM, refsM],
    );
    for (const r of ppdRows) {
      const key = `${r.linea_codigo}\0${r.referencia_codigo}`;
      if (out.has(key) && out.get(key)?.imagen_nombre) continue;
      out.set(key, {
        imagen_nombre: null,
        material_code: r.material_code ?? "",
        color_code: r.color_code ?? "",
      });
    }
  }

  /** 654 · Compra previa / RIMEC Web: imagen_url o L-R-M-C desde v_stock_rimec. */
  const missingCp = pairs.filter((p) => {
    const t = out.get(`${p.linea_codigo}\0${p.referencia_codigo}`);
    if (!t) return true;
    const hasName = Boolean(t.imagen_nombre?.trim());
    const hasMol = Boolean(t.material_code?.trim() && t.color_code?.trim());
    return !hasName && !hasMol;
  });
  if (missingCp.length) {
    const lineasC = missingCp.map((p) => p.linea_codigo);
    const refsC = missingCp.map((p) => p.referencia_codigo);
    const { rows: cpRows } = await pool.query<{
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
        NULLIF(btrim(v.imagen_url::text), '') AS imagen_nombre,
        COALESCE(NULLIF(btrim(v.material_code::text), ''), '') AS material_code,
        COALESCE(NULLIF(btrim(v.color_code::text), ''), '') AS color_code
      FROM pairs p
      JOIN public.v_stock_rimec v
        ON btrim(v.linea_codigo::text) = p.linea_codigo
        AND btrim(v.referencia_codigo::text) = p.referencia_codigo
      WHERE COALESCE(v.cantidad_pares, 0) > 0
        AND (
          NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
          OR (
            NULLIF(btrim(v.material_code::text), '') IS NOT NULL
            AND NULLIF(btrim(v.color_code::text), '') IS NOT NULL
          )
        )
      ORDER BY
        p.linea_codigo,
        p.referencia_codigo,
        (CASE WHEN NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL THEN 0 ELSE 1 END),
        v.det_id
      `,
      [lineasC, refsC],
    );
    for (const r of cpRows) {
      const key = `${r.linea_codigo}\0${r.referencia_codigo}`;
      const prev = out.get(key);
      if (prev?.imagen_nombre?.trim()) continue;
      if (prev?.material_code?.trim() && prev?.color_code?.trim()) continue;
      out.set(key, {
        imagen_nombre: r.imagen_nombre,
        material_code: r.material_code ?? "",
        color_code: r.color_code ?? "",
      });
    }
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
  const tipoV2Id = (proveedorId === 638 ? 2 : 1) as TipoV2Id;
  appendLrFilters(where, params, opts, undefined, { tipoV2Id });
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
    pool.query<{ total: string; sin_tono: string; con_tono: string; sin_nombre: string; con_nombre: string }>(
      `
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE tono_canon IS NULL OR btrim(tono_canon->>'etiqueta') = '')::text AS sin_tono,
        COUNT(*) FILTER (WHERE tono_canon IS NOT NULL AND btrim(tono_canon->>'etiqueta') <> '')::text AS con_tono,
        COUNT(*) FILTER (WHERE nombre IS NULL OR btrim(nombre) = '')::text AS sin_nombre,
        COUNT(*) FILTER (WHERE nombre IS NOT NULL AND btrim(nombre) <> '')::text AS con_nombre
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
    sin_nombre: Number(t?.sin_nombre ?? 0),
    con_nombre: Number(t?.con_nombre ?? 0),
    por_etiqueta: etiqRes.rows.map((r) => ({ etiqueta: r.etiqueta, count: Number(r.n) })),
  };
}

export async function loadColores(
  pool: Pool,
  proveedorId: number,
  opts: {
    q?: string | null;
    sinTono?: boolean;
    conTono?: boolean;
    sinNombre?: boolean;
    conNombre?: boolean;
    etiquetas?: string[];
    limit?: number;
    offset?: number;
    /** Para detectar imagen retail (orden FOCO tono). */
    tipoV2Id?: TipoV2Id | null;
  },
): Promise<{ rows: import("./types").ColorRow[]; total: number }> {
  const { SQL_COLOR_CON_TONO, SQL_COLOR_SIN_TONO } = await import("./color-canon");
  const where: string[] = ["c.proveedor_id = $1", "c.activo = true"];
  const params: unknown[] = [proveedorId, opts.tipoV2Id ?? null];

  const etiquetas = (opts.etiquetas ?? []).map((e) => e.trim()).filter(Boolean);
  if (etiquetas.length > 0) {
    params.push(etiquetas.map((e) => e.toLowerCase()));
    where.push(
      `lower(btrim(c.tono_canon->>'etiqueta')) = ANY($${params.length}::text[])`,
    );
  } else if (opts.sinTono) {
    where.push(SQL_COLOR_SIN_TONO);
  } else if (opts.conTono) {
    where.push(SQL_COLOR_CON_TONO);
  }

  if (opts.sinNombre) {
    where.push("(c.nombre IS NULL OR btrim(c.nombre) = '')");
  }
  if (opts.conNombre) {
    where.push("(c.nombre IS NOT NULL AND btrim(c.nombre) <> '')");
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

  // Orden Director: 1) sin tono sin foto · 2) sin tono con foto · 3) con tono sin foto · 4) con tono con foto
  const [listRes, countRes] = await Promise.all([
    pool.query<{
      id: number;
      codigo_proveedor: string;
      nombre: string | null;
      tono_canon: Record<string, unknown> | null;
    }>(
      `
      WITH img_codes AS (
        -- Solo códigos del proveedor activo + retail del tipo_v2 (no cruzar 638↔654)
        SELECT DISTINCT trim(col.codigo_proveedor::text) AS code
        FROM public.registro_st_vt_rc_reposicion s
        INNER JOIN public.color col
          ON col.id = s.color_id AND col.proveedor_id = $1
        WHERE ($2::int IS NULL OR s.tipo_v2_id = $2)
          AND NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL
        UNION
        SELECT DISTINCT trim(c.codigo_proveedor::text) AS code
        FROM public.color c
        INNER JOIN public.registro_st_vt_rc_reposicion s
          ON (
            NULLIF(btrim(s.excel_color_code::text), '') = trim(c.codigo_proveedor::text)
            OR (
              NULLIF(btrim(c.nombre), '') IS NOT NULL
              AND lower(btrim(s.excel_color_code::text)) = lower(btrim(c.nombre))
            )
          )
        WHERE c.proveedor_id = $1
          AND c.activo = true
          AND ($2::int IS NULL OR s.tipo_v2_id = $2)
          AND NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL
      )
      SELECT c.id, c.codigo_proveedor::text, c.nombre, c.tono_canon
      FROM color c
      LEFT JOIN img_codes img ON img.code = trim(c.codigo_proveedor::text)
      WHERE ${whereSql}
      ORDER BY
        CASE
          WHEN ${SQL_COLOR_SIN_TONO} AND img.code IS NULL THEN 1
          WHEN ${SQL_COLOR_SIN_TONO} AND img.code IS NOT NULL THEN 2
          WHEN ${SQL_COLOR_CON_TONO} AND img.code IS NULL THEN 3
          ELSE 4
        END,
        c.codigo_proveedor
      LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    ),
    pool.query<{ n: string }>(
      `
      SELECT COUNT(*)::text AS n
      FROM color c
      WHERE ${whereSql}
        AND ($2::int IS NULL OR TRUE)
      `,
      params,
    ),
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

/**
 * Primera fila retail con imagen por código de color exacto (excel_color_code o color.codigo_proveedor).
 * FOCO 2.3.5.5.2 — preview para asignar tono en /pilares/color.
 */
export async function loadPrimeraImagenPorColorCode(
  pool: Pool,
  colorCodes: string[],
  tipoV2Id?: TipoV2Id,
): Promise<Map<string, import("./types").ColorThumb>> {
  const out = new Map<string, import("./types").ColorThumb>();
  const codes = Array.from(
    new Set(colorCodes.map((c) => String(c ?? "").trim()).filter(Boolean)),
  );
  if (!codes.length) return out;

  // Join por color_id (índice) + excel solo para códigos sin FK.
  // Evita OR EXISTS sobre registro_st_vt_rc_reposicion (15–50s con 500 códigos).
  const proveedorId =
    tipoV2Id === 1 || tipoV2Id === 2 ? proveedorIdFromTipoV2(tipoV2Id) : null;

  const { rows } = await pool.query<{
    color_code: string;
    linea_codigo: string;
    referencia_codigo: string;
    material_code: string;
    imagen_nombre: string | null;
    excel_color_code: string | null;
  }>(
    `
    WITH codes AS (
      SELECT DISTINCT btrim(u) AS color_code
      FROM unnest($1::text[]) AS u
      WHERE NULLIF(btrim(u), '') IS NOT NULL
    ),
    mapped AS (
      SELECT c.color_code, col.id AS color_id
      FROM codes c
      INNER JOIN public.color col
        ON trim(col.codigo_proveedor::text) = c.color_code
       AND ($3::int IS NULL OR col.proveedor_id = $3)
    ),
    by_fk AS (
      SELECT DISTINCT ON (m.color_code)
        m.color_code,
        btrim(s.linea_codigo_proveedor::text) AS linea_codigo,
        btrim(s.referencia_codigo_proveedor::text) AS referencia_codigo,
        COALESCE(
          NULLIF(btrim(s.excel_material_code::text), ''),
          CASE
            WHEN mat.id IS NULL THEN NULL
            WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
            ELSE trim(mat.codigo_proveedor::text)
          END,
          ''
        ) AS material_code,
        NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
        NULLIF(btrim(s.excel_color_code::text), '') AS excel_color_code
      FROM mapped m
      INNER JOIN public.registro_st_vt_rc_reposicion s
        ON s.color_id = m.color_id
      LEFT JOIN public.material mat ON mat.id = s.material_id
      WHERE ($2::int IS NULL OR s.tipo_v2_id = $2)
      ORDER BY
        m.color_code,
        (CASE WHEN NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL THEN 0 ELSE 1 END),
        s.id
    ),
    missing AS (
      SELECT c.color_code
      FROM codes c
      WHERE NOT EXISTS (SELECT 1 FROM by_fk f WHERE f.color_code = c.color_code)
    ),
    by_excel AS (
      SELECT DISTINCT ON (m.color_code)
        m.color_code,
        btrim(s.linea_codigo_proveedor::text) AS linea_codigo,
        btrim(s.referencia_codigo_proveedor::text) AS referencia_codigo,
        COALESCE(
          NULLIF(btrim(s.excel_material_code::text), ''),
          CASE
            WHEN mat.id IS NULL THEN NULL
            WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
            ELSE trim(mat.codigo_proveedor::text)
          END,
          ''
        ) AS material_code,
        NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
        NULLIF(btrim(s.excel_color_code::text), '') AS excel_color_code
      FROM missing m
      INNER JOIN public.color col
        ON trim(col.codigo_proveedor::text) = m.color_code
       AND ($3::int IS NULL OR col.proveedor_id = $3)
      INNER JOIN public.registro_st_vt_rc_reposicion s
        ON (
          NULLIF(btrim(s.excel_color_code::text), '') = m.color_code
          OR (
            NULLIF(btrim(col.nombre), '') IS NOT NULL
            AND lower(btrim(s.excel_color_code::text)) = lower(btrim(col.nombre))
          )
        )
      LEFT JOIN public.material mat ON mat.id = s.material_id
      WHERE ($2::int IS NULL OR s.tipo_v2_id = $2)
      ORDER BY
        m.color_code,
        (CASE WHEN NULLIF(btrim(s.imagen_nombre::text), '') IS NOT NULL THEN 0 ELSE 1 END),
        s.id
    )
    SELECT * FROM by_fk
    UNION ALL
    SELECT * FROM by_excel
    `,
    [codes, tipoV2Id ?? null, proveedorId],
  );

  for (const r of rows) {
    out.set(r.color_code, {
      color_code: r.color_code,
      linea_codigo: r.linea_codigo ?? "",
      referencia_codigo: r.referencia_codigo ?? "",
      material_code: r.material_code ?? "",
      imagen_nombre: r.imagen_nombre,
      excel_color_code: r.excel_color_code,
    });
  }
  return out;
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

/** Nombre proveedor — solo si aporta texto; no vacía nombre existente (no inverso). */
export async function patchColorNombre(
  pool: Pool,
  id: number,
  proveedorId: number,
  nombre: string,
): Promise<boolean> {
  const n = nombre.trim();
  if (!n) return false;
  const res = await pool.query(
    `
    UPDATE color
    SET nombre = $3
    WHERE id = $1
      AND proveedor_id = $2
      AND (nombre IS NULL OR btrim(nombre) = '')
    `,
    [id, proveedorId, n],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Mismo predominante (1er token nombre) → tono_canon idéntico en lote. */
export async function patchColorByPredominante(
  pool: Pool,
  proveedorId: number,
  predominante: string,
  tonoCanon: Record<string, unknown> | null,
): Promise<number> {
  const { colorPredominante } = await import("./color-canon");
  const target = predominante.trim().toLowerCase();
  if (!target) return 0;

  const { rows } = await pool.query<{ id: number; nombre: string | null }>(
    `SELECT id, nombre FROM color WHERE proveedor_id = $1 AND activo = true`,
    [proveedorId],
  );

  const ids = rows
    .filter((r) => colorPredominante(r.nombre).trim().toLowerCase() === target)
    .map((r) => r.id);
  if (!ids.length) return 0;

  const res = await pool.query(
    `UPDATE color SET tono_canon = $1::jsonb WHERE proveedor_id = $2 AND id = ANY($3::int[])`,
    [tonoCanon ? JSON.stringify(tonoCanon) : null, proveedorId, ids],
  );
  return res.rowCount ?? 0;
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
  if (opts.soloSinTono) {
    const { SQL_COLOR_SIN_TONO } = await import("./color-canon");
    where.push(SQL_COLOR_SIN_TONO);
  }

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

  const { estandarToTono, isAutoSuggestable, sugerirColorEstandarFromCatalog, sugerirColorEstandar } =
    await import("./colores-estandar");
  const sugerir = (nombre: string | null) =>
    opts.catalog ? sugerirColorEstandarFromCatalog(nombre, opts.catalog) : sugerirColorEstandar(nombre);
  let updated = 0;
  for (const row of rows) {
    const std = sugerir(row.nombre);
    if (!std || !isAutoSuggestable(std)) continue;
    const tono = estandarToTono(std);
    const ok = await patchColorTono(pool, row.id, proveedorId, tono);
    if (ok) updated += 1;
  }
  return updated;
}

/** Sugiere tono_canon masivo desde color.nombre (multilingüe → etiqueta ES). */
export async function suggestTonoCanonBulk(
  pool: Pool,
  proveedorId: number,
  catalog: import("./colores-estandar").ColorEstandar[],
): Promise<number> {
  const { SQL_COLOR_SIN_TONO } = await import("./color-canon");
  const { rows } = await pool.query<{ id: number; nombre: string | null }>(
    `
    SELECT c.id, c.nombre
    FROM color c
    WHERE c.proveedor_id = $1 AND c.activo = true
      AND ${SQL_COLOR_SIN_TONO}
      AND c.nombre IS NOT NULL AND btrim(c.nombre) <> ''
    ORDER BY c.codigo_proveedor
    `,
    [proveedorId],
  );

  const { estandarToTono, isAutoSuggestable, sugerirColorEstandarFromCatalog } = await import("./colores-estandar");
  let updated = 0;
  for (const row of rows) {
    const std = sugerirColorEstandarFromCatalog(row.nombre, catalog);
    if (!std || !isAutoSuggestable(std)) continue;
    const ok = await patchColorTono(pool, row.id, proveedorId, estandarToTono(std));
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

/** Lectura liviana del catálogo + uso en memoria (sin INSERT/UPDATE masivos). */
export async function loadColoresEstandar(
  pool: Pool,
  proveedorId: number,
): Promise<import("./colores-estandar").ColorEstandar[]> {
  await ensureColorTonoEstandarTable(pool);
  await seedColorTonoEstandarIfEmpty(pool, proveedorId);

  const { COLORES_ESTANDAR_DEFAULT, computeUsoPorEstandar, ordenarCatalogoPorUso, rowToColorEstandar } =
    await import("./colores-estandar");

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

  let catalog = catRes.rows.map(rowToColorEstandar);
  if (!catalog.length) {
    catalog = COLORES_ESTANDAR_DEFAULT.map((c, i) => ({ ...c, orden: (i + 1) * 10, uso_count: 0 }));
  }
  const uso = computeUsoPorEstandar(allColors.rows, catalog);
  const sorted = ordenarCatalogoPorUso(catalog, uso);

  return sorted.map((c, i) => {
    const def = COLORES_ESTANDAR_DEFAULT.find((d) => d.etiqueta === c.etiqueta);
    return {
      ...c,
      multicolor: def?.multicolor,
      swatches: def?.swatches,
      orden: i + 1,
      uso_count: uso.get(c.etiqueta) ?? 0,
    };
  });
}

/** Persistencia pesada de hex/aliases/orden — solo cuando hace falta sincronizar canónicos. */
export async function loadAndRecalcColoresEstandar(
  pool: Pool,
  proveedorId: number,
): Promise<import("./colores-estandar").ColorEstandar[]> {
  await ensureColorTonoEstandarTable(pool);
  await seedColorTonoEstandarIfEmpty(pool, proveedorId);

  const { COLORES_ESTANDAR_DEFAULT, computeUsoPorEstandar, ordenarCatalogoPorUso, rowToColorEstandar } =
    await import("./colores-estandar");

  for (let i = 0; i < COLORES_ESTANDAR_DEFAULT.length; i++) {
    const c = COLORES_ESTANDAR_DEFAULT[i];
    await pool.query(
      `
      INSERT INTO color_tono_estandar (proveedor_id, etiqueta, hex, aliases, orden)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (proveedor_id, etiqueta) DO UPDATE SET
        hex = EXCLUDED.hex,
        aliases = EXCLUDED.aliases,
        updated_at = now()
      `,
      [proveedorId, c.etiqueta, c.hex, JSON.stringify(c.aliases), (i + 1) * 10],
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

  return sorted.map((c, i) => {
    const def = COLORES_ESTANDAR_DEFAULT.find((d) => d.etiqueta === c.etiqueta);
    return {
      ...c,
      multicolor: def?.multicolor,
      swatches: def?.swatches,
      orden: i + 1,
      uso_count: uso.get(c.etiqueta) ?? 0,
    };
  });
}
