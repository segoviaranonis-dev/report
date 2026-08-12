import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  publicarPreciosWeb,
  publicarPreciosWebSeleccion,
  type ModoPublicacion,
} from "@/lib/bazzar-web/motor-precio/catalogo";

export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    let body: { keys?: string[]; modo?: ModoPublicacion; todo?: boolean } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    const modo: ModoPublicacion = body.modo === "publicado" ? "publicado" : "nuevo";

    const result =
      Array.isArray(body.keys) && body.keys.length > 0
        ? await publicarPreciosWebSeleccion(body.keys, modo)
        : body.todo === true
          ? await publicarPreciosWeb()
          : {
              ok: false as const,
              publicados: 0,
              omitidos: 0,
              error: "Enviá keys[] (multi-select) o todo:true",
            };

    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ...result, modo });
  } catch (err) {
    console.error("[motor-precio/publicar]", err);
    return NextResponse.json({ ok: false, error: "Error al publicar" }, { status: 500 });
  }
}
