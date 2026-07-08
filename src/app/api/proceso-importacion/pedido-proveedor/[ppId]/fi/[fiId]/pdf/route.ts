import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { runFiPdfPython } from "@/lib/pedido-proveedor/run-python-fi-pdf";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; fiId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, fiId: fiRaw } = await params;
  const ppId = Number(ppRaw);
  const fiId = Number(fiRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(fiId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  const pool = getRimecPool();
  const { rows } = await pool.query<{ nro_factura: string; pp_id: string }>(
    `SELECT nro_factura, pp_id::text FROM factura_interna WHERE id = $1 LIMIT 1`,
    [fiId],
  );
  const row = rows[0];
  if (!row || Number(row.pp_id) !== ppId) {
    return NextResponse.json({ ok: false, error: "FI no pertenece a este PP" }, { status: 404 });
  }

  const result = await runFiPdfPython(fiId, row.nro_factura);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
