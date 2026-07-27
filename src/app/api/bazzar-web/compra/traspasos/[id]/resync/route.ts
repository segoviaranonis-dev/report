import { NextRequest, NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { resyncTraspasoDetalleFromFactura } from "@/lib/rimec-abastecimiento/traspaso-mutations";
import { getTraspasoIntegridad } from "@/lib/bazzar-web/compra-web/integridad";
import { traspasoEsClienteWeb } from "@/lib/bazzar-web/compra-web/queries";

type Params = { params: Promise<{ id: string }> };

/** POST — resincroniza traspaso_detalle desde FI (ENVIADO/BORRADOR) */
export async function POST(_req: NextRequest, { params }: Params) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  }

  const esWeb = await traspasoEsClienteWeb(id);
  if (!esWeb) {
    return NextResponse.json({ ok: false, error: "Traspaso fuera de cliente 5000." }, { status: 403 });
  }

  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await resyncTraspasoDetalleFromFactura(client, id);
    if (!res.ok) {
      await client.query("ROLLBACK");
      return NextResponse.json(res, { status: 400 });
    }
    await client.query("COMMIT");
    const integridad = await getTraspasoIntegridad(id);
    return NextResponse.json({ ...res, integridad });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bazzar-web/compra/resync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
