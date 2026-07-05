import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import type { Pool } from "pg";
import { resolveDepositoCodigo } from "@/lib/deposito-rimec/rimec-csv-sdrm";

/** Productos con saldo PP → filas operativas (grilla tablet). */
export async function listProcesoProductos(
  pool: Pool,
  compraLegalId?: number,
): Promise<{ productos: DepositoRow[]; cajas: number; pares: number }> {
  const params: unknown[] = [];
  let clFilter = "";
  if (compraLegalId != null && Number.isFinite(compraLegalId)) {
    params.push(compraLegalId);
    clFilter = `
      AND pp.id IN (
        SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp WHERE clp.compra_legal_id = $1
      )
    `;
  } else {
    clFilter = `AND pp.estado_transito = 'EN_DEPOSITO'`;
  }

  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    marca: string;
    descp_material: string | null;
    descp_color: string | null;
    grada: string | null;
    cantidad: string;
  }>(
    `
    SELECT
      ppd.linea,
      ppd.referencia,
      COALESCE(ppd.material::text, '0') AS material_code,
      COALESCE(ppd.color::text, '0') AS color_code,
      COALESCE(mv.descp_marca, '—') AS marca,
      ppd.descp_material,
      ppd.descp_color,
      COALESCE(ppd.grada, '—') AS grada,
      (
        COALESCE(ppd.cantidad_pares, 0) - GREATEST(
          COALESCE(ppd.pares_vendidos, 0),
          COALESCE(SUM(vt.cantidad_vendida), 0)
        )
      )::text AS cantidad
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN venta_transito vt ON vt.pedido_proveedor_detalle_id = ppd.id
    WHERE ppd.referencia IS NOT NULL
      ${clFilter}
    GROUP BY ppd.id, mv.descp_marca, ppd.linea, ppd.referencia, ppd.material, ppd.color,
             ppd.descp_material, ppd.descp_color, ppd.grada,
             ppd.cantidad_pares, ppd.pares_vendidos
    HAVING (
      COALESCE(ppd.cantidad_pares, 0) - GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE(SUM(vt.cantidad_vendida), 0)
      )
    ) > 0
    ORDER BY ppd.linea, ppd.referencia
    LIMIT 8000
    `,
    params,
  );

  const productos: DepositoRow[] = rows.map((r) => ({
    linea_codigo_proveedor: String(r.linea ?? ""),
    referencia_codigo_proveedor: String(r.referencia ?? ""),
    material_code: String(r.material_code),
    color_code: String(r.color_code),
    marca: r.marca,
    genero: "",
    estilo: "",
    tipo_v2: "",
    descp_material: r.descp_material,
    descp_color: r.descp_color,
    grada: r.grada ?? "—",
    cantidad: Number(r.cantidad),
    imagen_nombre: null,
    linea_id: null,
    referencia_id: null,
    material_id: 0,
    color_id: 0,
    marca_id: null,
    genero_id: null,
    grupo_estilo_id: null,
    tipo_1_id: null,
    tipo_v2_id: null,
    tono_etiqueta: null,
    tipo_1: null,
    precio_unitario: null,
  }));

  const cajas = new Set(
    productos.map(
      (p) =>
        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
    ),
  ).size;
  const pares = productos.reduce((a, p) => a + p.cantidad, 0);

  return { productos, cajas, pares };
}

/**
 * Stock importado (staging sdrm) → grilla tablet.
 * Estrategia: sync posterior a v_stock_rimec · ver ESTRATEGIA_HIEDRA_VENENOSA_PE.md
 */
