import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { Pool } from "pg";
import { resolveDepositoCodigo } from "@/lib/deposito-rimec/rimec-csv-sdrm";
import {
  PE_CODIGO_BARRAS_EXPR,
  PE_DEPOSITO_COL_EXPR,
  PE_PPD_FROM,
  PE_SALDO_EXPR,
  PE_TIPO_V2_EXPR,
} from "@/lib/stock-pronta-entrega/pe-ppd-sql";

/** Productos con saldo PP → filas operativas (grilla tablet). */
export async function listProcesoProductos(
  pool: Pool,
  compraLegalId?: number,
): Promise<{ productos: DepositoRow[]; cajas: number; pares: number }> {
  const params: unknown[] = [];
  let clFilter = "";
  if (compraLegalId != null && Number.isFinite(compraLegalId)) {
    params.push(compraLegalId);
    clFilter = `
      AND pp.id IN (
        SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp WHERE clp.compra_legal_id = $1
      )
    `;
  } else {
    clFilter = `AND pp.estado_transito = 'EN_DEPOSITO'`;
  }

  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    marca: string;
    descp_material: string | null;
    descp_color: string | null;
    grada: string | null;
    cantidad: string;
  }>(
    `
    SELECT
      ppd.linea,
      ppd.referencia,
      COALESCE(ppd.material::text, '0') AS material_code,
      COALESCE(ppd.color::text, '0') AS color_code,
      COALESCE(mv.descp_marca, '—') AS marca,
      ppd.descp_material,
      ppd.descp_color,
      COALESCE(ppd.grada, '—') AS grada,
      (
        COALESCE(ppd.cantidad_pares, 0) - GREATEST(
          COALESCE(ppd.pares_vendidos, 0),
          COALESCE(SUM(vt.cantidad_vendida), 0)
        )
      )::text AS cantidad
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN venta_transito vt ON vt.pedido_proveedor_detalle_id = ppd.id
    WHERE ppd.referencia IS NOT NULL
      ${clFilter}
    GROUP BY ppd.id, mv.descp_marca, ppd.linea, ppd.referencia, ppd.material, ppd.color,
             ppd.descp_material, ppd.descp_color, ppd.grada,
             ppd.cantidad_pares, ppd.pares_vendidos
    HAVING (
      COALESCE(ppd.cantidad_pares, 0) - GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE(SUM(vt.cantidad_vendida), 0)
      )
    ) > 0
    ORDER BY ppd.linea, ppd.referencia
    LIMIT 8000
    `,
    params,
  );

  const productos: DepositoRow[] = rows.map((r) => ({
    linea_codigo_proveedor: String(r.linea ?? ""),
    referencia_codigo_proveedor: String(r.referencia ?? ""),
    material_code: String(r.material_code),
    color_code: String(r.color_code),
    marca: r.marca,
    genero: "",
    estilo: "",
    tipo_v2: "",
    descp_material: r.descp_material,
    descp_color: r.descp_color,
    grada: r.grada ?? "—",
    cantidad: Number(r.cantidad),
    imagen_nombre: null,
    linea_id: null,
    referencia_id: null,
    material_id: 0,
    color_id: 0,
    marca_id: null,
    genero_id: null,
    grupo_estilo_id: null,
    tipo_1_id: null,
    tipo_v2_id: null,
    tono_etiqueta: null,
    tipo_1: null,
    precio_unitario: null,
  }));

  const cajas = new Set(
    productos.map(
      (p) =>
        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
    ),
  ).size;
  const pares = productos.reduce((a, p) => a + p.cantidad, 0);

  return { productos, cajas, pares };
}

/**
 * Stock PE Alejandro Magno → grilla tablet (PPD único).
 */
