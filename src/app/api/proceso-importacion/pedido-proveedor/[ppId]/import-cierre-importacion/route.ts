import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { importCierreImportacionCsv } from "@/lib/pedido-proveedor/import-cierre-importacion";
import { getPpDetalle } from "@/lib/pedido-proveedor/detail-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export const maxDuration = 120;

type Params = { params: Promise<{ ppId: string }> };

/** POST — import CSV cierre · IC + FI Nexus + Factura Real (Carlos) */
export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  const pool = getRimecPool();
  const header = await getPpDetalle(pool, ppId);
  if (!header) {
    return NextResponse.json({ ok: false, error: "PP no encontrado" }, { status: 404 });
  }

  try {
    const ct = req.headers.get("content-type") ?? "";
    let csvText = "";
    let dryRun = false;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ ok: false, error: "Archivo CSV obligatorio" }, { status: 400 });
      }
      csvText = await file.text();
      dryRun = form.get("dry_run") === "1" || form.get("dry_run") === "true";
    } else {
      const body = (await req.json()) as { csv?: string; dry_run?: boolean };
      csvText = body.csv ?? "";
      dryRun = Boolean(body.dry_run);
    }

    if (!csvText.trim()) {
      return NextResponse.json({ ok: false, error: "CSV vacío" }, { status: 400 });
    }

    const result = await importCierreImportacionCsv(pool, ppId, csvText, {
      dryRun,
      syncLogistica: !dryRun,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    return icApiErrorResponse(e, "Error al importar cierre Carlos↔Nexus");
  }
}
