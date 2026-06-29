import { NextRequest, NextResponse } from "next/server";
import {
  getDepositoConfig,
  parseCategoriaDeposito,
} from "@/lib/depositos/depositos-config";
import { TIPO_V2_CONFECCIONES } from "@/lib/depositos/pilar-proveedor-index";
import { normFk } from "@/lib/depositos/operativa-filters";
import { normalizePrecioUnitario, calcValorInventario } from "@/lib/depositos/precio-venta";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { requireDepositoClienteAccess } from "@/lib/depositos/depositos-session";

export type ConfeccionRow = {
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  material_code: string;
  color_code: string;
  marca: string;
  descp_linea: string | null;
  descp_material: string | null;
  descp_color: string | null;
  grada: string;
  cantidad: number;
  precio_unitario: number | null;
  imagen_nombre: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number;
  color_id: number;
  marca_id: number | null;
};

function parseIdList(sp: URLSearchParams, key: string): number[] {
  return sp
    .getAll(key)
    .concat((sp.get(key) ?? "").split(","))
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseGradaList(sp: URLSearchParams): string[] {
  return sp
    .getAll("grada")
    .concat((sp.get("grada") ?? "").split(","))
    .map((g) => g.trim())
    .filter(Boolean);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cliente_id: string }> },
) {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      filas: [],
      total: 0,
      error: "Base de datos no configurada",
    });
  }

  const { cliente_id: clienteIdStr } = await params;
  const cliente_id = parseInt(clienteIdStr);

  const gate = await requireDepositoClienteAccess(cliente_id);
  if (!gate.ok) {
    return NextResponse.json(
      { configured: true, filas: [], total: 0, error: gate.error },
      { status: gate.status },
    );
  }

  const { searchParams } = new URL(req.url);
  const categoria = parseCategoriaDeposito(searchParams.get("categoria"));
  const config = getDepositoConfig(cliente_id, categoria);

  if (!config) {
    return NextResponse.json(
      { configured: true, filas: [], total: 0, error: `cliente_id ${cliente_id} inválido` },
      { status: 400 },
    );
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.get("pageSize") ?? "50") || 50));
  const offset = (page - 1) * pageSize;
  const q = (searchParams.get("q") ?? "").trim();
  const sort = searchParams.get("sort") === "linea" ? "linea" : "uds";

  const marcaIds = parseIdList(searchParams, "marca_id");
  const lineaIds = parseIdList(searchParams, "linea_id");
  const referenciaIds = parseIdList(searchParams, "referencia_id");
  const colorIds = parseIdList(searchParams, "color_id");
  const gradas = parseGradaList(searchParams);

  const tabla = config.tabla;
  const conditions: string[] = ["s.cantidad > 0", "s.tipo_v2_id = $1"];
  const values: unknown[] = [TIPO_V2_CONFECCIONES];
  let idx = 2;

  if (marcaIds.length) {
    conditions.push(`s.marca_id = ANY($${idx}::bigint[])`);
    values.push(marcaIds);
    idx++;
  }
  if (lineaIds.length) {
    conditions.push(`s.linea_id = ANY($${idx}::bigint[])`);
    values.push(lineaIds);
    idx++;
  }
  if (referenciaIds.length) {
    conditions.push(`s.referencia_id = ANY($${idx}::bigint[])`);
    values.push(referenciaIds);
    idx++;
  }
  if (colorIds.length) {
    conditions.push(`s.color_id = ANY($${idx}::bigint[])`);
    values.push(colorIds);
    idx++;
  }
  if (gradas.length) {
    conditions.push(`btrim(s.grada::text) = ANY($${idx}::text[])`);
    values.push(gradas);
    idx++;
  }
  if (q) {
    conditions.push(`(
      s.linea_codigo_proveedor ILIKE $${idx}
      OR s.referencia_codigo_proveedor ILIKE $${idx}
      OR s.excel_material_code::text ILIKE $${idx}
      OR s.excel_color_code::text ILIKE $${idx}
      OR col.nombre ILIKE $${idx}
      OR l.descripcion ILIKE $${idx}
      OR s.imagen_nombre ILIKE $${idx}
    )`);
    values.push(`%${q}%`);
    idx++;
  }

  const where = conditions.join(" AND ");
  const orderBy =
    sort === "linea"
      ? "s.linea_codigo_proveedor ASC, s.grada ASC"
      : "s.cantidad DESC, s.linea_codigo_proveedor ASC";

  try {
    const pool = getRimecPool();

    const countResult = await pool.query<{
      total: number;
      total_uds: number;
      total_valor: number;
    }>(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(s.cantidad), 0)::float8 AS total_uds,
        COALESCE(
          SUM(
            s.cantidad * NULLIF(NULLIF(s.precio_unitario, 0), NULL)
          ),
          0
        )::float8 AS total_valor
      FROM public.${tabla} s
      LEFT JOIN public.linea l ON l.id = s.linea_id
      LEFT JOIN public.color col ON col.id = s.color_id
      WHERE ${where}
      `,
      values,
    );

    const total = countResult.rows[0]?.total ?? 0;
    const total_uds = Number(countResult.rows[0]?.total_uds) || 0;
    const total_valor = Number(countResult.rows[0]?.total_valor) || 0;

    const { rows } = await pool.query<ConfeccionRow>(
      `
      SELECT
        s.linea_codigo_proveedor,
        s.referencia_codigo_proveedor,
        COALESCE(
          NULLIF(btrim(s.excel_material_code::text), ''),
          CASE WHEN mat.id IS NULL THEN '' ELSE trim(mat.codigo_proveedor::text) END,
          ''
        ) AS material_code,
        COALESCE(
          NULLIF(btrim(s.excel_color_code::text), ''),
          CASE WHEN col.id IS NULL THEN '' ELSE trim(col.codigo_proveedor::text) END,
          ''
        ) AS color_code,
        s.material_id,
        s.color_id,
        s.marca_id,
        s.linea_id,
        s.referencia_id,
        s.grada,
        s.cantidad::float8 AS cantidad,
        NULLIF(s.precio_unitario, 0)::float8 AS precio_unitario,
        NULLIF(btrim(s.imagen_nombre::text), '') AS imagen_nombre,
        COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)') AS marca,
        NULLIF(btrim(l.descripcion::text), '') AS descp_linea,
        NULLIF(btrim(mat.descripcion::text), '') AS descp_material,
        NULLIF(btrim(col.nombre::text), '') AS descp_color
      FROM public.${tabla} s
      LEFT JOIN public.linea l ON l.id = s.linea_id
      LEFT JOIN public.material mat ON mat.id = s.material_id
      LEFT JOIN public.color col ON col.id = s.color_id
      LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...values, pageSize, offset],
    );

    const filas = rows.map((r) => ({
      ...r,
      linea_id: normFk(r.linea_id),
      referencia_id: normFk(r.referencia_id),
      marca_id: normFk(r.marca_id),
      material_id: Number(r.material_id),
      color_id: Number(r.color_id),
      cantidad: Number(r.cantidad) || 0,
      precio_unitario: normalizePrecioUnitario(r.precio_unitario),
    }));

    const uds = filas.reduce((s, r) => s + r.cantidad, 0);

    return NextResponse.json({
      configured: true,
      cliente_id,
      ente: config.ente,
      categoria,
      filas,
      total,
      total_uds,
      total_valor,
      page,
      pageSize,
      uds_pagina: uds,
      valor_pagina: calcValorInventario(filas),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        cliente_id,
        filas: [],
        total: 0,
        error: error instanceof Error ? error.message : "Error",
      },
      { status: 500 },
    );
  }
}
