import { NextResponse } from "next/server";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import {
  appendObservacionLogistica,
  vincularObsIcAFisExistentes,
} from "@/lib/logistica-ok/observaciones-logistica";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { desasignarIcDePp, updateIcVinculadaPp, type UpdateIcVinculadaInput } from "@/lib/pedido-proveedor/cabecera-actions";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

type Params = { params: Promise<{ ppId: string; icId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, icId: icRaw } = await params;
  const ppId = Number(ppRaw);
  const icId = Number(icRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  let body: UpdateIcVinculadaInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const obsNueva = body.observacion_logistica_nueva?.trim();
    const { observacion_logistica_nueva: _drop, ...fields } = body;
    const result = await updateIcVinculadaPp(pool, ppId, icId, fields);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

    if (obsNueva) {
      const session = gate.session!;
      const append = await appendObservacionLogistica(pool, {
        texto: obsNueva,
        origen: "PP",
        usuarioId: session.id_usuario,
        usuarioNombre: session.name,
        intencionCompraId: icId,
        pedidoProveedorId: ppId,
      });
      if (!append.ok) {
        return NextResponse.json({ ok: false, error: append.error }, { status: 400 });
      }
      await pool.query(`UPDATE intencion_compra SET observaciones = $1 WHERE id = $2`, [
        obsNueva.slice(0, 2000),
        icId,
      ]);
      await vincularObsIcAFisExistentes(pool, icId, ppId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return icApiErrorResponse(e, "Error al actualizar IC vinculada");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const { ppId: ppRaw, icId: icRaw } = await params;
  const ppId = Number(ppRaw);
  const icId = Number(icRaw);
  if (!Number.isFinite(ppId) || !Number.isFinite(icId)) {
    return NextResponse.json({ ok: false, error: "IDs inválidos" }, { status: 400 });
  }

  try {
    const result = await desasignarIcDePp(getRimecPool(), ppId, icId);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, nro_ic: result.nro_ic, pares: result.pares });
  } catch (e) {
    return icApiErrorResponse(e, "Error al desasignar IC");
  }
}
