import { NextRequest, NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

const ENTES_MAP: Record<number, { ente: string; tipo: string }> = {
  2100: { ente: "Fernando", tipo: "Adultos" },
  2900: { ente: "Fernando", tipo: "Niños" },
  2400: { ente: "San Martin", tipo: "Adultos" },
  2700: { ente: "San Martin", tipo: "Niños" },
  3100: { ente: "Palma", tipo: "Adultos" },
  3200: { ente: "Palma", tipo: "Niños" },
};

/**
 * GET /api/depositos/preview/[cliente_id]
 *
 * Muestra cuántos registros se sincronizarían desde registro_st_vt_rc_reposicion
 * SIN ejecutar la sincronización
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> }
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      preview: null,
      error: "Base de datos no configurada",
    });
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);

  if (!ENTES_MAP[cliente_id]) {
    return NextResponse.json(
      {
        configured: true,
        preview: null,
        error: `cliente_id ${cliente_id} no válido`,
      },
      { status: 400 }
    );
  }

  const info = ENTES_MAP[cliente_id];

  try {
    const pool = getRimecPool();

    // Contar totales simples
    const { rows: totalesRows } = await pool.query<{
      total_registros: string;
      total_pares: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_registros,
        COALESCE(SUM(cantidad), 0)::text AS total_pares
      FROM public.registro_st_vt_rc_reposicion
      WHERE cliente_id = $1
        AND lower(btrim(tipo_movimiento)) = 'stock'
    `, [cliente_id]);

    // Por tipo v2
    const { rows: tiposRows } = await pool.query<{
      tipo_v2_id: number;
      tipo: string;
      registros: string;
      pares: string;
    }>(`
      SELECT
        s.tipo_v2_id,
        COALESCE(tv.descp_tipo, 'Sin tipo') AS tipo,
        COUNT(*)::text AS registros,
        COALESCE(SUM(s.cantidad), 0)::text AS pares
      FROM public.registro_st_vt_rc_reposicion s
      LEFT JOIN public.tipo_v2 tv ON tv.id_tipo = s.tipo_v2_id
      WHERE s.cliente_id = $1
        AND lower(btrim(s.tipo_movimiento)) = 'stock'
      GROUP BY s.tipo_v2_id, tv.descp_tipo
    `, [cliente_id]);

    const preview = totalesRows[0];

    return NextResponse.json({
      configured: true,
      cliente_id,
      ente: info.ente,
      tipo: info.tipo,
      preview: {
        total_registros: parseInt(preview.total_registros || "0"),
        total_pares: parseFloat(preview.total_pares || "0"),
        por_tipo_v2: tiposRows,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        configured: true,
        cliente_id,
        ente: info.ente,
        tipo: info.tipo,
        preview: null,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
