/**
 * Depósito Web → DepositoRow[] (paridad PE / grilla siamese).
 * CTE agrega stock antes de JOIN pilares · tipo_v2 desde proveedor_id (654/638).
 */
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { getRimecPool } from "@/lib/rimec/pool";
import { normalizeDepositoRow } from "@/lib/depositos/operativa-filters";
import { ALM_WEB_BAZAR } from "@/lib/bazzar-web/compra-web/constants";

const TIPO_V2_SQL = `
  CASE l.proveedor_id
    WHEN 654 THEN 'Calzado'
    WHEN 638 THEN 'Confecciones'
    ELSE '(sin tipo)'
  END
`;

const TIPO_V2_ID_SQL = `
  CASE l.proveedor_id
    WHEN 654 THEN 1
    WHEN 638 THEN 2
    ELSE NULL
  END
`;

type SqlDepositoRow = {
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  material_code: string;
  color_code: string;
  material_id: number | string;
  color_id: number | string;
  linea_id: number | string | null;
  referencia_id: number | string | null;
  marca: string;
  marca_id: number | string | null;
  genero: string;
  genero_id: number | string | null;
  estilo: string;
  grupo_estilo_id: number | string | null;
  tipo_v2: string;
  tipo_v2_id: number | string | null;
  tipo_1: string | null;
  tipo_1_id: number | string | null;
  cod_grupo: string | null;
  sdrm_tipo1: string | null;
  tono_etiqueta: string | null;
  descp_material: string | null;
  descp_color: string | null;
  grada: string;
  cantidad: number | string;
  imagen_nombre: string | null;
  imagen_color_excel: string | null;
  precio_unitario: number | string | null;
};

function mapSqlRow(r: SqlDepositoRow): DepositoRow {
  const base = {
    linea_codigo_proveedor: String(r.linea_codigo_proveedor ?? ""),
    referencia_codigo_proveedor: String(r.referencia_codigo_proveedor ?? ""),
    material_code: String(r.material_code ?? "0"),
    color_code: String(r.color_code ?? "0"),
    material_id: Number(r.material_id) || 0,
    color_id: Number(r.color_id) || 0,
    linea_id: r.linea_id != null ? Number(r.linea_id) : null,
    referencia_id: r.referencia_id != null ? Number(r.referencia_id) : null,
    marca: r.marca ?? "—",
    marca_id: r.marca_id != null ? Number(r.marca_id) : null,
    genero: r.genero ?? "",
    genero_id: r.genero_id != null ? Number(r.genero_id) : null,
    estilo: r.estilo ?? "",
    grupo_estilo_id: r.grupo_estilo_id != null ? Number(r.grupo_estilo_id) : null,
    tipo_v2: r.tipo_v2 ?? "",
    tipo_v2_id: r.tipo_v2_id != null ? Number(r.tipo_v2_id) : null,
    tipo_1: r.tipo_1,
    tipo_1_id: r.tipo_1_id != null ? Number(r.tipo_1_id) : null,
    cod_grupo: r.cod_grupo ? String(r.cod_grupo).trim() : null,
    tono_etiqueta: r.tono_etiqueta,
    descp_material: r.descp_material,
    descp_color: r.descp_color,
    grada: r.grada ?? "—",
    cantidad: Number(r.cantidad) || 0,
    imagen_nombre: r.imagen_nombre,
    imagen_color_excel: r.imagen_color_excel,
    precio_unitario:
      r.precio_unitario != null && Number(r.precio_unitario) > 0
        ? Number(r.precio_unitario)
        : null,
  } as DepositoRow & { sdrm_tipo1?: string | null };
  if (r.sdrm_tipo1) {
    (base as DepositoRow & { sdrm_tipo1?: string }).sdrm_tipo1 = String(r.sdrm_tipo1).trim();
  }
  return normalizeDepositoRow(base);
}

/** Tipología AB-CR: linea_referencia + tipo_1; COD.GRUPO desde PE si hay match L+R. */
const TIPOLOGIA_SELECT = `
  COALESCE(
    NULLIF(btrim(t1.descp_tipo_1::text), ''),
    NULLIF(btrim(pe_tip.descp_tipo_1::text), ''),
    NULL
  ) AS tipo_1,
  COALESCE(lr.tipo_1_id, pe_tip.tipo_1_id)::int AS tipo_1_id,
  NULLIF(btrim(pe_tip.cod_grupo::text), '') AS cod_grupo,
  NULLIF(btrim(pe_tip.sdrm_tipo1::text), '') AS sdrm_tipo1
`;

