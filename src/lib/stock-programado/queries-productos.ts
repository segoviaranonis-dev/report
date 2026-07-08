import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

import type { Pool } from "pg";

import { gradaCurvaImportadora } from "@/lib/depositos/grada-importadora-display";

import { parseLpnPrecioVenta } from "@/lib/depositos/precio-venta";

import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";

import { SQL_PP_CATEGORIA_CTE, sqlFilterPpCategoria } from "@/lib/stock-programado/pp-categoria-sql";



/** Vendido canónico — alineado con queries-resumen y Ala Norte. */

const PPD_VENDIDO_EXPR = `

  GREATEST(

    COALESCE(ppd.pares_vendidos, 0),

    COALESCE((

      SELECT SUM(vt.cantidad_vendida)

      FROM venta_transito vt

      WHERE vt.pedido_proveedor_detalle_id = ppd.id

    ), 0)

  )

`;



const PPD_SALDO_EXPR = `

  GREATEST(0, COALESCE(ppd.cantidad_pares, 0) - (${PPD_VENDIDO_EXPR}))

`;



/**

 * Programado — grilla Report desde PPD (sin catálogo RIMEC Web / v_stock_rimec).

 * v_stock_rimec = solo categoria_id=2 · EN_TRANSITO (MIG-138).

 */

