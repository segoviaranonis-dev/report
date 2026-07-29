import { NextRequest, NextResponse } from "next/server";
import {
  fetchFiAnuladas,
  fetchFiConfirmadas,
} from "@/app/aprobaciones/lib/aprobaciones-queries";
import { requireNivelDiosAction } from "@/app/aprobaciones/lib/require-nivel-dios";

/** GET ?tab=aprobados|anulados — carga lazy (no SSR). */
export async function GET(req: NextRequest) {
  const gate = await requireNivelDiosAction();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }
  const tab = req.nextUrl.searchParams.get("tab");
  try {
    if (tab === "aprobados") {
      const fis = await fetchFiConfirmadas();
      return NextResponse.json({ fis });
    }
    if (tab === "anulados") {
      const fis = await fetchFiAnuladas();
      return NextResponse.json({ fis });
    }
    return NextResponse.json({ error: "tab inválido" }, { status: 400 });
  } catch (e) {
    console.error("[aprobaciones/lista]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
