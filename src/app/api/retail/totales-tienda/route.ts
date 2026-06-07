import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { parseRetailFiltersFromSearchParams } from "@/lib/retail/retail-filters";
import { buildWhereClause } from "@/lib/retail/apply-filters-sql";

export type TotalesTienda = {
  tienda: string;
  stock: number;
  venta: number;
};

export type TotalesTiendaResponse = {
  configured: boolean;
  tiendas: TotalesTienda[];
  error?: string;
};

/**
 * API: Totales de Stock y Venta por tienda (con soporte de filtros)
 */
export async function GET(request: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      tiendas: [],
    } satisfies TotalesTiendaResponse);
  }

  try {
    // Parsear filtros de URL
    const { searchParams } = new URL(request.url);
    const filters = parseRetailFiltersFromSearchParams(searchParams);
    const whereClause = buildWhereClause(filters);

    const pool = getRimecPool();

    const { rows } = await pool.query<{
      tienda_norm: string;
      stock: string;
      venta: string;
    }>(`
      SELECT
        CASE
          WHEN lower(btrim(s.origen_holding)) LIKE '%import%' OR lower(btrim(s.origen_holding)) = 'rimec'
            OR lower(btrim(s.origen_holding)) LIKE '%depósit%' OR lower(btrim(s.origen_holding)) LIKE '%deposit%'
          THEN 'RIMEC'
          WHEN lower(btrim(s.origen_holding)) LIKE '%fernando%' THEN 'Fernando'
          WHEN lower(btrim(s.origen_holding)) LIKE '%san%mart%' THEN 'San Martín'
          WHEN lower(btrim(s.origen_holding)) LIKE '%palma%' THEN 'Palma'
          ELSE btrim(s.origen_holding)
        END AS tienda_norm,
        SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'stock' THEN s.cantidad::float8 ELSE 0 END)::text AS stock,
        SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'venta' THEN s.cantidad::float8 ELSE 0 END)::text AS venta
      FROM public.registro_st_vt_rc_reposicion s
      LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
      LEFT JOIN public.genero g ON g.id = s.genero_id
      LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
      ${whereClause}
      GROUP BY tienda_norm
      ORDER BY tienda_norm
    `);

    const tiendas: TotalesTienda[] = rows.map((r) => ({
      tienda: r.tienda_norm,
      stock: Number(r.stock) || 0,
      venta: Number(r.venta) || 0,
    }));

    return NextResponse.json({
      configured: true,
      tiendas,
    } satisfies TotalesTiendaResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al cargar totales por tienda";
    return NextResponse.json(
      {
        configured: true,
        tiendas: [],
        error: msg,
      } satisfies TotalesTiendaResponse,
      { status: 500 },
    );
  }
}