const TIPOLOGIA_JOINS = `
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = r.id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN LATERAL (
      SELECT pe.cod_grupo, pe.sdrm_tipo1, pe.tipo_1_id, pe.descp_tipo_1
      FROM v_stock_pe_rimec pe
      WHERE pe.linea_codigo::text = l.codigo_proveedor::text
        AND pe.referencia_codigo::text = r.codigo_proveedor::text
      ORDER BY pe.cod_grupo NULLS LAST
      LIMIT 1
    ) pe_tip ON true
`;

const MATERIAL_CODE_SQL = `
  CASE
    WHEN mat.id IS NULL THEN '0'
    WHEN mat.codigo_proveedor = -999001::bigint THEN '0'
    ELSE trim(mat.codigo_proveedor::text)
  END
`;

const COLOR_CODE_SQL = `
  CASE
    WHEN col.id IS NULL THEN '0'
    WHEN col.codigo_proveedor = -999001::bigint THEN '0'
    ELSE trim(col.codigo_proveedor::text)
  END
`;

/**
 * PE tiene la foto con material/color Excel correctos; ALM post-compra
 * a menudo trae otro codigo pilar (313 vs 15758, 8553 vs 0460).
 * Match amplio + orden: color → descp color → material → descp material.
 */
const PE_IMG_LATERAL_INGRESO = `
    LEFT JOIN LATERAL (
      SELECT v.imagen_url, v.color_code AS pe_color_code
      FROM v_stock_pe_rimec v
      WHERE v.linea_codigo::text = l.codigo_proveedor::text
        AND v.referencia_codigo::text = r.codigo_proveedor::text
        AND NULLIF(btrim(v.imagen_url::text), '') IS NOT NULL
        AND (
          NULLIF(btrim(v.color_code::text), '') = NULLIF(btrim(col.codigo_proveedor::text), '')
          OR NULLIF(btrim(v.material_code::text), '') = NULLIF(btrim(mat.codigo_proveedor::text), '')
          OR lower(btrim(COALESCE(v.descp_color, ''))) = lower(btrim(COALESCE(col.nombre::text, '')))
          OR (
            NULLIF(btrim(col.nombre::text), '') IS NOT NULL
            AND lower(btrim(COALESCE(v.descp_color, '')))
              LIKE lower(split_part(btrim(col.nombre::text), '/', 1)) || '%'
          )
          OR lower(btrim(COALESCE(v.descp_material, ''))) = lower(btrim(COALESCE(mat.descripcion::text, '')))
        )
      ORDER BY
        CASE WHEN NULLIF(btrim(v.color_code::text), '') = NULLIF(btrim(col.codigo_proveedor::text), '')
          THEN 0 ELSE 1 END,
        CASE WHEN lower(btrim(COALESCE(v.descp_color, ''))) = lower(btrim(COALESCE(col.nombre::text, '')))
          THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(col.nombre::text), '') IS NOT NULL
          AND lower(btrim(COALESCE(v.descp_color, '')))
            LIKE lower(split_part(btrim(col.nombre::text), '/', 1)) || '%'
          THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(v.material_code::text), '') = NULLIF(btrim(mat.codigo_proveedor::text), '')
          THEN 0 ELSE 1 END,
        CASE WHEN lower(btrim(COALESCE(v.descp_material, ''))) = lower(btrim(COALESCE(mat.descripcion::text, '')))
          THEN 0 ELSE 1 END,
        v.imagen_url NULLS LAST
      LIMIT 1
    ) pe_img ON true
`;

