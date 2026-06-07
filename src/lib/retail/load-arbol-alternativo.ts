/**
 * Carga de datos para árboles alternativos de análisis retail
 *
 * Jerarquías soportadas:
 * 1. Ente → Estilo → Marca → SKU
 * 2. Ente → Marca → Estilo → SKU
 */

import { getRimecPool } from "@/lib/rimec/pool";
import type { RetailArbolSnapshotMeta } from "./arbol-snapshot-types";

export interface ArbolLeafAlternativo {
  // Dimensiones
  ente: string;
  genero: string;
  marca: string;
  estilo: string;

  // SKU
  skuKey: string;
  skuLabel: string;

  // Métricas
  stock: number;
  venta: number;
}

function normalizeEnte(raw: string): string {
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
 * Carga datos para las jerarquías alternativas
 */
export async function loadArbolAlternativoLeaves(whereClause: string = ""): Promise<{
  leaves: ArbolLeafAlternativo[];
  meta: RetailArbolSnapshotMeta;
  totalFilas: number;
}> {
  const pool = getRimecPool();

  // Metadata
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

  // Query principal con todas las dimensiones
  const { rows } = await pool.query<{
    origen_holding: string;
    genero: string;
    marca: string;
    estilo: string;
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

      -- Género
      COALESCE(
        NULLIF(btrim(g.descripcion::text), ''),
        NULLIF(btrim(g.codigo::text), ''),
        '(sin género)'
      ) AS genero,

      -- Marca
      COALESCE(NULLIF(btrim(mv.descp_marca::text), ''), '(sin marca)') AS marca,

      -- Estilo (grupo_estilo_v2)
      COALESCE(NULLIF(btrim(ge.descp_grupo_estilo::text), ''), '(sin estilo)') AS estilo,

      -- SKU components
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

      COALESCE(
        NULLIF(btrim(s.excel_material_code::text), ''),
        CASE
          WHEN mat.id IS NULL THEN NULL
          WHEN mat.codigo_proveedor = -999001::bigint THEN NULL
          ELSE trim(mat.codigo_proveedor::text)
        END,
        ''
      ) AS material_code,

      COALESCE(
        NULLIF(btrim(s.excel_color_code::text), ''),
        CASE
          WHEN col.id IS NULL THEN NULL
          WHEN col.codigo_proveedor = -999001::bigint THEN NULL
          ELSE trim(col.codigo_proveedor::text)
        END,
        ''
      ) AS color_code,

      -- Métricas
      SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'stock' THEN s.cantidad::float8 ELSE 0 END)::text AS stock,
      SUM(CASE WHEN lower(btrim(s.tipo_movimiento)) = 'venta' THEN s.cantidad::float8 ELSE 0 END)::text AS venta

    FROM public.registro_st_vt_rc_reposicion s
    LEFT JOIN public.material mat ON mat.id = s.material_id
    LEFT JOIN public.color col ON col.id = s.color_id
    LEFT JOIN public.marca_v2 mv ON mv.id_marca = s.marca_id
    LEFT JOIN public.genero g ON g.id = s.genero_id
    LEFT JOIN public.grupo_estilo_v2 ge ON ge.id_grupo_estilo = s.grupo_estilo_id
    ${whereClause}
    GROUP BY
      s.origen_holding,
      genero,
      marca,
      estilo,
      trim(s.linea_codigo_proveedor),
      trim(s.referencia_codigo_proveedor),
      material_txt,
      color_txt,
      material_code,
      color_code
  `);

  const leaves: ArbolLeafAlternativo[] = rows.map((r) => {
    const ente = normalizeEnte(r.origen_holding);
    const linea = r.linea ?? "";
    const ref = r.referencia ?? "";
    const matCode = r.material_code ?? "";
    const colCode = r.color_code ?? "";
    const skuKey = [ente, r.genero, r.marca, r.estilo, linea, ref, matCode, colCode].join("|");

    return {
      ente,
      genero: r.genero,
      marca: r.marca,
      estilo: r.estilo,
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
