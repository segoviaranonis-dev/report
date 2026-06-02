import type { Pool } from "pg";
import { parseImagenMolecula } from "./parse-imagen";
import type {
  PillarBucket,
  VentaFotoRow,
  VentaFotoTipo,
  VentasFotosFilters,
  VentasFotosKpis,
  VentasFotosMarca,
  VentasFotosPillarStats,
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
  const totalMonto = rows.reduce((s, r) => s + Math.abs(r.monto), 0);
  return {
    total_cantidad: rows.reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_monto: totalMonto,
    total_ventas: rows.filter((r) => r.tipo_venta === "VENTA").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_transito: rows.filter((r) => r.tipo_venta === "TRANSITO").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    articulos_unicos: uniqueImages.size,
  };
}

function emptyPillarStats(): VentasFotosPillarStats {
  return {
    resumen: { totalPares: 0, totalMonto: 0, articulosUnicos: 0, sinClasificar: 0 },
    porGenero: [],
    porEstilo: [],
    porTipo1: [],
    porColor: [],
    porCategoria: [],
  };
}

function computePillarStats(rows: VentaFotoRow[]): VentasFotosPillarStats {
  const totalPares = rows.reduce((s, r) => s + Math.abs(r.cantidad), 0);
  const totalMonto = rows.reduce((s, r) => s + Math.abs(r.monto), 0);
  const articulosUnicos = new Set(rows.map((r) => r.imagen).filter(Boolean)).size;
  const sinClasificar = rows.filter((r) => !r.genero && !r.estilo && !r.tipo_1).length;

  function bucket(keyOf: (r: VentaFotoRow) => string | null | undefined): PillarBucket[] {
    const groups = new Map<string, { pares: number; monto: number }>();
    for (const r of rows) {
      const raw = keyOf(r);
      const label = (raw && String(raw).trim()) || "Sin clasificar";
      const acc = groups.get(label) ?? { pares: 0, monto: 0 };
      acc.pares += Math.abs(r.cantidad);
      acc.monto += Math.abs(r.monto);
      groups.set(label, acc);
    }
    const out: PillarBucket[] = [];
    for (const [label, { pares, monto }] of groups) {
      out.push({
        label,
        pares,
        monto,
        pctPares: totalPares ? (pares / totalPares) * 100 : 0,
        pctMonto: totalMonto ? (monto / totalMonto) * 100 : 0,
      });
    }
    out.sort((a, b) => b.monto - a.monto || b.pares - a.pares);
    return out;
  }

  return {
    resumen: { totalPares, totalMonto, articulosUnicos, sinClasificar },
    porGenero: bucket((r) => r.genero),
    porEstilo: bucket((r) => r.estilo),
    porTipo1: bucket((r) => r.tipo_1),
    porColor: bucket((r) => r.color_nombre),
    porCategoria: bucket((r) => r.descp_categoria),
  };
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function mapRow(raw: Record<string, unknown>): VentaFotoRow {
  const imagenStr = String(raw.imagen ?? "");

  const parsed = parseImagenMolecula(imagenStr);
  const preventa = raw.preventa ?? null;

  return {
    id_cliente: String(raw.id_cliente ?? ""),
    descp_cliente: String(raw.descp_cliente ?? ""),
    fecha: String(raw.fecha ?? ""),
    cantidad: num(raw.cantidad),
    monto: num(raw.monto),
    preventa: preventa as number | string | null,
    tipo_venta: normalizeTipoVenta(preventa),
    descp_marca: String(raw.descp_marca ?? ""),
    imagen: imagenStr,
    id_tipo: raw.id_tipo == null ? null : Number(raw.id_tipo),
    desc_tipo: String(raw.desc_tipo ?? ""),
    id_categoria: raw.id_categoria == null ? null : Number(raw.id_categoria),
    descp_categoria: raw.descp_categoria ? String(raw.descp_categoria) : null,
    linea_codigo: parsed.linea_codigo,
    referencia_codigo: parsed.referencia_codigo,
    material_codigo: parsed.material_codigo,
    color_codigo: parsed.color_codigo,
    genero: strOrNull(raw.genero),
    estilo: strOrNull(raw.estilo),
    tipo_1: strOrNull(raw.tipo_1),
    material_nombre: strOrNull(raw.material_nombre),
    color_nombre: strOrNull(raw.color_nombre),
    imagen_valid: parsed.valid,
    imagen_error: parsed.error ?? null,
    image_url: parsed.image_url,
  };
}

export async function getVentasFotosMeta(pool: Pool): Promise<VentasFotosMarca[]> {
  // Preferir marca_tipo_v2 cuando existe; algunas bases locales antiguas no la tienen poblada.
  try {
    const rows = await pool.query<VentasFotosMarca>(
      `
        SELECT m.id_marca::integer AS id_marca, TRIM(m.descp_marca)::text AS descp_marca
        FROM marca_tipo_v2 mt
        JOIN marca_v2 m ON m.id_marca = mt.id_marca
        WHERE mt.id_tipo = 1
          AND m.descp_marca IS NOT NULL
        ORDER BY TRIM(m.descp_marca)
      `,
    );
    if (rows.rows.length) return rows.rows;
  } catch (error) {
    console.warn("[ventas-fotos] marca_tipo_v2 no disponible; usando marcas desde ventas.", error);
  }

  const ventasCols = await getTableColumns(pool, TABLE_VENTAS);
  const tipoFilter = ventasCols.has("id_tipo") ? "AND v.id_tipo = 1" : "";

  const rowsFromVentas = await pool.query<VentasFotosMarca>(
    `
      SELECT DISTINCT m.id_marca::integer AS id_marca, TRIM(m.descp_marca)::text AS descp_marca
      FROM ${qTable(TABLE_VENTAS)} v
      JOIN marca_v2 m ON m.id_marca = v.id_marca
      WHERE m.descp_marca IS NOT NULL
        ${tipoFilter}
      ORDER BY TRIM(m.descp_marca)
    `,
  );
  if (rowsFromVentas.rows.length) return rowsFromVentas.rows;

  const allRows = await pool.query<VentasFotosMarca>(
    `
      SELECT m.id_marca::integer AS id_marca, TRIM(m.descp_marca)::text AS descp_marca
      FROM marca_v2 m
      WHERE m.descp_marca IS NOT NULL
      ORDER BY TRIM(m.descp_marca)
    `,
  );
  return allRows.rows;
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
      pillarStats: emptyPillarStats(),
      cliente: null,
      marca: null,
      columnasDetectadas: [...ventasCols].sort(),
      error: `Faltan columnas requeridas en ${TABLE_VENTAS}: ${missing.join(", ")}`,
    };
  }

  const cantidadCol = firstCol(ventasCols, ["cantidad", "pares", "cantidad_pares", "cantidad_venta"]);
  const montoCol = firstCol(ventasCols, ["monto", "total", "importe", "monto_total"]);
  const preventaCol = firstCol(ventasCols, ["preventa", "tipo_venta", "estado_venta", "estado"]);
  const imagenCol = firstCol(ventasCols, ["imagen", "image", "foto", "archivo_imagen"]);
  const idTipoCol = firstCol(ventasCols, ["id_tipo"]);
  const idCategoriaCol = firstCol(ventasCols, ["id_categoria"]);

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
    `${col("v", "id_tipo")} = 1`, // Solo CALZADOS (tipo_v2.id_tipo = 1)
  ];

  const textFilterExpr = imagenCol ? sqlText("v", imagenCol) : "''";
  if (filters.referenciaPrefix?.trim()) {
    values.push(`${filters.referenciaPrefix.trim()}%`);
    where.push(`UPPER(COALESCE(${textFilterExpr}, '')) LIKE UPPER($${values.length})`);
  }

  values.push(MAX_ROWS);

  const idTipoExpr = idTipoCol ? col("v", idTipoCol) : "NULL";
  const idCategoriaExpr = idCategoriaCol ? col("v", idCategoriaCol) : "NULL";

  // Parser L-R-M-C en SQL: strip extensión y split por guión.
  // Aplica solo si el imagen matchea el patrón canónico de 4 enteros.
  const imagenRaw = imagenCol ? col("v", imagenCol) : "NULL::text";
  const imagenBase = `regexp_replace(COALESCE(${imagenRaw}::text, ''), '\\.[A-Za-z]+$', '')`;
  const moleculaRx = "'^[0-9]+-[0-9]+-[0-9]+-[0-9]+(\\.[A-Za-z]+)?$'";
  const pLinea = `CASE WHEN COALESCE(${imagenRaw}::text, '') ~ ${moleculaRx} THEN (split_part(${imagenBase}, '-', 1))::bigint END`;
  const pRef = `CASE WHEN COALESCE(${imagenRaw}::text, '') ~ ${moleculaRx} THEN (split_part(${imagenBase}, '-', 2))::bigint END`;
  const pMat = `CASE WHEN COALESCE(${imagenRaw}::text, '') ~ ${moleculaRx} THEN (split_part(${imagenBase}, '-', 3))::bigint END`;
  const pCol = `CASE WHEN COALESCE(${imagenRaw}::text, '') ~ ${moleculaRx} THEN (split_part(${imagenBase}, '-', 4))::bigint END`;

  const raw = await pool.query<Record<string, unknown>>(
    `
      WITH base AS (
        SELECT
          v.*,
          ${pLinea} AS p_linea,
          ${pRef}   AS p_ref,
          ${pMat}   AS p_mat,
          ${pCol}   AS p_col
        FROM ${qTable(TABLE_VENTAS)} v
        WHERE ${where.join(" AND ")}
      )
      SELECT
        b.id_cliente::text AS id_cliente,
        TRIM(c.descp_cliente)::text AS descp_cliente,
        b.fecha::date::text AS fecha,
        ${sqlNumeric("b", cantidadCol)}::float8 AS cantidad,
        ${montoCol ? `${sqlNumeric("b", montoCol)}::float8` : "0::float8"} AS monto,
        ${sqlText("b", preventaCol, "NULL")} AS preventa,
        TRIM(m.descp_marca)::text AS descp_marca,
        COALESCE(${sqlText("b", imagenCol, "NULL")}, '')::text AS imagen,
        ${idTipoExpr.replace(/\bv\./g, "b.")}::integer AS id_tipo,
        COALESCE(TRIM(t.descp_tipo)::text, '') AS desc_tipo,
        ${idCategoriaExpr.replace(/\bv\./g, "b.")}::integer AS id_categoria,
        COALESCE(TRIM(cat.descp_categoria)::text, NULL) AS descp_categoria,
        TRIM(g.descripcion)::text AS genero,
        TRIM(ge.descp_grupo_estilo)::text AS estilo,
        TRIM(t1.descp_tipo_1)::text AS tipo_1,
        TRIM(mat.descripcion)::text AS material_nombre,
        TRIM(col.nombre)::text AS color_nombre
      FROM base b
      JOIN cliente_v2 c ON b.id_cliente = c.id_cliente
      JOIN marca_v2 m ON b.id_marca = m.id_marca
      JOIN tipo_v2 t ON b.id_tipo = t.id_tipo
      LEFT JOIN categoria_v2 cat ON b.id_categoria = cat.id_categoria
      LEFT JOIN linea l
        ON l.codigo_proveedor = b.p_linea
       AND l.marca_id = b.id_marca
      LEFT JOIN referencia r
        ON r.codigo_proveedor = b.p_ref
       AND r.linea_id = l.id
      LEFT JOIN linea_referencia lr
        ON lr.linea_id = l.id
       AND lr.referencia_id = r.id
      LEFT JOIN material mat ON mat.codigo_proveedor = b.p_mat
      LEFT JOIN color col   ON col.codigo_proveedor = b.p_col
      LEFT JOIN genero g ON g.id = l.genero_id
      LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
      LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
      ORDER BY b.fecha::date, ${sqlText("b", imagenCol)}
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
    pillarStats: computePillarStats(rows),
    cliente: rows[0] ? { id: rows[0].id_cliente, nombre: rows[0].descp_cliente } : null,
    marca,
    columnasDetectadas: [...ventasCols].sort(),
  };
}
