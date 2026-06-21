import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import {
  loadLineaReferencia,
  loadLineaReferenciaCascada,
  loadLineaReferenciaFiltros,
  loadPrimeraImagenLineaReferencia,
  patchLineaGeneroByLineas,
  patchLineaGeneroByScope,
  patchLineaRangoGenero,
  patchLineaReferencia,
  patchLineaReferenciaByLineas,
  patchLineaReferenciaByScope,
  patchLineaReferenciaRango,
} from "@/lib/pilares/queries";
import type { LineaReferenciaFilterOpts, TipoV2Id } from "@/lib/pilares/types";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

function parseOptionalInt(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalId(raw: unknown): number | null {
  if (raw == null || raw === "" || raw === "none") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseLineaCodigos(raw: string | null): string[] | null {
  if (!raw?.trim()) return null;
  const codes = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return codes.length ? codes : null;
}

function filterOptsFromSearchParams(sp: URLSearchParams): LineaReferenciaFilterOpts {
  const estiloRaw = sp.get("estilo_id");
  const tipo1Raw = sp.get("tipo_1_id");
  return {
    marca: sp.get("marca") === "__null__" ? "__null__" : sp.get("marca") || null,
    estiloNull: estiloRaw === "__null__",
    tipo1Null: tipo1Raw === "__null__",
    estiloId: estiloRaw === "__null__" ? null : parseOptionalInt(estiloRaw),
    tipo1Id: tipo1Raw === "__null__" ? null : parseOptionalInt(tipo1Raw),
    lineaCodigos: parseLineaCodigos(sp.get("linea_codigos")),
  };
}

function filterOptsFromBody(body: Record<string, unknown>): LineaReferenciaFilterOpts {
  const estiloRaw = body.estilo_id;
  const tipo1Raw = body.tipo_1_id;
  const lineas = Array.isArray(body.lineas)
    ? body.lineas.map((x) => String(x).trim()).filter(Boolean)
    : null;
  return {
    marca: body.marca === "__null__" ? "__null__" : typeof body.marca === "string" ? body.marca : null,
    estiloNull: estiloRaw === "__null__",
    tipo1Null: tipo1Raw === "__null__",
    estiloId:
      estiloRaw === "__null__" || estiloRaw == null || estiloRaw === ""
        ? null
        : Number(estiloRaw),
    tipo1Id:
      tipo1Raw === "__null__" || tipo1Raw == null || tipo1Raw === "" ? null : Number(tipo1Raw),
    lineaCodigos: lineas?.length ? lineas : null,
  };
}

export async function GET(req: NextRequest) {
  const gate = await requirePilaresAdmin();
  if (gate.error) return gate.error;
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({ configured: false, rows: [], total: 0 }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const tipoV2Id = parseTipoV2Id(sp.get("tipo_v2_id")) as TipoV2Id;
  const proveedorId = proveedorIdFromTipoV2(tipoV2Id);
  const filterOpts = filterOptsFromSearchParams(sp);

  try {
    const pool = getRimecPool();
    const [{ rows, total }, filtros, cascada] = await Promise.all([
      loadLineaReferencia(pool, tipoV2Id, {
        marca: filterOpts.marca,
        estiloNull: filterOpts.estiloNull,
        tipo1Null: filterOpts.tipo1Null,
        estiloId: filterOpts.estiloId,
        tipo1Id: filterOpts.tipo1Id,
        lineaCodigos: filterOpts.lineaCodigos,
        limit: Number(sp.get("limit") ?? 200),
        offset: Number(sp.get("offset") ?? 0),
      }),
      loadLineaReferenciaFiltros(pool, tipoV2Id),
      loadLineaReferenciaCascada(pool, tipoV2Id, filterOpts),
    ]);

    const thumbMap = await loadPrimeraImagenLineaReferencia(
      pool,
      rows.map((r) => ({
        linea_codigo: r.linea_codigo,
        referencia_codigo: r.referencia_codigo,
      })),
      tipoV2Id,
    );
    const rowsWithThumb = rows.map((r) => ({
      ...r,
      thumb: thumbMap.get(`${r.linea_codigo}\0${r.referencia_codigo}`) ?? null,
    }));

    return NextResponse.json({
      configured: true,
      tipo_v2_id: tipoV2Id,
      proveedor_id: proveedorId,
      rows: rowsWithThumb,
      total,
      filtros,
      cascada,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar linea_referencia";
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
    const generoId = parseOptionalId(body.genero_id);
    const grupoEstiloId = parseOptionalId(body.grupo_estilo_id);
    const tipo1Id = parseOptionalId(body.tipo_1_id);

    if (generoId == null && grupoEstiloId == null && tipo1Id == null) {
      return NextResponse.json(
        { ok: false, error: "Seleccioná al menos Género, Estilo o Tipo 1" },
        { status: 400 },
      );
    }

    const lrFields: { grupo_estilo_id?: number; tipo_1_id?: number } = {};
    if (grupoEstiloId != null) lrFields.grupo_estilo_id = grupoEstiloId;
    if (tipo1Id != null) lrFields.tipo_1_id = tipo1Id;

    if (body.rango) {
      const desde = String(body.desde ?? "").trim();
      const hasta = String(body.hasta ?? "").trim();
      if (!desde || !hasta) {
        return NextResponse.json({ ok: false, error: "Rango de línea inválido" }, { status: 400 });
      }
      if (desde > hasta) {
        return NextResponse.json({ ok: false, error: "Línea inicial debe ser ≤ línea final" }, { status: 400 });
      }

      let lineasUpdated = 0;
      let lrUpdated = 0;
      if (generoId != null) {
        lineasUpdated = await patchLineaRangoGenero(pool, proveedorId, desde, hasta, generoId);
      }
      if (Object.keys(lrFields).length) {
        lrUpdated = await patchLineaReferenciaRango(pool, proveedorId, desde, hasta, lrFields);
      }
      return NextResponse.json({ ok: true, lineas_updated: lineasUpdated, lr_updated: lrUpdated });
    }

    const id = Number(body.id);
    if (Number.isFinite(id)) {
      const fields: { grupo_estilo_id?: number | null; tipo_1_id?: number | null } = {};
      if ("grupo_estilo_id" in body) {
        fields.grupo_estilo_id = body.grupo_estilo_id == null ? null : Number(body.grupo_estilo_id);
      }
      if ("tipo_1_id" in body) {
        fields.tipo_1_id = body.tipo_1_id == null ? null : Number(body.tipo_1_id);
      }
      const ok = await patchLineaReferencia(pool, id, proveedorId, fields);
      if (!ok) return NextResponse.json({ ok: false, error: "Fila no encontrada" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    const filterOpts = filterOptsFromBody(body);
    const lineas = filterOpts.lineaCodigos ?? [];
    const useLineas = lineas.length > 0;
    const useScope = Boolean(body.scope) || !useLineas;

    if (!useLineas && !useScope) {
      return NextResponse.json(
        { ok: false, error: "Indicá líneas o alcance por filtros" },
        { status: 400 },
      );
    }

    let lineasUpdated = 0;
    let lrUpdated = 0;

    if (generoId != null) {
      lineasUpdated = useLineas
        ? await patchLineaGeneroByLineas(pool, proveedorId, lineas, generoId)
        : await patchLineaGeneroByScope(pool, proveedorId, filterOpts, generoId);
    }
    if (Object.keys(lrFields).length) {
      lrUpdated = useLineas
        ? await patchLineaReferenciaByLineas(pool, proveedorId, lineas, lrFields)
        : await patchLineaReferenciaByScope(pool, proveedorId, filterOpts, lrFields);
    }

    return NextResponse.json({
      ok: true,
      lineas_updated: lineasUpdated,
      lr_updated: lrUpdated,
      scope: useLineas ? "lineas" : "filtros",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar linea_referencia";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
