import { NextRequest, NextResponse } from "next/server";
import { importPpAbiertoDesdeBuffer } from "@/lib/herramienta-reposicion/pp-abierto-import";
import { invalidarCacheHerramientaReposicion } from "@/lib/herramienta-reposicion/queries-cached";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta archivo Excel (campo file)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importPpAbiertoDesdeBuffer(
      getRimecPool(),
      buffer,
      file.name || "proforma.xlsx",
    );
    invalidarCacheHerramientaReposicion();

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[api/herramienta-reposicion/pp-abierto/import]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error al importar PP abierto" },
      { status: 500 },
    );
  }
}
