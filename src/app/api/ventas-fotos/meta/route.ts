import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isPoolSaturatedError, poolSaturatedResponse } from "@/lib/rimec/pool-saturated";
import { getVentasFotosMeta } from "@/lib/ventas-fotos/queries";
import type { VentasFotosMetaResponse } from "@/lib/ventas-fotos/types";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      marcas: [],
      message: "DATABASE_URL no configurada. El módulo queda en modo demostración.",
    } satisfies VentasFotosMetaResponse);
  }

  try {
    const marcas = await getVentasFotosMeta(getRimecPool());
    return NextResponse.json({ configured: true, marcas } satisfies VentasFotosMetaResponse);
  } catch (e) {
    if (isPoolSaturatedError(e)) {
      return NextResponse.json(
        { configured: true, marcas: [], ...poolSaturatedResponse() } satisfies VentasFotosMetaResponse & { code?: string },
        { status: 503, headers: { "Retry-After": "15" } },
      );
    }
    const message = e instanceof Error ? e.message : "Error cargando marcas";
    return NextResponse.json(
      { configured: true, marcas: [], message } satisfies VentasFotosMetaResponse,
      { status: 500 },
    );
  }
}
