import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { crearBiblioteca, getBibliotecaCanonica, listBibliotecas } from "@/lib/motor-precios/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, bibliotecas: [] }, { status: 503 });
  }

  const proveedorId = Number(req.nextUrl.searchParams.get("proveedor_id") ?? MOTOR_PROVEEDOR_DEFAULT);

  try {
    const pool = getRimecPool();
    const [bibliotecas, canonica] = await Promise.all([
      listBibliotecas(pool, proveedorId),
      getBibliotecaCanonica(pool, proveedorId),
    ]);
    return NextResponse.json({ configured: true, proveedor_id: proveedorId, bibliotecas, canonica });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar bibliotecas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { nombre?: string; descripcion?: string; proveedor_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const proveedorId = Number(body.proveedor_id ?? MOTOR_PROVEEDOR_DEFAULT);

  try {
    const pool = getRimecPool();
    const created = await crearBiblioteca(pool, proveedorId, body.nombre ?? "", body.descripcion ?? null);
    return NextResponse.json({ ok: true, ...created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear biblioteca";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
