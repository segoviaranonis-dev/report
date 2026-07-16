import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  getBibliotecaVinculadaPe,
  normalizePeBatchLabel,
  vincularBibliotecaPe,
} from "@/lib/stock-pronta-entrega/vincular-biblioteca-pe";

/** GET — biblioteca PE ya vinculada en BD (candado). */
export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    const cloned = gate.error.clone();
    try {
      const body = (await cloned.json()) as { error?: string };
      return NextResponse.json(
        { ok: false, error: body.error ?? "Acceso denegado" },
        { status: gate.error.status },
      );
    } catch {
      return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
    }
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const batch = normalizePeBatchLabel(req.nextUrl.searchParams.get("batch"));
  try {
    const pool = getRimecPool();
    const vinculo = await getBibliotecaVinculadaPe(pool, batch);
    return NextResponse.json({ ok: true, ...vinculo });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error consultando vínculo PE" },
      { status: 500 },
    );
  }
}

/** POST — candado: BCL → descp_caso_snapshot (PROMO Web). Re-vincular actualiza. */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    const cloned = gate.error.clone();
    try {
      const body = (await cloned.json()) as { error?: string };
      return NextResponse.json(
        { ok: false, error: body.error ?? "Acceso denegado" },
        { status: gate.error.status },
      );
    } catch {
      return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
    }
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { biblioteca_id?: number; batch?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const bibliotecaId = Number(body.biblioteca_id);
  if (!Number.isFinite(bibliotecaId) || bibliotecaId <= 0) {
    return NextResponse.json({ ok: false, error: "biblioteca_id requerido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const result = await vincularBibliotecaPe(pool, {
      bibliotecaId,
      usuarioId: gate.session?.id_usuario ?? null,
      numeroProforma: normalizePeBatchLabel(body.batch),
    });
    if (!result.ok) {
      console.error("[vincular-biblioteca PE] FAIL", {
        bibliotecaId,
        batch: normalizePeBatchLabel(body.batch),
        detail: result.detail,
        error: result.error,
      });
      return NextResponse.json(result, { status: result.detail === "MIG_153_PENDIENTE" ? 503 : 400 });
    }
    console.info("[vincular-biblioteca PE] OK", {
      bibliotecaId: result.biblioteca_id,
      batch: result.numero_proforma,
      actualizados: result.actualizados,
      promocionales: result.promocionales,
      pp_candados: result.pp_candados,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[vincular-biblioteca PE] ERROR", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al vincular biblioteca PE" },
      { status: 500 },
    );
  }
}
