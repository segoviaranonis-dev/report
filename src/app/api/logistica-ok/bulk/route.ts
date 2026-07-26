import { NextResponse } from "next/server";
import {
  cerrarEntregaExitosa,
  confirmarEntregaLote,
  confirmarImpresionLegalLote,
} from "@/lib/logistica-ok/queries-bandeja";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Body = {
  action: "fecha_cliente" | "impresion_legal" | "cierre_entrega";
  ids: number[];
  fecha_entrega_cliente?: string;
  fecha_entrega_efectiva?: string;
  chofer_nombre?: string;
  /** Asignar / reasignar vendedor comercial en el lote */
  id_vendedor?: number | null;
};

/** POST · multi-selección: misma fecha (+ vendedor) o impresión legal a N FI */
export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const ids = (body.ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    return NextResponse.json({ ok: false, error: "Seleccioná al menos una FI." }, { status: 400 });
  }

  const pool = getRimecPool();
  const uid = gate.session?.id_usuario ?? null;
  const idVendedor =
    body.id_vendedor != null && Number.isFinite(Number(body.id_vendedor)) && Number(body.id_vendedor) > 0
      ? Number(body.id_vendedor)
      : null;

  if (body.action === "fecha_cliente") {
    const result = await confirmarEntregaLote(
      pool,
      ids,
      body.fecha_entrega_cliente ?? "",
      uid,
      idVendedor,
    );
    return NextResponse.json(
      {
        ok: result.ok,
        done: result.done,
        failed: result.skipped,
        okIds: result.okIds,
        error: result.error,
        requested: ids.length,
      },
      { status: result.done > 0 ? 200 : 400 },
    );
  }

  if (body.action === "impresion_legal") {
    const result = await confirmarImpresionLegalLote(pool, ids, uid);
    return NextResponse.json(
      {
        ok: result.ok,
        done: result.done,
        failed: result.skipped,
        okIds: result.okIds,
        error: result.error,
        requested: ids.length,
      },
      { status: result.done > 0 ? 200 : 400 },
    );
  }

  // cierre_entrega: sigue fila a fila (chofer/fecha pueden variar)
  const okIds: number[] = [];
  const errors: Array<{ id: number; error: string }> = [];
  for (const id of ids) {
    const result = await cerrarEntregaExitosa(pool, id, {
      fecha_entrega_efectiva: body.fecha_entrega_efectiva ?? "",
      chofer_nombre: body.chofer_nombre ?? "",
      usuarioId: uid,
    });
    if (result.ok) okIds.push(id);
    else errors.push({ id, error: result.error || "Error" });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    done: okIds.length,
    failed: errors.length,
    okIds,
    errors,
    requested: ids.length,
  });
}