export async function listProgramadoProductos(

  pool: Pool,

  opts?: { quincena_id?: number; pp_id?: number },

): Promise<{ productos: DepositoRow[]; cajas: number; pares: number; pares_vendidos: number }> {

  const params: unknown[] = [];

  const filters: string[] = [

    "ppd.linea IS NOT NULL",

    "ppd.referencia IS NOT NULL",

    sqlFilterPpCategoria(CATEGORIA_PROGRAMADO_ID),

    `(${PPD_SALDO_EXPR} > 0 OR ${PPD_VENDIDO_EXPR} > 0)`,

  ];



  if (opts?.quincena_id != null && Number.isFinite(opts.quincena_id)) {

    params.push(opts.quincena_id);

    filters.push(`pp.quincena_arribo_id = $${params.length}`);

  }

  if (opts?.pp_id != null && Number.isFinite(opts.pp_id)) {

    params.push(opts.pp_id);

    filters.push(`ppd.pedido_proveedor_id = $${params.length}`);

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

    grada_raw: string;

    grades_json: unknown;

    cantidad: string;

    cantidad_inicial: string;

    pares_vendidos: string;

    linea_id: string | null;

    referencia_id: string | null;

    marca_id: string | null;

    genero_id: string | null;

    grupo_estilo_id: string | null;

    tipo_1_id: string | null;

    tipo_v2_id: string | null;

    lpn: string | null;

    quincena_arribo_id: string | null;

    quincena_desc: string | null;

    pp_id: string | null;

    pp_nro: string | null;

    proforma: string | null;

    caso_precio: string | null;

  }>(

    `

    WITH ${SQL_PP_CATEGORIA_CTE}

    SELECT

      COALESCE(ppd.linea, '') AS linea,

      COALESCE(ppd.referencia, '') AS referencia,

      COALESCE(ppd.material_code, '0') AS material_code,

      COALESCE(ppd.color_code, '0') AS color_code,

      COALESCE(mv.descp_marca, '—') AS marca,

      COALESCE(NULLIF(TRIM(g.descripcion), ''), '(sin género)') AS genero,

      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), '(sin estilo)') AS estilo,

      'Calzado' AS tipo_v2,

      COALESCE(NULLIF(TRIM(t1.descp_tipo_1), ''), '(sin tipo 1)') AS tipo_1,

      ppd.descp_material,

      ppd.descp_color,

      COALESCE(NULLIF(TRIM(ppd.grada), ''), '—') AS grada_raw,

      ppd.grades_json,

      (${PPD_SALDO_EXPR})::text AS cantidad,

      COALESCE(ppd.cantidad_pares, 0)::text AS cantidad_inicial,

      (${PPD_VENDIDO_EXPR})::text AS pares_vendidos,

      COALESCE(l.id, lr.linea_id)::text AS linea_id,

      COALESCE(ref_j.id, lr.referencia_id)::text AS referencia_id,

      COALESCE(ppd.id_marca, l.marca_id)::text AS marca_id,

      l.genero_id::text AS genero_id,

      COALESCE(lr.grupo_estilo_id)::text AS grupo_estilo_id,

      lr.tipo_1_id::text AS tipo_1_id,

      '1'::text AS tipo_v2_id,

      pl.lpn::text,

      pp.quincena_arribo_id::text,

      COALESCE(qa.descripcion, 'Sin quincena') AS quincena_desc,

      pp.id::text AS pp_id,

      pp.numero_registro AS pp_nro,

      pp.numero_proforma AS proforma,

      COALESCE(pl.nombre_caso_aplicado, '') AS caso_precio

    FROM pedido_proveedor_detalle ppd

    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id

    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id

    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca

    LEFT JOIN material m ON m.codigo_proveedor::text = ppd.material_code

      AND m.proveedor_id = pp.proveedor_importacion_id

    LEFT JOIN linea l ON l.codigo_proveedor::text = ppd.linea

      AND l.proveedor_id = pp.proveedor_importacion_id

    LEFT JOIN referencia ref_j ON ref_j.codigo_proveedor::text = ppd.referencia

      AND ref_j.linea_id = l.id

    LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = ref_j.id

    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id

    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id

    LEFT JOIN genero g ON g.id = l.genero_id

    LEFT JOIN LATERAL (

      SELECT icp2.precio_evento_id

      FROM intencion_compra_pedido icp2

      JOIN intencion_compra ic2 ON ic2.id = icp2.intencion_compra_id

      WHERE icp2.pedido_proveedor_id = pp.id

        AND icp2.precio_evento_id IS NOT NULL

        AND (ppd.id_marca IS NULL OR ic2.id_marca = ppd.id_marca::bigint)

      ORDER BY (CASE WHEN ppd.id_marca IS NOT NULL AND ic2.id_marca = ppd.id_marca::bigint THEN 0 ELSE 1 END), icp2.id

      LIMIT 1

    ) ev ON true

    LEFT JOIN LATERAL (

      SELECT pl2.lpn, pl2.nombre_caso_aplicado

      FROM precio_lista pl2

      WHERE pl2.evento_id = ev.precio_evento_id

        AND pl2.linea_id = COALESCE(l.id, ref_j.linea_id)

        AND pl2.referencia_id = ref_j.id

        AND pl2.material_id = m.id

      LIMIT 1

    ) pl ON true

    ${where}

    ORDER BY pp.quincena_arribo_id NULLS LAST, pp.numero_registro, ppd.linea, ppd.referencia

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

    grada: gradaCurvaImportadora(r.grada_raw, r.grades_json),

    cantidad: Number(r.cantidad),

    imagen_nombre: null,

    linea_id: r.linea_id ? Number(r.linea_id) : null,

    referencia_id: r.referencia_id ? Number(r.referencia_id) : null,

    material_id: 0,

    color_id: 0,

    marca_id: r.marca_id ? Number(r.marca_id) : null,

    genero_id: r.genero_id ? Number(r.genero_id) : null,

    grupo_estilo_id: r.grupo_estilo_id ? Number(r.grupo_estilo_id) : null,

    tipo_1_id: r.tipo_1_id ? Number(r.tipo_1_id) : null,

    tipo_v2_id: r.tipo_v2_id ? Number(r.tipo_v2_id) : 1,

    tono_etiqueta: null,

    tipo_1: r.tipo_1,

    precio_unitario: parseLpnPrecioVenta(r.lpn),

    quincena_arribo_id: r.quincena_arribo_id ? Number(r.quincena_arribo_id) : null,

    quincena_desc: r.quincena_desc,

    pp_id: r.pp_id ? Number(r.pp_id) : null,

    pp_nro: r.pp_nro,

    proforma: r.proforma,

    caso_precio: r.caso_precio || null,

    cantidad_inicial: Number(r.cantidad_inicial),

    pares_vendidos: Number(r.pares_vendidos),

  }));



  const cajas = new Set(

    productos.map(

      (p) =>

        `${p.pp_id}-${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}-${p.grada}`,

    ),

  ).size;

  const pares = productos.reduce((a, p) => a + p.cantidad, 0);

  const pares_vendidos = productos.reduce((a, p) => a + (p.pares_vendidos ?? 0), 0);



  return { productos, cajas, pares, pares_vendidos };

}

