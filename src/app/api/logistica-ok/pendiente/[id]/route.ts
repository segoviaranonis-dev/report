import { NextResponse } from "next/server";
import {
  cerrarEntregaExitosa,
  confirmarEntregaVendedor,
  confirmarImpresionLegal,
} from "@/lib/logistica-ok/queries-bandeja";
import { requireLogisticaOkAccess } from "@/lib/logistica-ok/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isNivelDios } from "@/lib/auth/nivel-dios";

type Params = { params: Promise<{ id: string }> };

type Body = {
  action?: "fecha_cliente" | "impresion_legal" | "cierre_entrega";
  fecha_entrega?: string;
  fecha_entrega_cliente?: string;
  fecha_entrega_efectiva?: string;
  chofer_nombre?: string;
  id_vendedor?: number | null;
};

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireLogisticaOkAccess();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const id = Number((await params).id);
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const uid = gate.session?.id_usuario ?? null;
  const action = body.action ?? "fecha_cliente";
  const cat = String(gate.categoria || "").toUpperCase().trim();

  if (action === "fecha_cliente") {
    // Solo Nivel Dios · Vendedor NO asigna fecha (Director 2026-07-27)
    if (cat === "VENDEDOR" || !isNivelDios(gate.session)) {
      return NextResponse.json(
        { ok: false, error: "Solo gerente (Nivel Superior) asigna fecha de entrega al cliente." },
        { status: 403 },
      );
    }
  }

  if (action === "impresion_legal") {
    const result = await confirmarImpresionLegal(pool, id, uid);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "cierre_entrega") {
    const result = await cerrarEntregaExitosa(pool, id, {
      fecha_entrega_efectiva: body.fecha_entrega_efectiva ?? "",
      chofer_nombre: body.chofer_nombre ?? "",
      usuarioId: uid,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const fecha = body.fecha_entrega_cliente ?? body.fecha_entrega ?? "";
  const idVendedor =
    body.id_vendedor != null && Number(body.id_vendedor) > 0 ? Number(body.id_vendedor) : null;
  const result = await confirmarEntregaVendedor(pool, id, fecha, uid, idVendedor);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
