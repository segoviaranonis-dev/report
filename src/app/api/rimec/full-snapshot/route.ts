/**
 * OT-INFORME-003 — POST /api/rimec/full-snapshot
 * Un solo JSON con KPIs, 8 bloques de datos y detalle pivot (servidor precalcula).
 *
 * Latencia: pivot + jerarquía por ids en paralelo; luego cascada. Pool pg singleton.
 * Clientes: misma dimensión que RIMEC Web / Sales Report (`cliente_v2` → columnas `cliente`,
 * `codigo_cliente` en `v_ventas_pivot`). La web importadora, más adelante, reforzará cadena
 * vía `cliente_cadena_v2` + `cadena_v2` (el pivot ya LEFT JOIN esa relación para `cadena`).
 */

import { NextResponse } from "next/server";
import { fetchCascadeDomains } from "@/lib/rimec/cascade-domains";
import { buildFullSnapshotResponse } from "@/lib/rimec/build-full-snapshot";
import type { FullSnapshotBody } from "@/lib/rimec/full-snapshot-types";
import { buildJerarquiaSql, mapJerarquiaQueryRows } from "@/lib/rimec/cliente-jerarquia-query";
import { buildPivotSql, enrichPivotRows } from "@/lib/rimec/pivot-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { defaultSalesReportFilters, type SalesReportFilters } from "@/modules/sales-report/types";
import { MES_NOMBRES } from "@/modules/sales-report/constants";

/** Mapa nombre→id reutilizado entre requests (categorías cambian poco; reduce una lectura a BD por arranque). */
let categoriaNombreToIdCache: Map<string, number> | undefined;

async function resolveCategoriaIdsFromNames(
  pool: ReturnType<typeof getRimecPool>,
  names: string[]
): Promise<number[]> {
  if (!names.length) return [];
  if (!categoriaNombreToIdCache) {
    const r = await pool.query<{ id_categoria: number; nombre: string }>(
      `SELECT id_categoria, UPPER(TRIM(descp_categoria)) AS nombre FROM categoria_v2`
    );
    categoriaNombreToIdCache = new Map(r.rows.map((x) => [x.nombre, x.id_categoria]));
  }
  const ids: number[] = [];
  for (const raw of names) {
    const k = String(raw).trim().toUpperCase();
    const id = categoriaNombreToIdCache.get(k);
    if (id !== undefined) ids.push(id);
  }
  return [...new Set(ids)];
}

async function mergeSnapshotFilters(
  body: FullSnapshotBody | null,
  pool: ReturnType<typeof getRimecPool>
): Promise<SalesReportFilters> {
  const d = defaultSalesReportFilters();
  if (!body || typeof body !== "object") return d;

  let meses = d.meses;
  if (Array.isArray(body.meses) && body.meses.length) {
    const first = body.meses[0];
    if (typeof first === "number") {
      meses = [...new Set(body.meses as number[])]
        .filter((x) => x >= 1 && x <= 12)
        .sort((a, b) => a - b)
        .map((i) => MES_NOMBRES[i])
        .filter((x): x is string => Boolean(x));
    } else {
      meses = (body.meses as string[]).map((s) => String(s));
    }
  }

  let categoria_ids = d.categoria_ids;
  if (Array.isArray(body.categorias) && body.categorias.length) {
    const resolved = await resolveCategoriaIdsFromNames(pool, body.categorias);
    if (resolved.length) categoria_ids = resolved;
  } else if (Array.isArray(body.categoria_ids) && body.categoria_ids.length) {
    categoria_ids = body.categoria_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  }

  const legacy = body as Partial<SalesReportFilters> & FullSnapshotBody;

  return {
    objetivo_pct: typeof body.objetivo_pct === "number" ? body.objetivo_pct : d.objetivo_pct,
    departamento: typeof body.departamento === "string" ? body.departamento : d.departamento,
    categoria_ids: categoria_ids.length ? categoria_ids : d.categoria_ids,
    meses: meses.length ? meses : d.meses,
    cadenas: Array.isArray(body.cadenas) ? body.cadenas.map(String) : d.cadenas,
    clientes: Array.isArray(body.clientes) ? body.clientes.map(String) : d.clientes,
    vendedores: Array.isArray(body.vendedores) ? body.vendedores.map(String) : d.vendedores,
    marcas: Array.isArray(body.marcas) ? body.marcas.map(String) : d.marcas,
    id_cliente_exacto:
      body.cliente_codigo !== undefined && body.cliente_codigo !== null
        ? String(body.cliente_codigo).trim() || null
        : legacy.id_cliente_exacto === undefined
          ? d.id_cliente_exacto
          : legacy.id_cliente_exacto === null
            ? null
            : String(legacy.id_cliente_exacto),
  };
}

export async function POST(req: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "DATABASE_URL no configurada. Definir en .env.local (desarrollo) o variables del servidor (Vercel).",
    });
  }

  try {
    const pool = getRimecPool();
    const raw = (await req.json().catch(() => ({}))) as FullSnapshotBody;
    const filtros = await mergeSnapshotFilters(raw, pool);

    const { text: pivotSql, values: pivotVals } = buildPivotSql(filtros);
    const { text: jerSql, values: jerVals } = buildJerarquiaSql(filtros);

    const [rPivot, rJer] = await Promise.all([
      pool.query(pivotSql, pivotVals),
      pool.query(jerSql, jerVals),
    ]);

    const rows =
      rPivot.rows && rPivot.rows.length
        ? enrichPivotRows(rPivot.rows as Record<string, unknown>[], filtros.objetivo_pct)
        : [];

    const jerarquia_clientes = mapJerarquiaQueryRows(
      (rJer.rows ?? []) as Record<string, unknown>[],
      filtros.objetivo_pct
    );

    const snapshot = buildFullSnapshotResponse(rows, filtros, jerarquia_clientes);
    const cascada = await fetchCascadeDomains(pool, filtros);

    return NextResponse.json({
      ...snapshot,
      cascada,
      _debug:
        process.env.NODE_ENV === "development"
          ? { sql: pivotSql, paramCount: pivotVals.length, pivot_rows: rows.length, filtros }
          : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error full-snapshot RIMEC";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
