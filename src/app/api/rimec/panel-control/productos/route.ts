import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getPanelSectorProductos } from "@/lib/panel-control/queries-productos";
import type { EntidadActivoResumen } from "@/lib/panel-control/queries-resumen";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

const VALID: EntidadActivoResumen["entidad"][] = ["STOCK", "COMPRA_PREVIA", "PROGRAMADO"];

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const raw = req.nextUrl.searchParams.get("entidad")?.toUpperCase() ?? "";
  if (!VALID.includes(raw as EntidadActivoResumen["entidad"])) {
    return NextResponse.json(
      { ok: false, error: "entidad requerida: STOCK | COMPRA_PREVIA | PROGRAMADO" },
      { status: 400 },
    );
  }

  try {
    const pool = getRimecPool();
    const body = await getPanelSectorProductos(pool, raw as EntidadActivoResumen["entidad"]);
    return NextResponse.json({ ok: true, modulo: "panel-control", ...body });
  } catch (e) {
    console.error("[panel-control/productos]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error productos panel" },
      { status: 500 },
    );
  }
}
