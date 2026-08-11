import { NextResponse } from "next/server";
import {
  countByEstado,
  getReclamosCatalog,
  listReclamos,
} from "@/lib/situacion-financiera/reclamos";

export const dynamic = "force-dynamic";

/** GET · catálogo reclamos Sit Fin (≠ bugs) · 2.3.1.50.31 */
export async function GET() {
  const catalog = getReclamosCatalog();
  return NextResponse.json({
    ok: true,
    meta: catalog.meta,
    resumen: countByEstado(),
    reclamos: listReclamos(),
  });
}
