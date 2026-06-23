import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveCajaAccess } from "@/lib/caja-bazzar/access";
import { queryHubStats, tablaTicketsExiste } from "@/lib/caja-bazzar/tickets-db";
import { CAJA_TIENDAS } from "@/lib/caja-bazzar/tiendas";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/**
 * GET /api/tablet-bazzar/hub — stats cards + acceso
 */
export async function GET() {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  const tiendas = CAJA_TIENDAS.filter((t) => access.allowedClienteIds.includes(t.cliente_id));
  const tablaOk = isRimecDatabaseConfigured() ? await tablaTicketsExiste() : false;

  const depositoStats: Record<number, { pares: number; registros: number }> = {};
  if (isRimecDatabaseConfigured()) {
    const pool = getRimecPool();
    await Promise.all(
      tiendas.map(async (t) => {
        try {
          const r = await pool.query<{ registros: number; pares: number }>(
            `SELECT COUNT(*)::int AS registros, COALESCE(SUM(cantidad), 0)::float AS pares FROM public.${t.tabla_tienda}`,
          );
          depositoStats[t.cliente_id] = {
            registros: r.rows[0]?.registros ?? 0,
            pares: r.rows[0]?.pares ?? 0,
          };
        } catch {
          depositoStats[t.cliente_id] = { registros: 0, pares: 0 };
        }
      }),
    );
  }

  const ticketStats = isRimecDatabaseConfigured()
    ? await queryHubStats(access.allowedClienteIds)
    : {};

  const cards = tiendas.map((t) => ({
    ...t,
    deposito_pares: depositoStats[t.cliente_id]?.pares ?? 0,
    deposito_registros: depositoStats[t.cliente_id]?.registros ?? 0,
    tickets_pendientes: ticketStats[t.cliente_id]?.pendientes ?? 0,
    tickets_facturados: ticketStats[t.cliente_id]?.facturados ?? 0,
    pares_vendidos_hoy: ticketStats[t.cliente_id]?.pares_hoy ?? 0,
    tabla_ok: tablaOk,
  }));

  return NextResponse.json({
    configured: isRimecDatabaseConfigured(),
    multi_tienda: access.multiTienda,
    allowed_cliente_ids: access.allowedClienteIds,
    tiendas: cards,
  });
}
