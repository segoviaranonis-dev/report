import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { Pool } from "pg";
import { gradaCurvaImportadora } from "@/lib/depositos/grada-importadora-display";
import { parseLpnPrecioVenta } from "@/lib/depositos/precio-venta";
import { SQL_PP_CATEGORIA_CTE, SQL_FILTER_COMPRA_PREVIA } from "@/lib/stock-programado/pp-categoria-sql";

/** Productos en tránsito (v_stock_rimec TRÁNSITO_PP) → grilla estrategia ventas Report. */
export async function listTransitoProductos(
  pool: Pool,
  opts?: { quincena_id?: number; pp_id?: number },
): Promise<{ productos: DepositoRow[]; cajas: number; pares: number; pares_vendidos: number }> {
  const params: unknown[] = [];
  const filters: string[] = [
    "v.origen_tipo = 'TRÁNSITO_PP'",
    "(v.saldo_pares > 0 OR COALESCE(v.pares_vendidos, 0) > 0)",
    SQL_FILTER_COMPRA_PREVIA,
  ];

  if (opts?.quincena_id != null && Number.isFinite(opts.quincena_id)) {
    params.push(opts.quincena_id);
    filters.push(`pp.quincena_arribo_id = $${params.length}`);
  }
  if (opts?.pp_id != null && Number.isFinite(opts.pp_id)) {
    params.push(opts.pp_id);
    filters.push(`v.pp_id = $${params.length}`);
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
      v.linea_codigo AS linea,
      v.referencia_codigo AS referencia,
      v.material_code,
      v.color_code,
      COALESCE(v.descp_marca, '—') AS marca,
      COALESCE(NULLIF(TRIM(g.descripcion), ''), '(sin género)') AS genero,
      COALESCE(NULLIF(TRIM(v.descp_grupo_estilo), ''), '(sin estilo)') AS estilo,
      'Calzado' AS tipo_v2,
      COALESCE(NULLIF(TRIM(v.descp_tipo_1), ''), '(sin tipo 1)') AS tipo_1,
      v.descp_material,
      v.descp_color,
      COALESCE(NULLIF(TRIM(ppd.grada), ''), '—') AS grada_raw,
      ppd.grades_json,
      v.saldo_pares::text AS cantidad,
      v.cantidad_pares::text AS cantidad_inicial,
      v.pares_vendidos::text AS pares_vendidos,
      v.linea_id::text,
      v.referencia_id::text,
      v.marca_id::text AS marca_id,
      l.genero_id::text AS genero_id,
      v.grupo_estilo_id::text AS grupo_estilo_id,
      v.tipo_1_id::text AS tipo_1_id,
      1::text AS tipo_v2_id,
      v.lpn::text,
      pp.quincena_arribo_id::text,
      COALESCE(qa.descripcion, v.quincena_desc, 'Sin quincena') AS quincena_desc,
      v.pp_id::text,
      v.pp_nro,
      v.proforma,
      COALESCE(v.caso_precio, v.descp_caso, '') AS caso_precio
    FROM v_stock_rimec v
    JOIN pedido_proveedor_detalle ppd ON ppd.id = v.det_id
    JOIN pedido_proveedor pp ON pp.id = v.pp_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN linea l ON l.id = v.linea_id
    LEFT JOIN genero g ON g.id = l.genero_id
    ${where}
    ORDER BY pp.quincena_arribo_id NULLS LAST, v.pp_nro, v.linea_codigo, v.referencia_codigo
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
