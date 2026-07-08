import { NextResponse } from "next/server";
import { runProformaPreviewPython } from "@/lib/pedido-proveedor/run-python-pp";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";

type Params = { params: Promise<{ ppId: string }> };

/** Preview manual SHOP↔IC antes de import programado. */
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

    const name = file instanceof File ? file.name : "proforma.xls";
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runProformaPreviewPython(ppId, buffer, name);
    if (!result.ok && !result.emparejamientos?.length && !result.errores?.length) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error en preview proforma" },
      { status: 500 },
    );
  }
}
