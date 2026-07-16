import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { normalizePeBatchLabel } from "@/lib/stock-pronta-entrega/vincular-biblioteca-pe";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const batch = normalizePeBatchLabel(req.nextUrl.searchParams.get("batch"));
  const pool = getRimecPool();
  const { rows } = await pool.query<{
    batch_label: string;
    cadena_comercial: string | null;
    pulse_liquidacion: boolean;
  }>(
    `SELECT batch_label, cadena_comercial, pulse_liquidacion
     FROM pe_catalogo_filtro_web WHERE lower(batch_label) = lower($1)`,
    [batch],
  );

  return NextResponse.json({
    ok: true,
    filtro: rows[0] ?? { batch_label: batch, cadena_comercial: null, pulse_liquidacion: true },
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: gate.error.status });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "BD no configurada" }, { status: 503 });
  }

  const body = (await req.json()) as {
    batch?: string;
    cadena_comercial?: string | null;
    pulse_liquidacion?: boolean;
  };
  const batch = normalizePeBatchLabel(body.batch);
  const cadena = body.cadena_comercial ? String(body.cadena_comercial).trim().toUpperCase() : null;
  const pulse = body.pulse_liquidacion !== false;

  const pool = getRimecPool();
  const { rows } = await pool.query<{
    batch_label: string;
    cadena_comercial: string | null;
    pulse_liquidacion: boolean;
  }>(
    `
    INSERT INTO pe_catalogo_filtro_web (batch_label, cadena_comercial, pulse_liquidacion, updated_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (batch_label) DO UPDATE SET
      cadena_comercial = EXCLUDED.cadena_comercial,
      pulse_liquidacion = EXCLUDED.pulse_liquidacion,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING batch_label, cadena_comercial, pulse_liquidacion
    `,
    [batch, cadena, pulse, gate.session?.name ?? "report"],
  );

  return NextResponse.json({ ok: true, filtro: rows[0] });
}
