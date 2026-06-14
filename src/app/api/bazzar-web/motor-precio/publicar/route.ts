import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { publicarPreciosWeb } from "@/lib/bazzar-web/motor-precio/catalogo";

export async function POST() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const result = await publicarPreciosWeb();
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[motor-precio/publicar]", err);
    return NextResponse.json({ ok: false, error: "Error al publicar" }, { status: 500 });
  }
}
