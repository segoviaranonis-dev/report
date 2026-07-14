import { NextResponse } from "next/server";
import { getHerramientaReposicion } from "@/lib/herramienta-reposicion/queries";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const data = await getHerramientaReposicion(getRimecPool());
    return NextResponse.json({ ok: true, configured: true, ...data });
  } catch (e) {
    console.error("[api/herramienta-reposicion]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al cargar reposición" },
      { status: 500 },
    );
  }
}