export async function listImportadoProductos(
  pool: Pool,
  opts?: { deposito?: string; batch?: string; tipo_v2?: 1 | 2 },
): Promise<{ productos: DepositoRow[]; cajas: number; pares: number; batch: string | null }> {
  const params: unknown[] = [];
  const filters: string[] = [
    `pp.entidad_comercial = 'STOCK'`,
    `pp.deposito_codigo IS NOT NULL`,
    `pp.estado_transito = 'EN_DEPOSITO'`,
    `pp.categoria_id = 1`,
    `lower(trim(qa.descripcion)) = lower('Pronta entrega')`,
    `(${PE_SALDO_EXPR} > 0 OR COALESCE(ppd.pares_vendidos, 0) > 0)`,
  ];
  if (opts?.deposito) {
    const dep = resolveDepositoCodigo(opts.deposito);
    if (dep) {
      params.push(dep);
      filters.push(`pp.deposito_codigo = $${params.length}`);
    }
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`pp.numero_proforma = $${params.length}`);
  }
  if (opts?.tipo_v2 === 1 || opts?.tipo_v2 === 2) {
    params.push(opts.tipo_v2);
    filters.push(`${PE_TIPO_V2_EXPR} = $${params.length}`);
  }
  const where = `WHERE ${filters.join(" AND ")}`;

  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    marca: string;
    genero: string;
    estilo: string;
    tipo_v2: string;
    tipo_1: string;
    descp_material: string | null;
    descp_color: string | null;
    grada: string;
    cantidad: string;
    cantidad_inicial: string;
    pares_vendidos: string;
    precio: string;
    linea_id: string | null;
    referencia_id: string | null;
    material_id: string | null;
    color_id: string | null;
    marca_id: string | null;
    genero_id: string | null;
    grupo_estilo_id: string | null;
    tipo_1_id: string | null;
    batch_label: string;
    tipo_v2_id: string | null;
    tono_etiqueta: string | null;
    imagen_color_excel: string | null;
    deposito_codigo: string;
    columna_stock_legal: string | null;
    cod_grupo: string | null;
    sdrm_marca: string | null;
    cadena_comercial: string | null;
    es_liquidacion: boolean | null;
    caso_precio: string | null;
    caso_id: string | null;
    temporada: string | null;
  }>(
    `
    SELECT
      COALESCE(ppd.linea, split_part(${PE_CODIGO_BARRAS_EXPR}, '.', 1)) AS linea,
      COALESCE(ppd.referencia, split_part(${PE_CODIGO_BARRAS_EXPR}, '.', 2), '0') AS referencia,
      COALESCE(ppd.material_code, '0') AS material_code,
      COALESCE(ppd.color_code, '0') AS color_code,
      COALESCE(NULLIF(TRIM(mv.descp_marca), ''), 'RIMEC') AS marca,
      COALESCE(NULLIF(TRIM(g.descripcion), ''), NULLIF(TRIM(g.codigo::text), ''), '(sin género)') AS genero,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), '(sin estilo)') AS estilo,
      COALESCE(NULLIF(TRIM(tv.descp_tipo), ''), CASE ${PE_TIPO_V2_EXPR} WHEN 1 THEN 'Calzado' WHEN 2 THEN 'Confecciones' ELSE '—' END) AS tipo_v2,
      COALESCE(NULLIF(TRIM(t1.descp_tipo_1), ''), '(sin tipo 1)') AS tipo_1,
      ppd.descp_material,
      ppd.descp_color,
      COALESCE(NULLIF(TRIM(ppd.grada), ''), '—') AS grada,
      ${PE_SALDO_EXPR}::text AS cantidad,
      COALESCE(ppd.cantidad_pares, 0)::text AS cantidad_inicial,
      COALESCE(ppd.pares_vendidos, 0)::text AS pares_vendidos,
      COALESCE(ppd.unit_fob_ajustado, 0)::text AS precio,
      l.id::text AS linea_id,
      r.id::text AS referencia_id,
      mat.id::text AS material_id,
      col.id::text AS color_id,
      l.marca_id::text AS marca_id,
      l.genero_id::text AS genero_id,
      lr.grupo_estilo_id::text AS grupo_estilo_id,
      lr.tipo_1_id::text AS tipo_1_id,
      pp.numero_proforma AS batch_label,
      ${PE_TIPO_V2_EXPR}::text AS tipo_v2_id,
      NULLIF(TRIM(col.tono_canon->>'etiqueta'), '') AS tono_etiqueta,
      NULLIF(
        regexp_replace(
          COALESCE(pe_img.excel_color_code, col.nombre, ppd.descp_color, ''),
          '^[Kk]',
          ''
        ),
        ''
      ) AS imagen_color_excel,
      pp.deposito_codigo,
      ${PE_DEPOSITO_COL_EXPR} AS columna_stock_legal,
      COALESCE(sac.cod_grupo, cg.cod_grupo, pe_stg.cod_grupo) AS cod_grupo,
      COALESCE(sac.marca, cg.marca) AS sdrm_marca,
      COALESCE(ppd.am_cadena_comercial, sac.cadena_comercial, cg.cadena_comercial, 'REGULAR') AS cadena_comercial,
      CASE
        WHEN ppd.am_cadena_comercial IS NOT NULL THEN ppd.am_es_liquidacion
        ELSE COALESCE(sac.es_liquidacion, cg.es_liquidacion, false)
      END AS es_liquidacion,
      ppd.descp_caso_snapshot AS caso_precio,
      ppd.biblioteca_id::text AS caso_id,
      COALESCE(
        NULLIF(btrim(ppd.am_temporada), ''),
        NULLIF(btrim(t1.descp_tipo_1), '')
      ) AS temporada
    ${PE_PPD_FROM}
    LEFT JOIN linea l ON l.codigo_proveedor::text = ppd.linea AND l.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN referencia r ON r.codigo_proveedor::text = ppd.referencia AND r.linea_id = l.id
    LEFT JOIN material mat ON mat.codigo_proveedor::text = ppd.material_code AND mat.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN color col ON col.codigo_proveedor::text = ppd.color_code AND col.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(s.excel_color_code), '') AS excel_color_code
      FROM stock_pe_staging_migrated m
      JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
      WHERE m.ppd_id = ppd.id
      ORDER BY s.id
      LIMIT 1
    ) pe_img ON true
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(btrim(s.codigo_barras), '') AS codigo_barras,
        NULLIF(btrim(s.cod_grupo), '') AS cod_grupo
      FROM stock_pe_staging_migrated m
      JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
      WHERE m.ppd_id = ppd.id
      ORDER BY s.id
      LIMIT 1
    ) pe_stg ON true
    LEFT JOIN sdrm_articulo_comercial sac
      ON lower(btrim(sac.batch_label)) = lower(btrim(pp.numero_proforma))
     AND btrim(sac.codigo_barras) = btrim(pe_stg.codigo_barras)
    LEFT JOIN sdrm_cod_grupo_dim cg
      ON cg.cod_grupo = COALESCE(sac.cod_grupo, pe_stg.cod_grupo)
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN genero g ON g.id = l.genero_id
    LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = r.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN tipo_v2 tv ON tv.id_tipo = ${PE_TIPO_V2_EXPR}
    ${where}
    ORDER BY pp.deposito_codigo, ppd.linea, ppd.referencia
    LIMIT 15000
    `,
    params,
  );

  const productos: DepositoRow[] = rows.map((r) => ({
    linea_codigo_proveedor: r.linea,
    referencia_codigo_proveedor: r.referencia,
    material_code: r.material_code,
    color_code: r.color_code,
    marca: r.marca,
    genero: r.genero,
    estilo: r.estilo,
    tipo_v2: r.tipo_v2,
    descp_material: r.descp_material,
    descp_color: r.descp_color,
    grada: r.grada,
    cantidad: Number(r.cantidad),
    cantidad_inicial: Number(r.cantidad_inicial),
    pares_vendidos: Number(r.pares_vendidos),
    imagen_nombre: null,
    linea_id: r.linea_id ? Number(r.linea_id) : null,
    referencia_id: r.referencia_id ? Number(r.referencia_id) : null,
    material_id: r.material_id ? Number(r.material_id) : 0,
    color_id: r.color_id ? Number(r.color_id) : 0,
    marca_id: r.marca_id ? Number(r.marca_id) : null,
    genero_id: r.genero_id ? Number(r.genero_id) : null,
    grupo_estilo_id: r.grupo_estilo_id ? Number(r.grupo_estilo_id) : null,
    tipo_1_id: r.tipo_1_id ? Number(r.tipo_1_id) : null,
    tipo_v2_id: r.tipo_v2_id ? Number(r.tipo_v2_id) : null,
    tono_etiqueta: r.tono_etiqueta,
    imagen_color_excel: r.imagen_color_excel,
    tipo_1: r.tipo_1,
    precio_unitario: Number(r.precio) || null,
    deposito_codigo: r.deposito_codigo,
    columna_stock_legal: r.columna_stock_legal,
    cod_grupo: r.cod_grupo,
    sdrm_marca: r.sdrm_marca,
    cadena_comercial: r.cadena_comercial,
    es_liquidacion: r.es_liquidacion === true,
    caso_precio: r.caso_precio?.trim() || null,
    caso_id: r.caso_id ? Number(r.caso_id) : null,
    temporada: r.temporada,
  }));

  const cajas = new Set(
    productos.map(
      (p) =>
        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
    ),
  ).size;
  const pares = productos.reduce((a, p) => a + p.cantidad, 0);

  return {
    productos,
    cajas,
    pares,
    batch: rows[0]?.batch_label ?? null,
  };
}
