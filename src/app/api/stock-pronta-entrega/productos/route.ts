import { NextRequest, NextResponse } from "next/server";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import {
  invalidarCachePeProductos,
  listImportadoProductosCached,
  listImportadoProductosFresh,
} from "@/lib/stock-pronta-entrega/queries-productos-cached";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const fresh = sp.get("fresh") === "1";
  const opts = {
    deposito: sp.get("deposito") ?? undefined,
    batch: sp.get("batch") ?? undefined,
    tipo_v2: (sp.get("tipo_v2") === "1" ? 1 : sp.get("tipo_v2") === "2" ? 2 : undefined) as
      | 1
      | 2
      | undefined,
  };

  try {
    const { data, cache, ms } = fresh
      ? await listImportadoProductosFresh(opts)
      : await listImportadoProductosCached(opts);
    return NextResponse.json(
      {
        ok: true,
        modulo: "stock-pronta-entrega",
        origen_stock: "pedido_proveedor_detalle",
        destino_catalogo: "v_stock_rimec",
        ...data,
        batch: sp.get("batch") ?? data.batch ?? undefined,
        cache,
        ms,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Pe-Productos-Ms": String(ms),
          "X-Pe-Productos-Cache": cache,
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error productos PE" },
      { status: 500 },
    );
  }
}

/** POST ?action=invalidate — tras import SDRM / mutaciones stock. */
export async function POST(req: NextRequest) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;
  const action = req.nextUrl.searchParams.get("action");
  if (action === "invalidate") {
    invalidarCachePeProductos();
    return NextResponse.json({ ok: true, invalidated: true });
  }
  return NextResponse.json({ ok: false, error: "action requerida" }, { status: 400 });
}
