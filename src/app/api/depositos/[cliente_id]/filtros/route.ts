import { NextRequest, NextResponse } from "next/server";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type DepositoFilterItem = {
  id: number;
  label: string;
  count?: number;
};

export type DepositoFiltrosResponse = {
  configured: boolean;
  generos: DepositoFilterItem[];
  marcas: DepositoFilterItem[];
  estilos: DepositoFilterItem[];
  tipoV2: DepositoFilterItem[];
  error?: string;
};

/**
 * GET /api/depositos/[cliente_id]/filtros
 *
 * Retorna opciones de filtros para el depósito
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> }
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      generos: [],
      marcas: [],
      estilos: [],
      tipoV2: [],
      error: "Base de datos no configurada",
    } satisfies DepositoFiltrosResponse);
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);
  const categoria = parseCategoriaDeposito(new URL(req.url).searchParams.get("categoria"));
  const config = getDepositoConfig(cliente_id, categoria);
  const tabla = config?.tabla;
  if (!tabla) {
    return NextResponse.json(
      {
        configured: true,
        generos: [],
        marcas: [],
        estilos: [],
        tipoV2: [],
        error: `cliente_id ${cliente_id} no válido`,
      } satisfies DepositoFiltrosResponse,
      { status: 400 }
    );
  }

  try {
    const pool = getRimecPool();

    // Género
    const { rows: generosRows } = await pool.query<DepositoFilterItem>(`
      SELECT DISTINCT
        g.id AS id,
        g.descripcion AS label
      FROM public.${tabla} d
      LEFT JOIN public.genero g ON g.id = d.genero_id
      WHERE g.id IS NOT NULL
      ORDER BY g.descripcion
    `);

    // Marcas
    const { rows: marcasRows } = await pool.query<DepositoFilterItem>(`
      SELECT DISTINCT
        m.id_marca AS id,
        m.descp_marca AS label
      FROM public.${tabla} d
      LEFT JOIN public.marca_v2 m ON m.id_marca = d.marca_id
      WHERE m.id_marca IS NOT NULL
      ORDER BY m.descp_marca
    `);

    // Estilos
    const { rows: estilosRows } = await pool.query<DepositoFilterItem>(`
      SELECT DISTINCT
        e.id_grupo_estilo AS id,
        e.descp_grupo_estilo AS label
      FROM public.${tabla} d
      LEFT JOIN public.grupo_estilo_v2 e ON e.id_grupo_estilo = d.grupo_estilo_id
      WHERE e.id_grupo_estilo IS NOT NULL
      ORDER BY e.descp_grupo_estilo
    `);

    // Tipo V2
    const { rows: tipoV2Rows } = await pool.query<DepositoFilterItem>(`
      SELECT DISTINCT
        tv.id_tipo AS id,
        tv.descp_tipo AS label
      FROM public.${tabla} d
      LEFT JOIN public.tipo_v2 tv ON tv.id_tipo = d.tipo_v2_id
      WHERE tv.id_tipo IS NOT NULL
      ORDER BY tv.descp_tipo
    `);

    return NextResponse.json({
      configured: true,
      generos: generosRows,
      marcas: marcasRows,
      estilos: estilosRows,
      tipoV2: tipoV2Rows,
    } satisfies DepositoFiltrosResponse);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        generos: [],
        marcas: [],
        estilos: [],
        tipoV2: [],
        error: errorMsg,
      } satisfies DepositoFiltrosResponse,
      { status: 500 }
    );
  }
}
