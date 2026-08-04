import { NextResponse } from "next/server";
import { fetchAprobacionesFiltrosOpciones } from "@/app/aprobaciones/lib/aprobaciones-queries";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";

/** GET — opciones multi-select para indagación. ?scope=basico|completo */
export async function GET(request: Request) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }
  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope = scopeParam === "completo" ? "completo" : "basico";
  try {
    const opciones = await fetchAprobacionesFiltrosOpciones(scope);
    return NextResponse.json(opciones);
  } catch (e) {
    console.error("[aprobaciones/filtros/opciones]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
