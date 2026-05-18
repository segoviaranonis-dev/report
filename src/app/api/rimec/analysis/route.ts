/**
 * API Route: /api/rimec/analysis
 * CLONACIÓN EXACTA de la lógica de Streamlit Sales Report
 */

import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { buildPivotSql, enrichPivotRows } from "@/lib/rimec/pivot-query";
import { getFullAnalysisPackage } from "@/lib/rimec/sales-logic";
import { defaultSalesReportFilters, type SalesReportFilters } from "@/modules/sales-report/types";

function mergeFilters(body: Partial<SalesReportFilters> | null): SalesReportFilters {
  const d = defaultSalesReportFilters();
  if (!body || typeof body !== "object") return d;
  return {
    objetivo_pct: typeof body.objetivo_pct === "number" ? body.objetivo_pct : d.objetivo_pct,
    departamento: typeof body.departamento === "string" ? body.departamento : d.departamento,
    categoria_ids: Array.isArray(body.categoria_ids) ? body.categoria_ids.map(Number) : d.categoria_ids,
    meses: Array.isArray(body.meses) ? (body.meses as string[]) : d.meses,
    cadenas: Array.isArray(body.cadenas) ? (body.cadenas as string[]) : d.cadenas,
    clientes: Array.isArray(body.clientes) ? (body.clientes as string[]) : d.clientes,
    vendedores: Array.isArray(body.vendedores) ? (body.vendedores as string[]) : d.vendedores,
    marcas: Array.isArray(body.marcas) ? (body.marcas as string[]) : d.marcas,
    id_cliente_exacto:
      body.id_cliente_exacto === undefined
        ? d.id_cliente_exacto
        : body.id_cliente_exacto === null
          ? null
          : String(body.id_cliente_exacto),
  };
}

export async function POST(req: Request) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "Este entorno aún no tiene activada la conexión a los datos corporativos. El equipo técnico debe definir DATABASE_URL en el servidor (archivo .env.local en desarrollo o variables en Vercel).",
    });
  }

  try {
    const raw = (await req.json().catch(() => ({}))) as Partial<SalesReportFilters>;
    const filtros = mergeFilters(raw);

    const { text, values } = buildPivotSql(filtros);
    const pool = getRimecPool();
    const r = await pool.query(text, values);

    const rows =
      r.rows && r.rows.length
        ? enrichPivotRows(r.rows as Record<string, unknown>[], filtros.objetivo_pct)
        : [];

    const pkg = getFullAnalysisPackage(rows, filtros);

    return NextResponse.json({
      configured: true,
      ...pkg,
      pivot: rows,
      _debug:
        process.env.NODE_ENV === "development"
          ? { sql: text, paramCount: values.length, rows: rows.length }
          : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al consultar RIMEC";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
