import { getRimecPool } from "@/lib/rimec/pool";
import type { RetailArbolLeaf, RetailArbolSnapshotMeta } from "@/lib/retail/arbol-snapshot-types";

const MATERIAL_CODE_SQL = `
  COALESCE(
    NULLIF(btrim(s.excel_material_code::text), ''),
    CASE
      WHEN mat.id IS NULL THEN NULL
      WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
      ELSE trim(mat.codigo_proveedor::text)
    END,
    ''
  )`;

const COLOR_CODE_SQL = `
  COALESCE(
    NULLIF(btrim(s.excel_color_code::text), ''),
    CASE
      WHEN col.id IS NULL THEN NULL
      WHEN col.codigo_proveedor = -999001::bigint THEN NULL
      ELSE trim(col.codigo_proveedor::text)
    END,
    ''
  )`;

/** Normaliza nodo del holding (Importadora → RIMEC). */
export function normalizeRetailEnte(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "(sin ente)";
  const low = t.toLowerCase();
  if (low.includes("import") || low === "rimec" || low.includes("depósito") || low.includes("deposito")) {
    return "RIMEC";
  }
  return t;
}

function skuLabel(
  linea: string,
  ref: string,
  material: string,
  color: string,
): string {
  const mat = material.trim() || "—";
  const col = color.trim() || "—";
  return `${linea.trim() || "—"} · ${ref.trim() || "—"} · ${mat} · ${col}`;
}

/**
 * Agrega TODAS las filas del snapshot vigente (sin batch_id, sin grada).
 * Pivot: Stock | Venta por SUM(cantidad).
 */
export async function loadRetailArbolLeaves(): Promise<{
  leaves: RetailArbolLeaf[];
  meta: RetailArbolSnapshotMeta;
  totalFilas: number;
}> {
  const pool = getRimecPool();

  const metaQ = await pool.query<{
    total_filas: number;
    archivo_origen: string | null;
    cargado_en: string | null;
  }>(`
    SELECT
      COUNT(*)::int AS total_filas,
      MAX(NULLIF(btrim(archivo_origen), '')) AS archivo_origen,
      MAX(created_at)::text AS cargado_en
    FROM public.registro_st_vt_rc_reposicion
  `);
  const metaRow = metaQ.rows[0];
  const totalFilas = metaRow?.total_filas ?? 0;

  if (totalFilas === 0) {
    return {
      leaves: [],
      meta: { archivoOrigen: null, cargadoEn: null },
      totalFilas: 0,
    };
  }

  const { rows } = await pool.query<{
    origen_holding: string;
    genero: string;
    marca: string;
    linea: string;
    referencia: string;
    material_txt: string;
    color_txt: string;
    material_code: string;
    color_code: string;
    stock: string;
    venta: string;
  }>(`
    SELECT
      s.origen_holding,
      COALESCE(
        NULLIF(btrim(g.descripcion::text), ''),
        NULLIF(btrim(g.codigo::text), ''),
        '(sin género)'
      ) AS genero,
      COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)') AS marca,
      trim(s.linea_codigo_proveedor) AS linea,
      trim(s.referencia_codigo_proveedor) AS referencia,
      COALESCE(
        NULLIF(btrim(mat.descripcion::text), ''),
        NULLIF(btrim(s.excel_material_code::text), ''),
        trim(mat.codigo_proveedor::text),
        ''
      ) AS material_txt,
      COALESCE(
        NULLIF(btrim(col.nombre::text), ''),
        NULLIF(btrim(s.excel_color_code::text), ''),
        ''
      ) AS color_txt,
      ${MATERIAL_CODE_SQL} AS material_code,
      ${COLOR_CODE_SQL} AS color_code,
      SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'stock' THEN s.cantidad::float8 ELSE 0 END)::text AS stock,
      SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'venta' THEN s.cantidad::float8 ELSE 0 END)::text AS venta
    FROM public.registro_st_vt_rc_reposicion s
    LEFT JOIN public.material mat ON mat.id = s.material_id
    LEFT JOIN public.color col ON col.id = s.color_id
    LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
    LEFT JOIN public.genero g ON g.id = s.genero_id
    GROUP BY
      s.origen_holding,
      COALESCE(
        NULLIF(btrim(g.descripcion::text), ''),
        NULLIF(btrim(g.codigo::text), ''),
        '(sin género)'
      ),
      COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)'),
      trim(s.linea_codigo_proveedor),
      trim(s.referencia_codigo_proveedor),
      COALESCE(
        NULLIF(btrim(mat.descripcion::text), ''),
        NULLIF(btrim(s.excel_material_code::text), ''),
        trim(mat.codigo_proveedor::text),
        ''
      ),
      COALESCE(
        NULLIF(btrim(col.nombre::text), ''),
        NULLIF(btrim(s.excel_color_code::text), ''),
        ''
      ),
      ${MATERIAL_CODE_SQL},
      ${COLOR_CODE_SQL}
  `);

  const leaves: RetailArbolLeaf[] = rows.map((r) => {
    const ente = normalizeRetailEnte(r.origen_holding);
    const linea = r.linea ?? "";
    const ref = r.referencia ?? "";
    const matCode = r.material_code ?? "";
    const colCode = r.color_code ?? "";
    const skuKey = [ente, r.genero, r.marca, linea, ref, matCode, colCode].join("|");
    return {
      ente,
      genero: r.genero,
      marca: r.marca,
      skuKey,
      skuLabel: skuLabel(linea, ref, r.material_txt, r.color_txt),
      stock: Number(r.stock) || 0,
      venta: Number(r.venta) || 0,
    };
  });

  return {
    leaves,
    meta: {
      archivoOrigen: metaRow?.archivo_origen ?? null,
      cargadoEn: metaRow?.cargado_en ?? null,
    },
    totalFilas,
  };
}
