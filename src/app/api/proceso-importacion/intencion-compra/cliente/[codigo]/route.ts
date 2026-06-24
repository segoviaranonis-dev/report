import { NextResponse } from "next/server";
import { buscarCliente } from "@/lib/intencion-compra/numeracion";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ codigo: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const id = Number((await params).codigo);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "Código inválido" }, { status: 400 });
  }

  const nombre = await buscarCliente(getRimecPool(), id);
  if (!nombre) return NextResponse.json({ ok: false, found: false }, { status: 404 });
  return NextResponse.json({ ok: true, found: true, id_cliente: id, descp_cliente: nombre });
}
