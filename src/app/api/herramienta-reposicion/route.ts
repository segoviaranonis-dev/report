import { NextRequest, NextResponse } from "next/server";
import {
  getHerramientaReposicionCached,
  getHerramientaReposicionFresh,
} from "@/lib/herramienta-reposicion/queries-cached";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, configured: false, error: "DATABASE_URL no configurada" },
      { status: 503 },
    );
  }
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const t0 = Date.now();
    const data = fresh
      ? await getHerramientaReposicionFresh()
      : await getHerramientaReposicionCached();
    const ms = Date.now() - t0;
    return NextResponse.json(
      { ok: true, configured: true, cache: fresh ? "bypass" : "server", ms, ...data },
      {
        headers: {
          /** Integridad AM: prohibido HTTP cache del navegador (venenaba «Sin llegada»). */
          "Cache-Control": "no-store",
          "X-Reposicion-Ms": String(ms),
          "X-Reposicion-Cache": fresh ? "bypass" : "server",
        },
      },
    );
  } catch (e) {
    console.error("[api/herramienta-reposicion]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al cargar reposición" },
      { status: 500 },
    );
  }
}
