import { NextResponse } from "next/server";
import { runProformaImportPython } from "@/lib/pedido-proveedor/run-python-pp";
import { borrarImportacionPp } from "@/lib/pedido-proveedor/borrar-import";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { getRimecPool } from "@/lib/rimec/pool";

/** PP programado grande (700+ SKUs · 39 FI) puede superar 60s en Vercel. */
export const maxDuration = 300;

type Params = { params: Promise<{ ppId: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Archivo proforma obligatorio" }, { status: 400 });
    }

    const proforma = String(form.get("numero_proforma") ?? "").trim();
    const borrarPrevio =
      form.get("borrar_previo") === "1" || form.get("borrar_previo") === "true";
    const name = file instanceof File ? file.name : "proforma.xls";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (borrarPrevio) {
      const del = await borrarImportacionPp(getRimecPool(), ppId);
      if (!del.ok) {
        return NextResponse.json({ ok: false, error: del.error }, { status: 400 });
      }
    }

    const result = await runProformaImportPython(ppId, buffer, name, { proforma, borrarImport: false });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return icApiErrorResponse(e, "Error al importar proforma");
  }
}
