import { NextResponse } from "next/server";
import { getRimecPool } from "@/lib/rimec/pool";
import { icApiErrorResponse } from "@/lib/intencion-compra/ic-api-error";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { completarFiProgramadoPhased } from "@/lib/pedido-proveedor/proforma-programado-engine";
import { hasProformaFilas } from "@/lib/pedido-proveedor/proforma-snapshot";

export const maxDuration = 300;

type Params = { params: Promise<{ ppId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    const [snap, fiRes, ppdRes, icRes] = await Promise.all([
      hasProformaFilas(pool, ppId),
      pool.query<{ c: number }>("SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1", [ppId]),
      pool.query<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
        [ppId],
      ),
      pool.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM intencion_compra_pedido WHERE pedido_proveedor_id = $1`,
        [ppId],
      ),
    ]);
    const nFi = fiRes.rows[0]?.c ?? 0;
    const nPpd = ppdRes.rows[0]?.c ?? 0;
    const nIc = icRes.rows[0]?.c ?? 0;
    return NextResponse.json({
      ok: true,
      has_snapshot: snap,
      n_fi: nFi,
      n_ppd: nPpd,
      n_ic: nIc,
      fi_pendientes: nPpd > 0 && nFi < nIc,
      needs_proforma_file: nPpd > 0 && nFi === 0 && !snap,
    });
  } catch (e) {
    return icApiErrorResponse(e, "Error al consultar estado FI");
  }
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const ppId = Number((await params).ppId);
  if (!Number.isFinite(ppId)) {
    return NextResponse.json({ ok: false, error: "PP inválido" }, { status: 400 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let fileBuffer: Buffer | null = null;
    let fiOffset = 0;
    let fiBatchSize: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file && file instanceof Blob) {
        fileBuffer = Buffer.from(await file.arrayBuffer());
      }
      const off = Number(form.get("fi_offset") ?? 0);
      fiOffset = Number.isFinite(off) ? off : 0;
      const batch = Number(form.get("fi_batch") ?? 0);
      if (Number.isFinite(batch) && batch > 0) fiBatchSize = batch;
    } else {
      const body = (await req.json()) as { fi_offset?: number; fi_batch?: number };
      fiOffset = Number(body.fi_offset ?? 0);
      if (Number.isFinite(body.fi_batch) && body.fi_batch! > 0) fiBatchSize = body.fi_batch;
    }

    const result = await completarFiProgramadoPhased(ppId, {
      fileBuffer,
      fiOffset: Number.isFinite(fiOffset) ? fiOffset : 0,
      fiBatchSize,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return icApiErrorResponse(e, "Error al crear facturas internas");
  }
}
