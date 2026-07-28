import { NextResponse } from "next/server";

/**
 * Import Logística Rimec — pausado hasta Excel del Director.
 * El TXT anterior fue descartado; no aceptar imports hasta nuevo formato.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Import pausado: el Director trae Excel mejor estructurado. Esperá el archivo antes de cargar.",
    },
    { status: 503 },
  );
}
