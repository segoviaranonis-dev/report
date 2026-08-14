import { NextRequest, NextResponse } from "next/server";
import { requirePilaresAdmin } from "@/lib/pilares/auth-api";
import { parseTipoV2Id, proveedorIdFromTipoV2 } from "@/lib/pilares/constants";
import { estandarToTono, findColorEstandarInCatalog, type ColorEstandar } from "@/lib/pilares/colores-estandar";
import { parseTonoCanon, tonoPaleta, tonoSolido } from "@/lib/pilares/color-canon";
import {
  ensureTonoCanonColumn,
  loadColores,
  loadColoresEstandar,
  loadColoresResumen,
  loadPrimeraImagenPorColorCode,
  patchColorByPredominante,
  patchColorNombre,
  patchColorRango,
  patchColorTono,
} from "@/lib/pilares/queries";
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
  if (proveedorId == null) {
    return NextResponse.json({ error: "tipo_v2_id inválido" }, { status: 400 });
  }

  try {
    const pool = getRimecPool();
    await ensureTonoCanonColumn(pool);
    const withThumbs = sp.get("thumbs") !== "0";
    const [catalog, { rows: colorRows, total }, resumen] = await Promise.all([
      loadColoresEstandar(pool, proveedorId),
      loadColores(pool, proveedorId, {
        q: sp.get("q"),
        sinTono: sp.get("sin_tono") === "1",
        conTono: sp.get("con_tono") === "1",
        sinNombre: sp.get("sin_nombre") === "1",
        conNombre: sp.get("con_nombre") === "1",
        etiquetas: (sp.get("etiquetas") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        limit: Number(sp.get("limit") ?? 500),
        offset: Number(sp.get("offset") ?? 0),
        tipoV2Id,
      }),
      loadColoresResumen(pool, proveedorId),
    ]);
    // FOCO 2.3.5.5.2 — thumbs opcionales (thumbs=0 = grilla rápida)
    const thumbs = withThumbs
      ? await loadPrimeraImagenPorColorCode(
          pool,
          colorRows.map((r) => r.codigo_proveedor),
          tipoV2Id,
        )
      : null;
    const rows = colorRows.map((r) => ({
      ...r,
      thumb: thumbs?.get(String(r.codigo_proveedor).trim()) ?? null,
    }));
    return NextResponse.json({
      configured: true,
      tipo_v2_id: tipoV2Id,
      proveedor_id: proveedorId,
      rows,
      total,
      resumen,
      estandar: catalog,
      thumbs: withThumbs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar color";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildTonoFromBody(body: Record<string, unknown>, catalog?: ColorEstandar[]): Record<string, unknown> | null {
  if (body.tono_canon != null) {
    const parsed = parseTonoCanon(body.tono_canon);
    if (!parsed) return null;
    return parsed;
  }
  const etiqueta = String(body.etiqueta ?? "").trim();
  const hex = String(body.hex ?? "").trim();
  const swatches = body.swatches;
  if (etiqueta && Array.isArray(swatches) && swatches.length > 0) {
    return tonoPaleta(etiqueta, swatches.map(String));
  }
  if (etiqueta && hex) {
    const std = catalog ? findColorEstandarInCatalog(etiqueta, catalog) : undefined;
    if (std) return estandarToTono(std);
    return tonoSolido(etiqueta, hex);
  }
  return null;
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
    await ensureTonoCanonColumn(pool);

    if (body.rango) {
      const catalog = await loadColoresEstandar(pool, proveedorId);
      const desde = String(body.desde ?? "").trim();
      const hasta = String(body.hasta ?? "").trim();
      if (!desde || !hasta) {
        return NextResponse.json({ ok: false, error: "Código inicial y final requeridos" }, { status: 400 });
      }
      if (desde > hasta) {
        return NextResponse.json({ ok: false, error: "Código inicial debe ser ≤ final" }, { status: 400 });
      }

      const usarPredominante = Boolean(body.usar_predominante);
      const tonoFijo = body.usar_predominante ? null : buildTonoFromBody(body, catalog);
      if (!usarPredominante && !tonoFijo) {
        return NextResponse.json(
          { ok: false, error: "Elegí color estándar o activá «sugerir desde nombre»" },
          { status: 400 },
        );
      }

      const updated = await patchColorRango(pool, proveedorId, desde, hasta, {
        tonoFijo: tonoFijo ?? undefined,
        hexDefault: String(body.hex ?? "#94a3b8"),
        usarPredominante,
        soloSinTono: Boolean(body.solo_sin_tono),
        catalog,
      });
      return NextResponse.json({ ok: true, updated });
    }

    if (body.sync_predominante) {
      const predominante = String(body.predominante ?? "").trim();
      if (!predominante) {
        return NextResponse.json({ ok: false, error: "predominante requerido" }, { status: 400 });
      }

      let tono: Record<string, unknown> | null = null;
      if (body.clear_tono) {
        tono = null;
      } else if (body.tono_canon != null) {
        tono = parseTonoCanon(body.tono_canon) as Record<string, unknown> | null;
      }
      if (!body.clear_tono && !tono) {
        const catalog = await loadColoresEstandar(pool, proveedorId);
        tono = buildTonoFromBody(body, catalog);
      }
      if (!body.clear_tono && !tono) {
        return NextResponse.json({ ok: false, error: "tono_canon inválido" }, { status: 400 });
      }

      const updated = await patchColorByPredominante(pool, proveedorId, predominante, tono);
      return NextResponse.json({ ok: true, updated, predominante });
    }

    // Lote por ids ciegos (sin predominante) — tono + nombre provisional
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = body.ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n));
      if (!ids.length) {
        return NextResponse.json({ ok: false, error: "ids inválidos" }, { status: 400 });
      }
      let tono: Record<string, unknown> | null = null;
      if (body.clear_tono) tono = null;
      else if (body.tono_canon != null) {
        tono = parseTonoCanon(body.tono_canon) as Record<string, unknown> | null;
      }
      if (!body.clear_tono && !tono) {
        return NextResponse.json({ ok: false, error: "tono_canon inválido" }, { status: 400 });
      }
      let updated = 0;
      for (const id of ids) {
        if (await patchColorTono(pool, id, proveedorId, tono)) updated += 1;
        if (tono) {
          const et = String((tono as { etiqueta?: string }).etiqueta ?? "").trim().toUpperCase();
          if (et) await patchColorNombre(pool, id, proveedorId, et);
        }
      }
      return NextResponse.json({ ok: true, updated });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    // Solo enriquecer nombre (ciego → texto proveedor / provisional)
    if (body.nombre != null && body.tono_canon == null && !body.clear_tono) {
      const okNombre = await patchColorNombre(pool, id, proveedorId, String(body.nombre));
      if (!okNombre) {
        return NextResponse.json(
          { ok: false, error: "No se pudo guardar nombre (vacío o ya tenía texto)" },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true, nombre: String(body.nombre).trim() });
    }

    let tono: Record<string, unknown> | null = null;
    if (body.clear_tono) {
      tono = null;
    } else if (body.tono_canon != null) {
      tono = parseTonoCanon(body.tono_canon) as Record<string, unknown> | null;
    } else {
      const catalog = await loadColoresEstandar(pool, proveedorId);
      tono = buildTonoFromBody(body, catalog);
    }
    if (tono === null && !body.clear_tono) {
      return NextResponse.json({ ok: false, error: "tono_canon inválido" }, { status: 400 });
    }

    const ok = await patchColorTono(pool, id, proveedorId, tono);
    if (!ok) return NextResponse.json({ ok: false, error: "Fila no encontrada" }, { status: 404 });

    // Ciego: al asignar tono, completar nombre vacío con etiqueta (paridad BLANCO/MARINO)
    let nombreEscrito: string | null = null;
    if (tono && body.nombre != null) {
      const n = String(body.nombre).trim();
      if (n && (await patchColorNombre(pool, id, proveedorId, n))) nombreEscrito = n;
    } else if (tono) {
      const et = String((tono as { etiqueta?: string }).etiqueta ?? "").trim().toUpperCase();
      if (et && (await patchColorNombre(pool, id, proveedorId, et))) nombreEscrito = et;
    }

    return NextResponse.json({ ok: true, nombre: nombreEscrito });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar color";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