const PE_IMG_LATERAL_VENDIBLE = `
    LEFT JOIN LATERAL (
      SELECT pe.imagen_url, pe.color_code AS pe_color_code
      FROM v_stock_pe_rimec pe
      WHERE pe.linea_codigo::text = v.linea_codigo::text
        AND pe.referencia_codigo::text = v.referencia_codigo::text
        AND NULLIF(btrim(pe.imagen_url::text), '') IS NOT NULL
        AND (
          NULLIF(btrim(pe.color_code::text), '') = NULLIF(btrim(v.color_code::text), '')
          OR NULLIF(btrim(pe.material_code::text), '') = NULLIF(btrim(v.material_code::text), '')
          OR lower(btrim(COALESCE(pe.descp_color, ''))) = lower(btrim(COALESCE(v.color_nombre, '')))
          OR (
            NULLIF(btrim(v.color_nombre::text), '') IS NOT NULL
            AND lower(btrim(COALESCE(pe.descp_color, '')))
              LIKE lower(split_part(btrim(v.color_nombre::text), '/', 1)) || '%'
          )
          OR lower(btrim(COALESCE(pe.descp_material, ''))) = lower(btrim(COALESCE(v.material_descripcion, '')))
        )
      ORDER BY
        CASE WHEN NULLIF(btrim(pe.color_code::text), '') = NULLIF(btrim(v.color_code::text), '')
          THEN 0 ELSE 1 END,
        CASE WHEN lower(btrim(COALESCE(pe.descp_color, ''))) = lower(btrim(COALESCE(v.color_nombre, '')))
          THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(v.color_nombre::text), '') IS NOT NULL
          AND lower(btrim(COALESCE(pe.descp_color, '')))
            LIKE lower(split_part(btrim(v.color_nombre::text), '/', 1)) || '%'
          THEN 0 ELSE 1 END,
        CASE WHEN NULLIF(btrim(pe.material_code::text), '') = NULLIF(btrim(v.material_code::text), '')
          THEN 0 ELSE 1 END,
        CASE WHEN lower(btrim(COALESCE(pe.descp_material, ''))) = lower(btrim(COALESCE(v.material_descripcion, '')))
          THEN 0 ELSE 1 END,
        pe.imagen_url NULLS LAST
      LIMIT 1
    ) pe_img ON true
`;

export async function getDepositoRowsIngreso(): Promise<DepositoRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<SqlDepositoRow>(
    `
    WITH stock_talla AS (
      SELECT
        md.combinacion_id,
        SUM(md.cantidad * md.signo)::float8 AS cantidad
      FROM movimiento_detalle md
      JOIN movimiento m ON m.id = md.movimiento_id
      WHERE m.almacen_destino_id = $1
        AND m.estado = 'CONFIRMADO'
        AND m.tipo = 'INGRESO_COMPRA'
      GROUP BY md.combinacion_id
      HAVING SUM(md.cantidad * md.signo) > 0
    )
    SELECT
      l.codigo_proveedor::text AS linea_codigo_proveedor,
      r.codigo_proveedor::text AS referencia_codigo_proveedor,
      ${MATERIAL_CODE_SQL} AS material_code,
      ${COLOR_CODE_SQL} AS color_code,
      COALESCE(c.material_id, 0) AS material_id,
      COALESCE(c.color_id, 0) AS color_id,
      l.id AS linea_id,
      r.id AS referencia_id,
      COALESCE(mv.descp_marca, '—') AS marca,
      l.marca_id,
      COALESCE(NULLIF(btrim(g.descripcion::text), ''), NULLIF(btrim(g.codigo::text), ''), '(sin género)') AS genero,
      l.genero_id,
      COALESCE(NULLIF(btrim(ge.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,
      l.grupo_estilo_id,
      ${TIPO_V2_SQL} AS tipo_v2,
      ${TIPO_V2_ID_SQL} AS tipo_v2_id,
      ${TIPOLOGIA_SELECT},
      NULLIF(btrim(col.tono_canon->>'etiqueta'), '') AS tono_etiqueta,
      NULLIF(btrim(mat.descripcion::text), '') AS descp_material,
      NULLIF(btrim(col.nombre::text), '') AS descp_color,
      -- 638: color Excel/PE (no nombre ni FK hash ALM)
      CASE
        WHEN l.proveedor_id = 638 THEN COALESCE(
          NULLIF(btrim(pe_img.pe_color_code::text), ''),
          NULLIF(btrim(pw.id_color_f9::text), ''),
          NULLIF(btrim(pw.ppd_color_codigo::text), ''),
          NULLIF(btrim(col.codigo_proveedor::text), '')
        )
        ELSE NULLIF(btrim(col.nombre::text), '')
      END AS imagen_color_excel,
      -- Solo URL/stem PE real — prohibido inventar L-R-M-C con códigos ALM rotos
      NULLIF(btrim(pe_img.imagen_url::text), '') AS imagen_nombre,
      tl.talla_etiqueta AS grada,
      st.cantidad,
      NULLIF(pw.precio_web, 0)::float8 AS precio_unitario
    FROM stock_talla st
    JOIN combinacion c ON c.id = st.combinacion_id
    JOIN linea l ON l.id = c.linea_id
    JOIN referencia r ON r.id = c.referencia_id
    LEFT JOIN material mat ON mat.id = c.material_id
    LEFT JOIN color col ON col.id = c.color_id
    JOIN talla tl ON tl.id = c.talla_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    LEFT JOIN genero g ON g.id = l.genero_id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = l.grupo_estilo_id
    ${TIPOLOGIA_JOINS}
    LEFT JOIN LATERAL (
      SELECT v.precio_web, v.id_color_f9, v.ppd_color_codigo
      FROM v_stock_web v
      WHERE v.combinacion_id = c.id
      ORDER BY CASE WHEN COALESCE(v.precio_web, 0) > 0 THEN 0 ELSE 1 END
      LIMIT 1
    ) pw ON true
    ${PE_IMG_LATERAL_INGRESO}
    ORDER BY mv.descp_marca, l.codigo_proveedor, r.codigo_proveedor, tl.talla_etiqueta
    `,
    [ALM_WEB_BAZAR],
  );
  return rows.map(mapSqlRow);
}

