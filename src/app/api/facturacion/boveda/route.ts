import { NextRequest, NextResponse } from "next/server";
import { requireRimecAdmin } from "@/lib/rimec-admin/auth-api";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isCajaRimec } from "@/lib/auth/caja-rimec";
import {
  archivarFiEnBoveda,
  listarBoveda,
  resolveFiIdForBoveda,
  type BovedaOrigen,
} from "@/lib/facturacion/boveda";

export async function GET(req: NextRequest) {
  const { session, error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, items: [] }, { status: 503 });
  }

  const origenParam = req.nextUrl.searchParams.get("origen");
  const origen: BovedaOrigen =
    origenParam === "transito" ? "transito" : "pronta-entrega";

  if (isCajaRimec(session!.rol_id, session!.role) && origen !== "pronta-entrega") {
    return NextResponse.json(
      { error: "CAJA RIMEC: solo bóveda Pronta Entrega" },
      { status: 403 },
    );
  }

  try {
    const items = await listarBoveda(origen);
    return NextResponse.json({ configured: true, origen, items });
  } catch (err) {
    console.error("[api/facturacion/boveda GET]", err);
    return NextResponse.json({ error: "Error al listar bóveda" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRimecAdmin();
  if (error) return error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { fi_id?: number; nro_factura?: string; nota?: string; origen?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const origen: BovedaOrigen =
    body.origen === "transito" ? "transito" : "pronta-entrega";

  if (isCajaRimec(session!.rol_id, session!.role) && origen !== "pronta-entrega") {
    return NextResponse.json(
      { error: "CAJA RIMEC: solo bóveda Pronta Entrega" },
      { status: 403 },
    );
  }

  const resolved = await resolveFiIdForBoveda({
    fi_id: body.fi_id,
    nro_factura: body.nro_factura,
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  const result = await archivarFiEnBoveda({
    fiId: resolved.fiId,
    origen,
    archivadoPor: session!.id_usuario ?? null,
    nota: body.nota ?? null,
  });

  if (!result.ok) {
    const status = /ya está en la bóveda/i.test(result.error) ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    boveda_id: result.boveda_id,
    fi_id: resolved.fiId,
    nro_factura: resolved.nro,
  });
}
