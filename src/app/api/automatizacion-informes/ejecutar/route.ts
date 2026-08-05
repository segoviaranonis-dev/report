import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { ejecutarAutomatizacionEnvio, infoSmtpLocal } from "@/lib/automatizacion-informes/run-envio";

/**
 * POST · ejecuta ahora (local/worker): PDF particiones → bandeja + outbox/SMTP.
 * Body: { id: number, max_pdfs?: number }
 */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { id?: number; max_pdfs?: number };
  try {
    body = (await req.json()) as { id?: number; max_pdfs?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
  }

  try {
    const result = await ejecutarAutomatizacionEnvio(getRimecPool(), id, {
      maxPdfs: body.max_pdfs ?? 12,
      createdByUsuarioId: gate.session?.id_usuario ?? null,
    });
    return NextResponse.json({
      ...result,
      smtp: infoSmtpLocal(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error ejecutar";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
