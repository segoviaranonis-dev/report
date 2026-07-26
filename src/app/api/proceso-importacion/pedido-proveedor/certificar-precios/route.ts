import { NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import {
  certificarPreciosCpRimec,
  formatCertificacionPreciosCp,
} from "@/lib/pedido-proveedor/certificar-precios-cp";
import { recalcularFisPp } from "@/lib/pedido-proveedor/recalcular-fis-pp";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

/** GET/POST — certificación 8 gates precios CP (integridad bancaria). */
export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const url = new URL(req.url);
  const ppId = url.searchParams.get("ppId");
  const n = ppId ? Number(ppId) : undefined;

  const cert = await certificarPreciosCpRimec(getRimecPool(), Number.isFinite(n) ? n : undefined);
  return NextResponse.json({
    ok: cert.ok,
    certificacion: cert,
    msg: formatCertificacionPreciosCp(cert),
  });
}

/** Reparación completa: sync PPD + recalc FI + cert. */
export async function POST(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  let body: { pp_id?: number; recalc_fi?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* vacío = cert global */
  }

  const pool = getRimecPool();
  const ppId = body.pp_id != null ? Number(body.pp_id) : null;

  const { rows: syncRows } = await pool.query(`SELECT reparar_snapshot_tiers_cp($1) AS r`, [ppId]);
  const sync = syncRows[0]?.r;

  const recalcResults: unknown[] = [];
  if (body.recalc_fi !== false && ppId != null && Number.isFinite(ppId)) {
    recalcResults.push(await recalcularFisPp(ppId, { incluirConfirmadas: true }));
  }

  await pool.query(`
    UPDATE carrito_item ci
    SET precio_snapshot = v.lpn
    FROM v_stock_rimec v
    JOIN pedido_proveedor pp ON pp.id = v.pp_id
    WHERE ci.det_id = v.det_id
      AND pp.estado_transito = 'EN_TRANSITO'
      AND COALESCE(v.lpn, 0) > 0
      AND ci.precio_snapshot IS DISTINCT FROM v.lpn
  `);

  const cert = await certificarPreciosCpRimec(pool, ppId ?? undefined);

  return NextResponse.json(
    {
      ok: cert.ok,
      sync,
      recalc: recalcResults,
      certificacion: cert,
      msg: formatCertificacionPreciosCp(cert),
    },
    { status: cert.ok ? 200 : 422 },
  );
}
