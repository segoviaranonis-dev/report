import { NextResponse } from "next/server";
import { requireLogisticaOkAccess } from "@/lib/logistica-ok/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getRimecDetalleComoFi } from "@/lib/logistica-rimec/queries";

type Params = { params: Promise<{ factura: string }> };

/** Detalle tipo FI + miniaturas (L+R+M+C) desde Excel Rimec. */
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireLogisticaOkAccess(null);
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const factura = decodeURIComponent((await params).factura || "").trim();
  if (!factura) {
    return NextResponse.json({ ok: false, error: "Falta factura" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const data = await getRimecDetalleComoFi(pool, factura);
    if (!data) {
      return NextResponse.json({ error: "Factura no encontrada en Logística Rimec" }, { status: 404 });
    }
    return NextResponse.json({ configured: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
