import { NextResponse } from "next/server";
import { runProformaImportPython } from "@/lib/pedido-proveedor/run-python-pp";
import { borrarImportacionPp } from "@/lib/pedido-proveedor/borrar-import";
import { patchPpCabecera } from "@/lib/pedido-proveedor/cabecera-actions";
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

    const pool = getRimecPool();
    const quincenaRaw = form.get("quincena_arribo_id");
    const quincenaId = quincenaRaw != null && String(quincenaRaw).trim() !== "" ? Number(quincenaRaw) : null;
    const descRaw = (k: string) => {
      const v = form.get(k);
      if (v == null || String(v).trim() === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const nroExtRaw = form.get("nro_pedido_externo");
    const cabeceraPatch: Parameters<typeof patchPpCabecera>[2] = {};
    if (proforma) cabeceraPatch.numero_proforma = proforma;
    if (nroExtRaw != null) cabeceraPatch.nro_pedido_externo = String(nroExtRaw);
    if (quincenaId != null && Number.isFinite(quincenaId) && quincenaId > 0) {
      cabeceraPatch.quincena_arribo_id = quincenaId;
    }
    const d1 = descRaw("descuento_1");
    const d2 = descRaw("descuento_2");
    const d3 = descRaw("descuento_3");
    const d4 = descRaw("descuento_4");
    if (d1 !== undefined) cabeceraPatch.descuento_1 = d1;
    if (d2 !== undefined) cabeceraPatch.descuento_2 = d2;
    if (d3 !== undefined) cabeceraPatch.descuento_3 = d3;
    if (d4 !== undefined) cabeceraPatch.descuento_4 = d4;
    if (Object.keys(cabeceraPatch).length > 0) {
      const patched = await patchPpCabecera(pool, ppId, cabeceraPatch);
      if (!patched.ok) {
        return NextResponse.json({ ok: false, error: patched.error }, { status: 400 });
      }
    }

    if (borrarPrevio) {
      const del = await borrarImportacionPp(pool, ppId);
      if (!del.ok) {
        return NextResponse.json({ ok: false, error: del.error }, { status: 400 });
      }
    }

    const phaseRaw = String(form.get("phase") ?? "all");
    const phase =
      phaseRaw === "ppd_plan" || phaseRaw === "ppd" || phaseRaw === "fi" || phaseRaw === "all"
        ? phaseRaw
        : "all";
    const fiOffset = Number(form.get("fi_offset") ?? 0);
    const fiBatchRaw = Number(form.get("fi_batch") ?? 0);
    const ppdOffset = Number(form.get("ppd_offset") ?? 0);
    const ppdBatchRaw = Number(form.get("ppd_batch") ?? 0);

    const result = await runProformaImportPython(ppId, buffer, name, {
      proforma,
      borrarImport: false,
      phase,
      fiOffset: Number.isFinite(fiOffset) ? fiOffset : 0,
      fiBatchSize: Number.isFinite(fiBatchRaw) && fiBatchRaw > 0 ? fiBatchRaw : undefined,
      ppdOffset: Number.isFinite(ppdOffset) ? ppdOffset : 0,
      ppdBatchSize: Number.isFinite(ppdBatchRaw) && ppdBatchRaw > 0 ? ppdBatchRaw : undefined,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return icApiErrorResponse(e, "Error al importar proforma");
  }
}
