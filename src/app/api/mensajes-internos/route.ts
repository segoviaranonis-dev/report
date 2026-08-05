import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  listCarpetasConConteo,
  listMensajesCarpeta,
} from "@/lib/mensajes-internos/queries";

/**
 * GET · bandeja del usuario sesión (solo destinatario — sin saturar).
 * ?carpeta=STOCK_PRONTA_ENTREGA (default)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const carpeta =
    req.nextUrl.searchParams.get("carpeta")?.trim() || "STOCK_PRONTA_ENTREGA";

  try {
    const pool = getRimecPool();
    const [carpetas, mensajes] = await Promise.all([
      listCarpetasConConteo(pool, session.id_usuario),
      listMensajesCarpeta(pool, session.id_usuario, carpeta),
    ]);
    return NextResponse.json({
      ok: true,
      carpeta,
      carpetas,
      mensajes,
      usuario: {
        id: session.id_usuario,
        nombre: session.name,
        role: session.role,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error bandeja";
    const missing = /mensaje_interno/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        error: missing
          ? "Falta migración 194_mensaje_interno.sql"
          : msg,
      },
      { status: 500 },
    );
  }
}
