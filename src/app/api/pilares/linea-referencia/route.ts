import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import {
  assertMaestrasPermitidasParaTipoV2,
} from "@/lib/pilares/validar-maestras-pilares";
import {
  loadEstiloSugeridoLineaReferencia,
  loadLineaReferencia,
  loadLineaReferenciaCascada,
  loadLineaReferenciaFiltros,
  loadLineaReferenciaProblemasEstiloResumen,
  loadPilaresMaestras,
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

function parseIdList(raw: string | null): number[] | null {
  if (!raw?.trim()) return null;
  if (raw === "__null__") return null;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return ids.length ? ids : null;
}

function parseConImagen(raw: string | null): boolean | null {
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return null;
}

function filterOptsFromSearchParams(sp: URLSearchParams): LineaReferenciaFilterOpts {
  const estiloRaw = sp.get("estilo_ids") || sp.get("estilo_id");
  const tipo1Raw = sp.get("tipo_1_ids") || sp.get("tipo_1_id");
  const generoRaw = sp.get("genero_ids") || sp.get("genero_id");
  const marcaIdsRaw = sp.get("marca_ids");
  const marcaLegacy = sp.get("marca");
  const problemasEstilo = sp.get("problemas_estilo") === "1";
  const estiloNull = !problemasEstilo && estiloRaw === "__null__";
  const estiloIds = problemasEstilo || estiloNull ? null : parseIdList(estiloRaw);
  const origenRaw = (sp.get("origen_tipo") || "TODOS").toUpperCase();
  const origenTipo =
    origenRaw.includes("PRONTA")
      ? ("PRONTA_ENTREGA" as const)
      : origenRaw === "CP" || origenRaw.includes("PREVIA")
        ? ("CP" as const)
        : ("TODOS" as const);
  const parseStrList = (raw: string | null) =>
    raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  return {
    marca: marcaLegacy === "__null__" ? "__null__" : !marcaIdsRaw ? marcaLegacy || null : null,
    marcaIds: marcaLegacy === "__null__" ? null : parseIdList(marcaIdsRaw),
    marcaNull: marcaLegacy === "__null__",
    generoNull: generoRaw === "__null__",
    generoIds: generoRaw === "__null__" ? null : parseIdList(generoRaw),
    generoId: null,
    estiloNull,
    tipo1Null: tipo1Raw === "__null__",
    estiloIds,
    estiloId: null,
    tipo1Ids: tipo1Raw === "__null__" ? null : parseIdList(tipo1Raw),
    tipo1Id: null,
    lineaCodigos: parseLineaCodigos(sp.get("linea_codigos")),
    lineaIds: parseIdList(sp.get("linea_ids")),
    referenciaIds: parseIdList(sp.get("referencia_ids")),
    buscar: sp.get("q") || sp.get("buscar") || null,
    origenTipo,
    depositoCodigo: sp.get("deposito_codigo") || null,
    tipoGrupos: parseStrList(sp.get("tipo_grupos")),
    materialFamilias: parseStrList(sp.get("material_familias")),
    colorFamilias: parseStrList(sp.get("color_familias")),
    problemasEstilo,
    conImagen: parseConImagen(sp.get("con_imagen")),
  };
}

function filterOptsFromBody(body: Record<string, unknown>): LineaReferenciaFilterOpts {
  const asStr = (v: unknown) => (typeof v === "string" ? v : v == null ? null : String(v));
  const asIdList = (v: unknown): number[] | null => {
    if (Array.isArray(v)) {
      const ids = v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
      return ids.length ? ids : null;
    }
    if (typeof v === "string") return parseIdList(v);
    return null;
  };
  const asStrList = (v: unknown): string[] | null => {
    if (Array.isArray(v)) {
      const xs = v.map((x) => String(x).trim()).filter(Boolean);
      return xs.length ? xs : null;
    }
    if (typeof v === "string" && v.trim()) {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return null;
  };
  const estiloRaw = body.estilo_id ?? body.estilo_ids;
  const tipo1Raw = body.tipo_1_id ?? body.tipo_1_ids;
  const lineas = Array.isArray(body.lineas)
    ? body.lineas.map((x) => String(x).trim()).filter(Boolean)
    : null;
  const origenRaw = String(body.origen_tipo ?? "TODOS").toUpperCase();
  const origenTipo =
    origenRaw.includes("PRONTA")
      ? ("PRONTA_ENTREGA" as const)
      : origenRaw === "CP" || origenRaw.includes("PREVIA")
        ? ("CP" as const)
        : ("TODOS" as const);
  const estiloNull = estiloRaw === "__null__";
  const problemasEstilo = body.problemas_estilo === true || body.problemas_estilo === 1 || body.problemas_estilo === "1";
  return {
    marca: body.marca === "__null__" ? "__null__" : typeof body.marca === "string" ? body.marca : null,
    marcaIds: asIdList(body.marca_ids),
    marcaNull: body.marca === "__null__",
    generoIds: asIdList(body.genero_ids),
    generoId: null,
    estiloNull,
    tipo1Null: tipo1Raw === "__null__",
    estiloIds: problemasEstilo || estiloNull ? null : asIdList(estiloRaw),
    estiloId:
      !Array.isArray(estiloRaw) && estiloRaw !== "__null__" && estiloRaw != null && estiloRaw !== ""
        ? Number(estiloRaw)
        : null,
    tipo1Ids: tipo1Raw === "__null__" ? null : asIdList(tipo1Raw),
    tipo1Id: null,
    lineaCodigos: lineas?.length ? lineas : parseLineaCodigos(asStr(body.linea_codigos)),
    lineaIds: asIdList(body.linea_ids),
    referenciaIds: asIdList(body.referencia_ids),
    buscar: asStr(body.q) || asStr(body.buscar),
    origenTipo,
    depositoCodigo: asStr(body.deposito_codigo),
    tipoGrupos: asStrList(body.tipo_grupos),
    materialFamilias: asStrList(body.material_familias),
    colorFamilias: asStrList(body.color_familias),
    problemasEstilo,
    conImagen: parseConImagen(asStr(body.con_imagen)),
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
    const [{ rows, total }, filtros, cascada, problemasResumen, maestras] = await Promise.all([
      loadLineaReferencia(pool, tipoV2Id, {
        ...filterOpts,
        limit: Number(sp.get("limit") ?? 200),
        offset: Number(sp.get("offset") ?? 0),
      }),
      loadLineaReferenciaFiltros(pool, tipoV2Id),
      loadLineaReferenciaCascada(pool, tipoV2Id, filterOpts),
      loadLineaReferenciaProblemasEstiloResumen(pool, tipoV2Id),
      loadPilaresMaestras(pool, tipoV2Id),
    ]);

    const pairs = rows.map((r) => ({
      linea_codigo: r.linea_codigo,
      referencia_codigo: r.referencia_codigo,
    }));
    const [thumbMap, sugeridoMap] = await Promise.all([
      loadPrimeraImagenLineaReferencia(pool, pairs, tipoV2Id),
      filterOpts.problemasEstilo
        ? loadEstiloSugeridoLineaReferencia(pool, pairs, tipoV2Id, maestras.estilos)
        : Promise.resolve(new Map<string, { id: number; label: string }>()),
    ]);

    const rowsWithThumb = rows.map((r) => {
      const key = `${r.linea_codigo}\0${r.referencia_codigo}`;
      const thumb = thumbMap.get(key) ?? null;
      const tieneImagen =
        Boolean(thumb?.imagen_nombre?.trim()) ||
        Boolean(thumb?.material_code?.trim() && thumb?.color_code?.trim());
      const labelEstilo = String(r.descp_grupo_estilo ?? "").trim().toUpperCase();
      const esProblema =
        r.grupo_estilo_id == null || labelEstilo === "OTROS";
      const kind =
        r.grupo_estilo_id == null ? "SIN_ESTILO" : labelEstilo === "OTROS" ? "OTROS" : null;
      const sug = sugeridoMap.get(key) ?? null;
      return {
        ...r,
        thumb,
        es_problema_estilo: esProblema,
        tiene_imagen: tieneImagen,
        problema_estilo_kind: kind,
        estilo_sugerido_id: sug?.id ?? null,
        estilo_sugerido_label: sug?.label ?? null,
      };
    });

    return NextResponse.json({
      configured: true,
      tipo_v2_id: tipoV2Id,
      proveedor_id: proveedorId,
      rows: rowsWithThumb,
      total,
      filtros,
      cascada,
      problemas_estilo: problemasResumen,
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

    const id = Number(body.id);
    if (Number.isFinite(id)) {
      const hasGrupoEstilo = "grupo_estilo_id" in body;
      const hasTipo1 = "tipo_1_id" in body;
      const hasGenero = "genero_id" in body;
      if (!hasGrupoEstilo && !hasTipo1 && !hasGenero) {
        return NextResponse.json(
          { ok: false, error: "Seleccioná al menos Género, Estilo o Tipo 1" },
          { status: 400 },
        );
      }

      const fields: { grupo_estilo_id?: number | null; tipo_1_id?: number | null } = {};
      if (hasGrupoEstilo) {
        fields.grupo_estilo_id = body.grupo_estilo_id == null ? null : Number(body.grupo_estilo_id);
      }
      if (hasTipo1) {
        fields.tipo_1_id = body.tipo_1_id == null ? null : Number(body.tipo_1_id);
      }
      if (Object.keys(fields).length) {
        const violacionRow = await assertMaestrasPermitidasParaTipoV2(pool, tipoV2Id, fields);
        if (violacionRow) {
          return NextResponse.json({ ok: false, error: violacionRow }, { status: 400 });
        }
        const ok = await patchLineaReferencia(pool, id, proveedorId, fields);
        if (!ok) return NextResponse.json({ ok: false, error: "Fila no encontrada" }, { status: 404 });
        return NextResponse.json({ ok: true });
      }
    }

    if (generoId == null && grupoEstiloId == null && tipo1Id == null) {
      return NextResponse.json(
        { ok: false, error: "Seleccioná al menos Género, Estilo o Tipo 1" },
        { status: 400 },
      );
    }

    const lrFields: { grupo_estilo_id?: number; tipo_1_id?: number } = {};
    if (grupoEstiloId != null) lrFields.grupo_estilo_id = grupoEstiloId;
    if (tipo1Id != null) lrFields.tipo_1_id = tipo1Id;

    const violacion = await assertMaestrasPermitidasParaTipoV2(pool, tipoV2Id, lrFields);
    if (violacion) {
      return NextResponse.json({ ok: false, error: violacion }, { status: 400 });
    }

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
