import { NextRequest, NextResponse } from "next/server";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { normalizeDepositoRow } from "@/lib/depositos/operativa-filters";
import { requireDepositoClienteAccess } from "@/lib/depositos/depositos-session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type DepositoRow = {
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  material_code: string;
  color_code: string;
  marca: string;
  genero: string;
  estilo: string;
  tipo_v2: string;
  descp_material: string | null;
  descp_color: string | null;
  grada: string;
  cantidad: number;
  imagen_nombre: string | null;
  /** Kyly 638 — color Excel para stem L_C (MIG-149). */
  imagen_color_excel?: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number;
  color_id: number;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  tipo_v2_id: number | null;
  tono_etiqueta: string | null;
  tipo_1: string | null;
  /** Precio venta tienda (LPN CSV → precio_unitario). */
  precio_unitario: number | null;
  /** Stock PE — depósito legal CSV */
  deposito_codigo?: string | null;
  columna_stock_legal?: string | null;
  /** Stock tránsito — compra previa · dato duro quincena */
  quincena_arribo_id?: number | null;
  quincena_desc?: string | null;
  pp_id?: number | null;
  pp_nro?: string | null;
  proforma?: string | null;
  caso_precio?: string | null;
  /** FK biblioteca de precios (PPD.biblioteca_id · MIG-153/154). */
  caso_id?: number | null;
  cantidad_inicial?: number | null;
  pares_vendidos?: number | null;
  /** Comercial SDRM xlsx — COD.GRUPO · LIQUIDACIÓN */
  cod_grupo?: string | null;
  sdrm_marca?: string | null;
  cadena_comercial?: string | null;
  es_liquidacion?: boolean | null;
  /** Kyly 638 · TEMPORADA (VERANO|INVIERNO) — tipo_1 / am_temporada */
  temporada?: string | null;
  /**
   * Familia Material/Color sellada 1 vez (latencia).
   * Texto canónico o «NN» si 1ª palabra es numérica.
   */
  familia_material?: string | null;
  familia_color?: string | null;
};

/**
 * GET /api/depositos/[cliente_id]?limit=30
 *
 * Retorna TOP N productos por marca del depósito
 * Query params:
 *  - limit: 30 | 50 | 100 | 'all' (default: 30)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> }
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      productos: [],
      error: "Base de datos no configurada",
    });
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);

  const gate = await requireDepositoClienteAccess(cliente_id);
  if (!gate.ok) {
    return NextResponse.json(
      { configured: true, productos: [], error: gate.error },
      { status: gate.status },
    );
  }

  const categoria = parseCategoriaDeposito(new URL(req.url).searchParams.get("categoria"));
  const config = getDepositoConfig(cliente_id, categoria);

  if (!config) {
    return NextResponse.json(
      {
        configured: true,
        productos: [],
        error: `cliente_id ${cliente_id} no válido`,
      },
      { status: 400 }
    );
  }

  const tabla = config.tabla;
  const info = { ente: config.ente, tipo: config.tipo };

  // Leer parámetro limit del query string
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit') || '30';
  const limit = limitParam === 'all' ? null : parseInt(limitParam);

  try {
    const pool = getRimecPool();

    // Query optimizado: TOP N productos por marca
    const whereClause = limit ? `WHERE rank_por_marca <= ${limit}` : '';

    const { rows } = await pool.query<DepositoRow>(`
      WITH ranked_products AS (
        SELECT
          s.linea_codigo_proveedor,
          s.referencia_codigo_proveedor,
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
          ) AS color_code,
          s.material_id,
          s.color_id,
          s.marca_id,
          s.genero_id,
          s.grupo_estilo_id,
          s.tipo_1_id,
          s.tipo_v2_id,
          s.grada,
          s.cantidad::float8 AS cantidad,
          s.linea_id,
          s.referencia_id,
          COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)') AS marca,
          COALESCE(
            NULLIF(btrim(g.descripcion::text), ''),
            NULLIF(btrim(g.codigo::text), ''),
            '(sin género)'
          ) AS genero,
          COALESCE(
            NULLIF(btrim(ge.descp_grupo_estilo::text), ''),
            '(sin estilo)'
          ) AS estilo,
          COALESCE(
            NULLIF(btrim(tv.descp_tipo::text), ''),
            '(sin tipo)'
          ) AS tipo_v2,
          NULLIF(btrim(col.tono_canon->>'etiqueta'), '') AS tono_etiqueta,
          COALESCE(
            NULLIF(btrim(t1.descp_tipo_1::text), ''),
            '(sin tipo 1)'
          ) AS tipo_1,
          NULLIF(btrim(mat.descripcion::text), '') AS descp_material,
          NULLIF(btrim(col.nombre::text), '') AS descp_color,
          NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
          NULLIF(s.precio_unitario, 0)::float8 AS precio_unitario,
          ROW_NUMBER() OVER (PARTITION BY s.marca_id ORDER BY s.cantidad DESC) AS rank_por_marca
        FROM public.${tabla} s
        LEFT JOIN public.material mat ON mat.id = s.material_id
        LEFT JOIN public.color col ON col.id = s.color_id
        LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
        LEFT JOIN public.genero g ON g.id = s.genero_id
        LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
        LEFT JOIN public.tipo_v2 tv ON tv.id_tipo = s.tipo_v2_id
        LEFT JOIN public.tipo_1 t1 ON t1.id_tipo_1 = s.tipo_1_id
        WHERE s.cantidad > 0
      )
      SELECT
        linea_codigo_proveedor,
        referencia_codigo_proveedor,
        material_code,
        color_code,
        material_id,
        color_id,
        marca_id,
        genero_id,
        grupo_estilo_id,
        tipo_1_id,
        tipo_v2_id,
        grada,
        cantidad,
        linea_id,
        referencia_id,
        marca,
        genero,
        estilo,
        tipo_v2,
        tono_etiqueta,
        tipo_1,
        descp_material,
        descp_color,
        imagen_nombre,
        precio_unitario
      FROM ranked_products
      ${whereClause}
      ORDER BY marca, cantidad DESC
    `);

    const productos = rows.map((r) => normalizeDepositoRow(r));

    return NextResponse.json({
      configured: true,
      cliente_id,
      ente: info.ente,
      tipo: info.tipo,
      productos,
      total: productos.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        cliente_id,
        ente: info.ente,
        tipo: info.tipo,
        productos: [],
        total: 0,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