export async function getDepositoRowsVendible(): Promise<DepositoRow[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<SqlDepositoRow>(
    `
    SELECT
      v.linea_codigo AS linea_codigo_proveedor,
      v.referencia_codigo AS referencia_codigo_proveedor,
      COALESCE(NULLIF(btrim(v.material_code::text), ''), '0') AS material_code,
      COALESCE(NULLIF(btrim(v.color_code::text), ''), '0') AS color_code,
      COALESCE(v.material_id, 0) AS material_id,
      COALESCE(v.color_id, 0) AS color_id,
      v.linea_id,
      v.referencia_id,
      COALESCE(v.marca, '—') AS marca,
      l.marca_id,
      COALESCE(NULLIF(btrim(v.descp_genero::text), ''), '(sin género)') AS genero,
      v.genero_id,
      COALESCE(NULLIF(btrim(v.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,
      v.grupo_estilo_id,
      ${TIPO_V2_SQL} AS tipo_v2,
      ${TIPO_V2_ID_SQL} AS tipo_v2_id,
      ${TIPOLOGIA_SELECT},
      NULL::text AS tono_etiqueta,
      NULLIF(btrim(v.material_descripcion::text), '') AS descp_material,
      NULLIF(btrim(v.color_nombre::text), '') AS descp_color,
      CASE
        WHEN l.proveedor_id = 638 THEN COALESCE(
          NULLIF(btrim(pe_img.pe_color_code::text), ''),
          NULLIF(btrim(v.id_color_f9::text), ''),
          NULLIF(btrim(v.ppd_color_codigo::text), ''),
          NULLIF(btrim(v.color_code::text), '')
        )
        ELSE NULLIF(btrim(v.color_nombre::text), '')
      END AS imagen_color_excel,
      NULLIF(btrim(pe_img.imagen_url::text), '') AS imagen_nombre,
      v.talla_codigo AS grada,
      v.stock_web::float8 AS cantidad,
      COALESCE(v.precio_web, 0)::float8 AS precio_unitario
    FROM v_stock_web v
    JOIN linea l ON l.id = v.linea_id
    JOIN referencia r ON r.id = v.referencia_id
    ${TIPOLOGIA_JOINS}
    ${PE_IMG_LATERAL_VENDIBLE}
    WHERE v.stock_web > 0
    ORDER BY v.marca, v.linea_codigo, v.referencia_codigo, v.talla_codigo
    `,
  );
  return rows.map(mapSqlRow);
}
