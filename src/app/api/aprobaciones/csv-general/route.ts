import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isNivelDios } from "@/lib/auth/nivel-dios";
import {
  buildCsvGeneralAprobaciones,
  csvGeneralFilename,
} from "@/app/aprobaciones/lib/csv-general-export";
import { checkAprobacionesDbSchema } from "@/app/aprobaciones/lib/db-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return NextResponse.json(
      { error: "Nivel Dios requerido: rol_id=1 y categoria=DIOS" },
      { status: 403 },
    );
  }

  const health = await checkAprobacionesDbSchema();
  if (!health.ok) {
    return NextResponse.json(
      {
        error: health.mensaje,
        hint: "Ejecutar: node scripts/aplicar_migracion_114.mjs",
      },
      { status: 503 },
    );
  }

  try {
    const csv = await buildCsvGeneralAprobaciones();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvGeneralFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
