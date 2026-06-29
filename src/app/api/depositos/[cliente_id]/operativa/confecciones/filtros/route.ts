import { NextRequest, NextResponse } from "next/server";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { TIPO_V2_CONFECCIONES } from "@/lib/depositos/pilar-proveedor-index";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { requireDepositoClienteAccess } from "@/lib/depositos/depositos-session";

export type ConfeccionesFiltrosResponse = {
  configured: boolean;
  marcas: DepositoFilterItem[];
  lineas: DepositoFilterItem[];
  referencias: DepositoFilterItem[];
  colores: DepositoFilterItem[];
  gradas: string[];
  error?: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> },
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      marcas: [],
      lineas: [],
      referencias: [],
      colores: [],
      gradas: [],
      error: "Base de datos no configurada",
    } satisfies ConfeccionesFiltrosResponse);
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);

  const gate = await requireDepositoClienteAccess(cliente_id);
  if (!gate.ok) {
    return NextResponse.json(
      {
        configured: true,
        marcas: [],
        lineas: [],
        referencias: [],
        colores: [],
        gradas: [],
        error: gate.error,
      } satisfies ConfeccionesFiltrosResponse,
      { status: gate.status },
    );
  }

  const categoria = parseCategoriaDeposito(new URL(req.url).searchParams.get("categoria"));
  const config = getDepositoConfig(cliente_id, categoria);

  if (!config) {
    return NextResponse.json(
      {
        configured: true,
        marcas: [],
        lineas: [],
        referencias: [],
        colores: [],
        gradas: [],
        error: `cliente_id ${cliente_id} inválido`,
      } satisfies ConfeccionesFiltrosResponse,
      { status: 400 },
    );
  }

  const tabla = config.tabla;
  const baseWhere = `s.cantidad > 0 AND s.tipo_v2_id = ${TIPO_V2_CONFECCIONES}`;

  try {
    const pool = getRimecPool();

    const { rows: marcas } = await pool.query<DepositoFilterItem>(`
      SELECT m.id_marca AS id, m.descp_marca AS label, COUNT(*)::int AS count
      FROM public.${tabla} s
      INNER JOIN public.marca_v2 m ON m.id_marca = s.marca_id
      WHERE ${baseWhere}
      GROUP BY m.id_marca, m.descp_marca
      ORDER BY m.descp_marca
    `);

    const { rows: lineas } = await pool.query<DepositoFilterItem>(`
      SELECT l.id AS id,
        COALESCE(
          NULLIF(btrim(MAX(l.descripcion)::text), ''),
          MIN(NULLIF(btrim(s.linea_codigo_proveedor::text), ''))
        ) AS label,
        COUNT(*)::int AS count
      FROM public.${tabla} s
      INNER JOIN public.linea l ON l.id = s.linea_id
      WHERE ${baseWhere}
      GROUP BY l.id
      ORDER BY label
    `);

    const { rows: referencias } = await pool.query<DepositoFilterItem>(`
      SELECT r.id AS id,
        COALESCE(
          NULLIF(btrim(MAX(r.codigo_proveedor::text), ''), ''),
          MIN(NULLIF(btrim(s.referencia_codigo_proveedor::text), ''))
        ) AS label,
        COUNT(*)::int AS count
      FROM public.${tabla} s
      INNER JOIN public.referencia r ON r.id = s.referencia_id
      WHERE ${baseWhere}
      GROUP BY r.id
      ORDER BY label
    `);

    const { rows: colores } = await pool.query<DepositoFilterItem>(`
      SELECT c.id AS id,
        COALESCE(
          NULLIF(btrim(MAX(c.nombre)::text), ''),
          NULLIF(btrim(MAX(c.codigo_proveedor::text), ''), ''),
          MIN(NULLIF(btrim(s.excel_color_code::text), ''))
        ) AS label,
        COUNT(*)::int AS count
      FROM public.${tabla} s
      INNER JOIN public.color c ON c.id = s.color_id
      WHERE ${baseWhere}
      GROUP BY c.id
      ORDER BY label
    `);

    const { rows: gradasRows } = await pool.query<{ grada: string }>(`
      SELECT DISTINCT btrim(s.grada::text) AS grada
      FROM public.${tabla} s
      WHERE ${baseWhere} AND btrim(s.grada::text) <> ''
      ORDER BY grada
    `);

    return NextResponse.json({
      configured: true,
      marcas,
      lineas,
      referencias,
      colores,
      gradas: gradasRows.map((r) => r.grada),
    } satisfies ConfeccionesFiltrosResponse);
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        marcas: [],
        lineas: [],
        referencias: [],
        colores: [],
        gradas: [],
        error: error instanceof Error ? error.message : "Error",
      } satisfies ConfeccionesFiltrosResponse,
      { status: 500 },
    );
  }
}
