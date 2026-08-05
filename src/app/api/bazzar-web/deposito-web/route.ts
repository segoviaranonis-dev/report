import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { fetchDepositoWebData } from "@/lib/bazzar-web/deposito-web/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json(
      { configured: false, ingreso: [], vendible: [], vendibleOk: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await fetchDepositoWebData();
    return NextResponse.json(
      { configured: true, ...data },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al cargar depósito web";
    console.error("[bazzar-web/deposito-web]", err);
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
