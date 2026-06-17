import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import { loadLineas, loadLineasFiltros, loadLineasResumen, patchLinea, patchLineaRangoGenero } from "@/lib/pilares/queries";
import type { TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export async function GET(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, rows: [], total: 0 }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const tipoV2Id = parseTipoV2Id(sp.get("tipo_v2_id")) as TipoV2Id;
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);

  try {
    const pool = getRimecPool();
    const [{ rows, total }, filtros, resumen] = await Promise.all([
      loadLineas(pool, tipoV2Id, {
        marca: sp.get("marca") === "__null__" ? "__null__" : sp.get("marca") || null,
        genero: sp.get("genero") === "__null__" ? "__null__" : sp.get("genero") || null,
        limit: Number(sp.get("limit") ?? 500),
        offset: Number(sp.get("offset") ?? 0),
      }),
      loadLineasFiltros(pool, tipoV2Id),
      loadLineasResumen(pool, tipoV2Id),
    ]);
    return NextResponse.json({
      configured: true,
      tipo_v2_id: tipoV2Id,
      proveedor_id: proveedorId,
      rows,
      total,
      filtros,
      resumen,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar linea";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const tipoV2Id = parseTipoV2Id(String(body.tipo_v2_id ?? 1)) as TipoV2Id;
    const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
    if (proveedorId == null) {
      return NextResponse.json({ ok: false, error: "tipo_v2_id inválido" }, { status: 400 });
    }

    const pool = getRimecPool();

    if (body.rango) {
      const desde = String(body.desde ?? "").trim();
      const hasta = String(body.hasta ?? "").trim();
      const generoId = Number(body.genero_id);
      if (!desde || !hasta || !Number.isFinite(generoId)) {
        return NextResponse.json({ ok: false, error: "Rango o género inválido" }, { status: 400 });
      }
      const updated = await patchLineaRangoGenero(pool, proveedorId, desde, hasta, generoId);
      return NextResponse.json({ ok: true, updated });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const fields: { marca_id?: number | null; genero_id?: number | null } = {};
    if ("marca_id" in body) fields.marca_id = body.marca_id == null ? null : Number(body.marca_id);
    if ("genero_id" in body) fields.genero_id = body.genero_id == null ? null : Number(body.genero_id);

    const ok = await patchLinea(pool, id, proveedorId, fields);
    if (!ok) return NextResponse.json({ ok: false, error: "Fila no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar linea";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
