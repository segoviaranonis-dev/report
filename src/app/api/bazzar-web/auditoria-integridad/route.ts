import { NextResponse } from "next/server";
import { getAuditoriaStock } from "@/lib/bazzar-web/auditoria-integridad/queries";
import { getSiamesesBazzarWeb } from "@/lib/bazzar-web/auditoria-integridad/siameses";
import { getEstadisticaCruce } from "@/lib/bazzar-web/auditoria-integridad/estadistica";
import type { AuditoriaIntegridadPayload } from "@/lib/bazzar-web/auditoria-integridad/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [stock, estadistica] = await Promise.all([
      getAuditoriaStock(),
      getEstadisticaCruce(),
    ]);
    const payload: AuditoriaIntegridadPayload = {
      stock,
      siameses: getSiamesesBazzarWeb(),
      estadistica,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[bazzar-web/auditoria-integridad]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error auditoría" },
      { status: 500 },
    );
  }
}