export async function listImportadoProductos(
  pool: Pool,
  opts?: { deposito?: string; batch?: string; tipo_v2?: 1 | 2 },
): Promise<{ productos: DepositoRow[]; cajas: number; pares: number; batch: string | null }> {
  const params: unknown[] = [];
  const filters: string[] = ["s.cantidad > 0"];
  if (opts?.deposito) {
    const dep = resolveDepositoCodigo(opts.deposito);
    if (dep) {
      params.push(dep);
      filters.push(`s.deposito_codigo = $${params.length}`);
    }
  }
  if (opts?.batch) {
    params.push(opts.batch);
    filters.push(`s.batch_label = $${params.length}`);
  }
  if (opts?.tipo_v2 === 1 || opts?.tipo_v2 === 2) {
    params.push(opts.tipo_v2);
    filters.push(`s.tipo_v2_id = $${params.length}`);
  }
  const where = `WHERE ${filters.join(" AND ")}`;

  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    marca: string;
    genero: string;
    estilo: string;
    tipo_v2: string;
    tipo_1: string;
    descp_material: string | null;
    descp_color: string | null;
    grada: string;
    cantidad: string;
    precio: string;
    linea_id: string | null;
    referencia_id: string | null;
    material_id: string | null;
    color_id: string | null;
    marca_id: string | null;
    genero_id: string | null;
    grupo_estilo_id: string | null;
    tipo_1_id: string | null;
    batch_label: string;
    tipo_v2_id: string | null;
    tono_etiqueta: string | null;
    deposito_codigo: string;
    columna_stock_legal: string | null;
  }>(
    `
    SELECT
      COALESCE(l.codigo_proveedor::text, split_part(s.codigo_barras, '.', 1)) AS linea,
      COALESCE(r.codigo_proveedor::text, split_part(s.codigo_barras, '.', 2), '0') AS referencia,
      COALESCE(m.codigo_proveedor::text, s.excel_material_code, '0') AS material_code,
      COALESCE(c.codigo_proveedor::text, s.excel_color_code, '0') AS color_code,
      COALESCE(NULLIF(TRIM(mv.descp_marca), ''), 'RIMEC') AS marca,
      COALESCE(NULLIF(TRIM(g.descripcion), ''), NULLIF(TRIM(g.codigo::text), ''), '(sin género)') AS genero,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), '(sin estilo)') AS estilo,
      COALESCE(NULLIF(TRIM(tv.descp_tipo), ''), CASE s.tipo_v2_id WHEN 1 THEN 'Calzado' WHEN 2 THEN 'Confecciones' ELSE '—' END) AS tipo_v2,
      COALESCE(NULLIF(TRIM(t1.descp_tipo_1), ''), '(sin tipo 1)') AS tipo_1,
      COALESCE(m.descripcion, s.excel_material_code) AS descp_material,
      COALESCE(c.nombre, s.excel_color_code) AS descp_color,
      COALESCE(NULLIF(TRIM(s.grada), ''), '—') AS grada,
      s.cantidad::text,
      s.precio_unitario_gs::text AS precio,
      s.linea_id::text,
      s.referencia_id::text,
      s.material_id::text,
      s.color_id::text,
      l.marca_id::text AS marca_id,
      l.genero_id::text AS genero_id,
      lr.grupo_estilo_id::text AS grupo_estilo_id,
      lr.tipo_1_id::text AS tipo_1_id,
      s.batch_label,
      s.tipo_v2_id::text,
      NULLIF(TRIM(c.tono_canon->>'etiqueta'), '') AS tono_etiqueta,
      s.deposito_codigo,
      COALESCE(s.columna_stock_legal,
        CASE s.deposito_codigo
          WHEN 'D1' THEN 'S00_D1'
          WHEN 'DEP2' THEN 'S00_DEP2'
          WHEN 'D3' THEN 'S00_D3'
          ELSE s.deposito_codigo
        END
      ) AS columna_stock_legal
    FROM stock_pronta_entrega_rimec s
    LEFT JOIN linea l ON l.id = s.linea_id
    LEFT JOIN referencia r ON r.id = s.referencia_id
    LEFT JOIN material m ON m.id = s.material_id
    LEFT JOIN color c ON c.id = s.color_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
    LEFT JOIN genero g ON g.id = l.genero_id
    LEFT JOIN linea_referencia lr ON lr.linea_id = l.id AND lr.referencia_id = r.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN tipo_v2 tv ON tv.id_tipo = s.tipo_v2_id
    ${where}
    ORDER BY s.deposito_codigo, s.codigo_barras
    LIMIT 15000
    `,
    params,
  );

  const productos: DepositoRow[] = rows.map((r) => ({
    linea_codigo_proveedor: r.linea,
    referencia_codigo_proveedor: r.referencia,
    material_code: r.material_code,
    color_code: r.color_code,
    marca: r.marca,
    genero: r.genero,
    estilo: r.estilo,
    tipo_v2: r.tipo_v2,
    descp_material: r.descp_material,
    descp_color: r.descp_color,
    grada: r.grada,
    cantidad: Number(r.cantidad),
    imagen_nombre: null,
    linea_id: r.linea_id ? Number(r.linea_id) : null,
    referencia_id: r.referencia_id ? Number(r.referencia_id) : null,
    material_id: r.material_id ? Number(r.material_id) : 0,
    color_id: r.color_id ? Number(r.color_id) : 0,
    marca_id: r.marca_id ? Number(r.marca_id) : null,
    genero_id: r.genero_id ? Number(r.genero_id) : null,
    grupo_estilo_id: r.grupo_estilo_id ? Number(r.grupo_estilo_id) : null,
    tipo_1_id: r.tipo_1_id ? Number(r.tipo_1_id) : null,
    tipo_v2_id: r.tipo_v2_id ? Number(r.tipo_v2_id) : null,
    tono_etiqueta: r.tono_etiqueta,
    tipo_1: r.tipo_1,
    precio_unitario: Number(r.precio) || null,
    deposito_codigo: r.deposito_codigo,
    columna_stock_legal: r.columna_stock_legal,
  }));

  const cajas = new Set(
    productos.map(
      (p) =>
        `${p.linea_codigo_proveedor}-${p.referencia_codigo_proveedor}-${p.material_code}-${p.color_code}`,
    ),
  ).size;
  const pares = productos.reduce((a, p) => a + p.cantidad, 0);

  return {
    productos,
    cajas,
    pares,
    batch: rows[0]?.batch_label ?? null,
  };
}
