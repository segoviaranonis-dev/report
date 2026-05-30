import type { Pool } from "pg";
import { ventaFotoImageCandidates } from "./image";
import type {
  VentaFotoRow,
  VentaFotoTipo,
  VentasFotosFilters,
  VentasFotosKpis,
  VentasFotosMarca,
  VentasFotosResponse,
} from "./types";

const TABLE_VENTAS = "registro_ventas_general_v2";
const MAX_ROWS = 1200;

const tableColumnsCache = new Map<string, Set<string>>();

function qIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function qTable(table: string): string {
  return table.split(".").map(qIdent).join(".");
}

async function getTableColumns(pool: Pool, tableName: string): Promise<Set<string>> {
  const cacheKey = tableName.toLowerCase();
  const cached = tableColumnsCache.get(cacheKey);
  if (cached) return cached;

  const [schema, table] = tableName.includes(".")
    ? tableName.split(".", 2)
    : ["public", tableName];
  const res = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
    `,
    [schema, table],
  );
  const cols = new Set(res.rows.map((r) => r.column_name));
  tableColumnsCache.set(cacheKey, cols);
  return cols;
}

function firstCol(cols: Set<string>, candidates: string[]): string | null {
  const byLower = new Map([...cols].map((c) => [c.toLowerCase(), c]));
  for (const c of candidates) {
    const found = byLower.get(c.toLowerCase());
    if (found) return found;
  }
  return null;
}

function col(alias: string, columnName: string): string {
  return `${alias}.${qIdent(columnName)}`;
}

function sqlText(alias: string, columnName: string | null, fallback = "''"): string {
  return columnName ? `NULLIF(TRIM(${col(alias, columnName)}::text), '')` : fallback;
}

function sqlNumeric(alias: string, columnName: string | null, fallback = "0"): string {
  return columnName ? `COALESCE(${col(alias, columnName)}, 0)::numeric` : fallback;
}

function normalizeTipoVenta(preventa: unknown): VentaFotoTipo {
  if (preventa === 1 || preventa === "1") return "VENTA";
  if (preventa === 2 || preventa === 3 || preventa === "2" || preventa === "3") return "TRANSITO";
  const label = String(preventa ?? "").trim().toUpperCase();
  if (label.includes("TRANS")) return "TRANSITO";
  if (label.includes("VENTA")) return "VENTA";
  return "DESCONOCIDO";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeKpis(rows: VentaFotoRow[]): VentasFotosKpis {
  const uniqueImages = new Set(rows.map((r) => r.imagen).filter(Boolean));
  return {
    total_cantidad: rows.reduce((s, r) => s + r.cantidad, 0),
    total_ventas: rows.filter((r) => r.tipo_venta === "VENTA").reduce((s, r) => s + r.cantidad, 0),
    total_transito: rows.filter((r) => r.tipo_venta === "TRANSITO").reduce((s, r) => s + r.cantidad, 0),
    articulos_unicos: uniqueImages.size,
  };
}

function mapRow(raw: Record<string, unknown>): VentaFotoRow {
  const base = {
    imagen: String(raw.imagen ?? ""),
    linea_codigo: raw.linea_codigo ? String(raw.linea_codigo) : null,
    referencia_codigo: raw.referencia_codigo ? String(raw.referencia_codigo) : null,
    material_code: raw.material_code ? String(raw.material_code) : null,
    color_code: raw.color_code ? String(raw.color_code) : null,
  };
  const image = ventaFotoImageCandidates(base);
  const preventa = raw.preventa ?? null;

  return {
    id_cliente: String(raw.id_cliente ?? ""),
    descp_cliente: String(raw.descp_cliente ?? ""),
    fecha: String(raw.fecha ?? ""),
    cantidad: num(raw.cantidad),
    preventa: preventa as number | string | null,
    tipo_venta: normalizeTipoVenta(preventa),
    descp_marca: String(raw.descp_marca ?? ""),
    imagen: base.imagen,
    id_tipo: raw.id_tipo == null ? null : Number(raw.id_tipo),
    desc_tipo: String(raw.desc_tipo ?? ""),
    linea_codigo: base.linea_codigo,
    referencia_codigo: base.referencia_codigo,
    material_code: base.material_code,
    color_code: base.color_code,
    image_candidates: image.candidates,
    image_search_name: image.searchName,
  };
}

export async function getVentasFotosMeta(pool: Pool): Promise<VentasFotosMarca[]> {
  const rows = await pool.query<VentasFotosMarca>(
    `
      SELECT id_marca::integer AS id_marca, TRIM(descp_marca)::text AS descp_marca
      FROM marca_v2
      WHERE descp_marca IS NOT NULL
      ORDER BY TRIM(descp_marca)
    `,
  );
  return rows.rows;
}

export async function fetchVentasFotos(
  pool: Pool,
  filters: VentasFotosFilters,
): Promise<VentasFotosResponse> {
  const ventasCols = await getTableColumns(pool, TABLE_VENTAS);

  const required = ["fecha", "id_cliente", "id_marca"];
  const missing = required.filter((c) => !ventasCols.has(c));
  if (missing.length) {
    return {
      configured: true,
      rows: [],
      kpis: computeKpis([]),
      cliente: null,
      marca: null,
      columnasDetectadas: [...ventasCols].sort(),
      error: `Faltan columnas requeridas en ${TABLE_VENTAS}: ${missing.join(", ")}`,
    };
  }

  const cantidadCol = firstCol(ventasCols, ["cantidad", "pares", "cantidad_pares", "cantidad_venta"]);
  const preventaCol = firstCol(ventasCols, ["preventa", "tipo_venta", "estado_venta"]);
  const imagenCol = firstCol(ventasCols, ["imagen", "image", "foto", "archivo_imagen", "referencia"]);
  const lineaCol = firstCol(ventasCols, ["linea_codigo", "codigo_linea", "linea_codigo_proveedor", "linea"]);
  const referenciaCol = firstCol(ventasCols, [
    "referencia_codigo",
    "codigo_referencia",
    "referencia_codigo_proveedor",
    "referencia",
  ]);
  const materialCol = firstCol(ventasCols, ["material_code", "material_codigo", "excel_material_code", "material"]);
  const colorCol = firstCol(ventasCols, ["color_code", "color_codigo", "excel_color_code", "color"]);
  const idTipoCol = firstCol(ventasCols, ["id_tipo"]);

  const values: unknown[] = [
    filters.clienteCodigo.trim(),
    filters.fechaInicio,
    filters.fechaFin,
    filters.marcaId,
  ];

  const where = [
    `${col("v", "id_cliente")}::text = $1`,
    `${col("v", "fecha")}::date BETWEEN $2::date AND $3::date`,
    `${col("v", "id_marca")} = $4`,
  ];

  const textFilterExpr = imagenCol
    ? sqlText("v", imagenCol)
    : referenciaCol
      ? sqlText("v", referenciaCol)
      : "''";
  if (filters.referenciaPrefix?.trim()) {
    values.push(`${filters.referenciaPrefix.trim()}%`);
    where.push(`UPPER(COALESCE(${textFilterExpr}, '')) LIKE UPPER($${values.length})`);
  }

  values.push(MAX_ROWS);

  const idTipoExpr = idTipoCol ? col("v", idTipoCol) : "NULL";
  const raw = await pool.query<Record<string, unknown>>(
    `
      SELECT
        ${col("v", "id_cliente")}::text AS id_cliente,
        TRIM(c.descp_cliente)::text AS descp_cliente,
        ${col("v", "fecha")}::date::text AS fecha,
        ${sqlNumeric("v", cantidadCol)}::float8 AS cantidad,
        ${sqlText("v", preventaCol, "NULL")} AS preventa,
        TRIM(m.descp_marca)::text AS descp_marca,
        COALESCE(${sqlText("v", imagenCol)}, ${sqlText("v", referenciaCol)}, '')::text AS imagen,
        ${idTipoExpr}::integer AS id_tipo,
        COALESCE(TRIM(t.descp_tipo)::text, '') AS desc_tipo,
        ${sqlText("v", lineaCol, "NULL")} AS linea_codigo,
        ${sqlText("v", referenciaCol, "NULL")} AS referencia_codigo,
        ${sqlText("v", materialCol, "NULL")} AS material_code,
        ${sqlText("v", colorCol, "NULL")} AS color_code
      FROM ${qTable(TABLE_VENTAS)} v
      JOIN cliente_v2 c ON ${col("v", "id_cliente")} = c.id_cliente
      JOIN marca_v2 m ON ${col("v", "id_marca")} = m.id_marca
      LEFT JOIN tipo_v2 t ON ${idTipoExpr} = t.id_tipo
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(${textFilterExpr}, ''), ${col("v", "fecha")}::date
      LIMIT $${values.length}
    `,
    values,
  );

  const rows = raw.rows.map(mapRow);
  const marca = rows[0]
    ? { id_marca: filters.marcaId, descp_marca: rows[0].descp_marca }
    : (await getVentasFotosMeta(pool)).find((m) => m.id_marca === filters.marcaId) ?? null;

  return {
    configured: true,
    rows,
    kpis: computeKpis(rows),
    cliente: rows[0] ? { id: rows[0].id_cliente, nombre: rows[0].descp_cliente } : null,
    marca,
    columnasDetectadas: [...ventasCols].sort(),
  };
}
