import { NextResponse } from "next/server";
import {
  appendObservacionLogistica,
  listObservacionesPorFi,
  listObservacionesPorIc,
  type OrigenObsLogistica,
} from "@/lib/logistica-ok/observaciones-logistica";
import { requireLogisticaOkAccess } from "@/lib/logistica-ok/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

const ORIGENES: OrigenObsLogistica[] = ["IC", "PP", "PE_WEB"];

export async function GET(req: Request) {
  const gate = await requireLogisticaOkAccess();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const fiId = Number(url.searchParams.get("fi_id"));
  const icId = Number(url.searchParams.get("ic_id"));
  const pool = getRimecPool();

  try {
    if (Number.isFinite(fiId) && fiId > 0) {
      const items = await listObservacionesPorFi(pool, fiId);
      return NextResponse.json({ ok: true, items });
    }
    if (Number.isFinite(icId) && icId > 0) {
      const items = await listObservacionesPorIc(pool, icId);
      return NextResponse.json({ ok: true, items });
    }
    return NextResponse.json({ ok: false, error: "fi_id o ic_id requerido" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const hint = /logistica_observacion/i.test(msg) ? " Aplicá MIG-179." : "";
    return NextResponse.json({ ok: false, error: msg + hint }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireLogisticaOkAccess();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: {
    texto?: string;
    origen?: string;
    ic_id?: number;
    pp_id?: number;
    fi_id?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const origen = body.origen as OrigenObsLogistica;
  if (!ORIGENES.includes(origen)) {
    return NextResponse.json({ ok: false, error: "origen inválido (IC|PP|PE_WEB)" }, { status: 400 });
  }

  const session = gate.session!;
  const pool = getRimecPool();

  try {
    const result = await appendObservacionLogistica(pool, {
      texto: body.texto ?? "",
      origen,
      usuarioId: session.id_usuario,
      usuarioNombre: session.name,
      intencionCompraId: body.ic_id ?? null,
      pedidoProveedorId: body.pp_id ?? null,
      facturaInternaId: body.fi_id ?? null,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

    if (body.ic_id && body.texto) {
      await pool.query(`UPDATE intencion_compra SET observaciones = $1 WHERE id = $2`, [
        body.texto.trim().slice(0, 2000),
        body.ic_id,
      ]);
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
