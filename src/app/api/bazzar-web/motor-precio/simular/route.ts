import { NextRequest, NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { simularPrecioWeb } from "@/lib/bazzar-web/motor-precio/reglas";

export async function POST(req: NextRequest) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const lpn = Number(body.lpn);
    const caso = String(body.caso ?? "DEFAULT");
    if (!Number.isFinite(lpn) || lpn <= 0) {
      return NextResponse.json({ error: "LPN inválido" }, { status: 400 });
    }
    const result = await simularPrecioWeb(lpn, caso);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[motor-precio/simular]", err);
    return NextResponse.json({ error: "Error al simular" }, { status: 500 });
  }
}
