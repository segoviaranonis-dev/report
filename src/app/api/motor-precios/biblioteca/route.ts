import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import {
  crearBibliotecaPrecio,
  findBibliotecaCanonica,
  listBibliotecasPorProveedor,
} from "@/lib/motor-precios/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, bibliotecas: [] }, { status: 503 });
  }

  const proveedorRaw = req.nextUrl.searchParams.get("proveedor_id");
  const proveedorId = Number(proveedorRaw ?? 654);
  if (!Number.isFinite(proveedorId) || proveedorId <= 0) {
    return NextResponse.json({ ok: false, error: "proveedor_id inválido" }, { status: 400 });
  }

  try {
    const bibliotecas = await listBibliotecasPorProveedor(getRimecPool(), proveedorId);
    const canonica = findBibliotecaCanonica(bibliotecas);
    return NextResponse.json({ configured: true, bibliotecas, canonica });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar bibliotecas";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { nombre?: string; descripcion?: string | null; proveedor_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ ok: false, error: "Nombre obligatorio" }, { status: 400 });
  }

  const proveedorId = Number(body.proveedor_id ?? MOTOR_PROVEEDOR_DEFAULT);
  if (!Number.isFinite(proveedorId) || proveedorId <= 0) {
    return NextResponse.json({ ok: false, error: "proveedor_id inválido" }, { status: 400 });
  }

  try {
    const created = await crearBibliotecaPrecio(getRimecPool(), {
      nombre,
      proveedor_id: proveedorId,
      descripcion: body.descripcion ?? null,
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear biblioteca";
    const status = msg.includes("Ya existe") ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
