import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertClienteIdAccess, resolveCajaAccess } from "@/lib/caja-bazzar/access";
import {
  CSV_HEADERS,
  escapeCsvCell,
  queryTickets,
  startOfTodayUtc,
  tablaTicketsExiste,
  ticketToCsvRow,
  type TicketPosRow,
} from "@/lib/caja-bazzar/tickets-db";
import { isCajaClienteId } from "@/lib/caja-bazzar/tiendas";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function csvFacturaFilename(rows: TicketPosRow[], clienteId: number): string {
  const stagingId = rows[0]?.staging_id;
  const base = stagingId != null ? `POS-FI-${stagingId}` : `caja-${clienteId}`;
  return `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/**
 * GET /api/tablet-bazzar/tickets/csv?cliente_id=&estado=EMITIDO&cedula=
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const access = resolveCajaAccess(session);
  if (!access.ok) return access.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "Base de datos no configurada" }, { status: 500 });
  }

  const sp = new URL(req.url).searchParams;
  const clienteId = Number(sp.get("cliente_id"));
  if (!isCajaClienteId(clienteId)) {
    return NextResponse.json({ error: "cliente_id requerido" }, { status: 400 });
  }

  const denied = assertClienteIdAccess(access, clienteId);
  if (denied) return denied.error;

  const estado = sp.get("estado") ?? "EMITIDO";
  const cedula = sp.get("cedula");
  const codigos = sp.get("codigos")?.split(",").map((s) => s.trim()).filter(Boolean);

  try {
    if (!(await tablaTicketsExiste())) {
      return NextResponse.json({ error: "Tabla ticket_venta_pos no existe" }, { status: 503 });
    }

    const { tickets } = await queryTickets({
      clienteId,
      estado,
      cedula,
      desde: startOfTodayUtc(),
      limit: 500,
      offset: 0,
      allowedClienteIds: [clienteId],
    });

    const rows = codigos?.length
      ? tickets.filter((t) => codigos.includes(t.codigo_ticket))
      : tickets;

    const lines = [
      CSV_HEADERS.join(","),
      ...rows.map((t) => ticketToCsvRow(t).map(escapeCsvCell).join(",")),
    ];
    const body = `\uFEFF${lines.join("\r\n")}\r\n`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFacturaFilename(rows, clienteId)}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error CSV";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
