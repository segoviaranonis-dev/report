import type { Pool } from "pg";
import {
  basenameImagen,
  type PePdfParticion,
  type PePdfRow,
} from "./generar-pdf-stock-pe";
import type { CadenaPdf } from "./particion-etiqueta";
import {
  cadenaPeACadenaPdf,
  labelDescripcionGrupo,
  slugArchivoCodGrupo,
} from "./particion-etiqueta";

export { etiquetaParticionVisible } from "./particion-etiqueta";
export type { CadenaPdf } from "./particion-etiqueta";

export type ListaPrecio = "LPN" | "LPC03" | "LPC04";

/** Cocina Director: tres espejos LP × misma partición Grupo 1 (2.3.1.35.11). */
export const LPS_ORDEN: ListaPrecio[] = ["LPN", "LPC03", "LPC04"];
export const LPS_TODAS: ListaPrecio[] = ["LPN", "LPC03", "LPC04"];

/**
 * Ley DPE / Director:
 * - Diccionario: COD.GRUPO (sdrm0849 col D) × stock (sdrm#### COD.GRUPO)
 * - Calzado prefijos 01–09 · VIZZANO = 02
 * - 1 Grupo 1 (COD.GRUPO) = 1 PDF
 * - Nombre = MARCA · TIPO0 · TIPO1 · TIPO2 (descripciones del grupo)
 */
export type PlanPdfGrupoDpe = {
  orden: string;
  codGrupo: string;
  cadena: CadenaPdf | null;
  /** Etiqueta = descripción combinada del grupo */
  label: string;
  marca: string;
  tipo0: string;
  tipo1: string;
  tipo2: string;
  cadenaPe: string;
};

function precioCol(lp: ListaPrecio): string {
  if (lp === "LPC03") return "lpc03";
  if (lp === "LPC04") return "lpc04";
  return "lpn";
}

/**
 * Espejo LPC03/LPC04: si la columna LP está vacía, usa LPN (mismo stock · mismo Grupo 1).
 * Precio PDF = coalesce(LP, LPN).
 */
function precioSqlExpr(lp: ListaPrecio): string {
  if (lp === "LPC03") return "coalesce(nullif(v.lpc03, 0), nullif(v.lpn, 0), 0)";
  if (lp === "LPC04") return "coalesce(nullif(v.lpc04, 0), nullif(v.lpn, 0), 0)";
  return "coalesce(v.lpn, 0)";
}

function wherePrecioStock(lp: ListaPrecio): string {
  if (lp === "LPC03" || lp === "LPC04") {
    return `(${precioSqlExpr(lp)} > 0)`;
  }
  return `coalesce(v.lpn, 0) > 0`;
}

/** Lista COD.GRUPO con stock para marca × LP (orden: cod_grupo). */
export async function listGruposDpeConStock(
  pool: Pool,
  opts: {
    marca: string;
    listaPrecio: ListaPrecio;
    depositos?: string[];
  },
): Promise<PlanPdfGrupoDpe[]> {
  const marca = opts.marca.trim().toUpperCase();
  const params: unknown[] = [marca];
  let i = 2;
  const where: string[] = [
    `upper(trim(coalesce(nullif(v.descp_marca, ''), v.sdrm_marca, ''))) = $1`,
    `coalesce(v.saldo_pares, 0) > 0`,
    wherePrecioStock(opts.listaPrecio),
    `nullif(trim(v.cod_grupo::text), '') IS NOT NULL`,
  ];

  if (opts.depositos?.length) {
    where.push(
      `upper(trim(coalesce(v.deposito_nombre, v.deposito_id::text, ''))) = ANY($${i}::text[])`,
    );
    params.push(opts.depositos.map((d) => d.toUpperCase()));
    i += 1;
  }

  const sql = `
    SELECT
      trim(v.cod_grupo::text) AS cod_grupo,
      upper(trim(coalesce(
        max(dim.cadena_comercial),
        max(v.cadena_comercial),
        'REGULAR'
      ))) AS cadena_pe,
      upper(trim(coalesce(max(dim.marca), $1))) AS marca_dim,
      upper(trim(coalesce(max(dim.tipo0), max(v.descp_tipo_1), max(v.sdrm_tipo1), ''))) AS tipo0,
      upper(trim(coalesce(max(dim.tipo1), ''))) AS tipo1,
      upper(trim(coalesce(max(dim.tipo2), ''))) AS tipo2,
      sum(coalesce(v.saldo_pares, 0))::float8 AS pares
    FROM v_stock_pe_rimec v
    LEFT JOIN sdrm_cod_grupo_dim dim ON dim.cod_grupo = trim(v.cod_grupo::text)
    WHERE ${where.join(" AND ")}
    GROUP BY 1
    HAVING sum(coalesce(v.saldo_pares, 0)) > 0
    ORDER BY 1
  `;

  const r = await pool.query<{
    cod_grupo: string;
    cadena_pe: string;
    marca_dim: string;
    tipo0: string;
    tipo1: string;
    tipo2: string;
    pares: number;
  }>(sql, params);

  return r.rows.map((row, idx) => {
    const marcaG = (row.marca_dim || marca).toUpperCase();
    const tipo0 = row.tipo0 || "GRUPO";
    const tipo1 = row.tipo1 || "";
    const tipo2 = row.tipo2 || "";
    return {
      orden: String(idx + 1).padStart(2, "0"),
      codGrupo: row.cod_grupo,
      cadena: cadenaPeACadenaPdf(row.cadena_pe),
      marca: marcaG,
      tipo0,
      tipo1,
      tipo2,
      cadenaPe: row.cadena_pe || "REGULAR",
      label: labelDescripcionGrupo({
        marca: marcaG,
        tipo0,
        tipo1,
        tipo2,
      }),
    };
  });
}

/**
 * Filas de stock de un solo COD.GRUPO (Grupo 1) × marca × LP.
 */
export async function fetchParticionStockPePorGrupo(
  pool: Pool,
  opts: {
    marca: string;
    listaPrecio: ListaPrecio;
    codGrupo: string;
    depositos?: string[];
    limit?: number;
    casoLabel?: string;
    cadena?: CadenaPdf | null;
  },
): Promise<PePdfParticion | null> {
  const marca = opts.marca.trim().toUpperCase();
  const lp = opts.listaPrecio;
  const precioExpr = precioSqlExpr(lp);
  const codGrupo = opts.codGrupo.trim();
  const params: unknown[] = [marca, codGrupo];
  let i = 3;
  const where: string[] = [
    `upper(trim(coalesce(nullif(v.descp_marca, ''), v.sdrm_marca, ''))) = $1`,
    `trim(v.cod_grupo::text) = $2`,
    `coalesce(v.saldo_pares, 0) > 0`,
    wherePrecioStock(lp),
  ];

  if (opts.depositos?.length) {
    where.push(
      `upper(trim(coalesce(v.deposito_nombre, v.deposito_id::text, ''))) = ANY($${i}::text[])`,
    );
    params.push(opts.depositos.map((d) => d.toUpperCase()));
    i += 1;
  }

  const lim = Math.min(Math.max(opts.limit ?? 800, 1), 3000);
  params.push(lim);

  const sql = `
    SELECT
      trim(coalesce(v.linea_codigo, '')) AS linea,
      trim(coalesce(v.referencia_codigo, '')) AS referencia,
      trim(coalesce(v.material_code, '')) AS material,
      trim(coalesce(v.color_code, '')) AS color,
      trim(coalesce(v.descp_material, '')) AS descp_material,
      trim(coalesce(v.descp_color, '')) AS descp_color,
      trim(coalesce(v.grada, '')) AS grada,
      v.grades_json,
      trim(coalesce(v.imagen_color_excel, '')) AS imagen_color_excel,
      trim(coalesce(v.descp_grupo_estilo, v.sdrm_tipo0, 'SIN ESTILO')) AS estilo,
      coalesce(v.saldo_pares, 0)::float8 AS saldo,
      (${precioExpr})::float8 AS precio,
      nullif(trim(coalesce(v.imagen_url, '')), '') AS imagen_url,
      nullif(trim(coalesce(ex.archivo_origen, '')), '') AS archivo_origen,
      nullif(trim(coalesce(ex.batch_label, '')), '') AS batch_label,
      ex.cantidad::float8 AS qty_excel
    FROM v_stock_pe_rimec v
    LEFT JOIN LATERAL (
      SELECT s.archivo_origen, s.batch_label, s.cantidad
      FROM stock_pe_staging_migrated m
      JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
      WHERE m.ppd_id = v.det_id
      ORDER BY s.id DESC
      LIMIT 1
    ) ex ON TRUE
    WHERE ${where.join(" AND ")}
    ORDER BY
      CASE WHEN trim(coalesce(v.linea_codigo, '')) ~ '^[0-9]+$'
        THEN trim(v.linea_codigo)::numeric ELSE NULL END NULLS LAST,
      trim(coalesce(v.linea_codigo, '')),
      CASE WHEN trim(coalesce(v.referencia_codigo, '')) ~ '^[0-9]+$'
        THEN trim(v.referencia_codigo)::numeric ELSE NULL END NULLS LAST,
      trim(coalesce(v.referencia_codigo, '')),
      CASE WHEN trim(coalesce(v.material_code, '')) ~ '^[0-9]+$'
        THEN trim(v.material_code)::numeric ELSE NULL END NULLS LAST,
      trim(coalesce(v.material_code, '')),
      CASE WHEN trim(coalesce(v.color_code, '')) ~ '^[0-9]+$'
        THEN trim(v.color_code)::numeric ELSE NULL END NULLS LAST,
      trim(coalesce(v.color_code, ''))
    LIMIT $${i}
  `;

  const r = await pool.query<{
    linea: string;
    referencia: string;
    material: string;
    color: string;
    descp_material: string;
    descp_color: string;
    grada: string;
    grades_json: Record<string, number> | null;
    imagen_color_excel: string;
    estilo: string;
    saldo: number;
    precio: number;
    imagen_url: string | null;
    archivo_origen: string | null;
    batch_label: string | null;
    qty_excel: number | null;
  }>(sql, params);

  if (!r.rows.length) return null;

  const rows: PePdfRow[] = r.rows.map((row) => {
    const excelPadre = row.archivo_origen || row.batch_label || "";
    const imagenNombre =
      basenameImagen(row.imagen_url, row.imagen_color_excel) ||
      row.imagen_color_excel ||
      "";
    return {
      linea: row.linea || "?",
      referencia: row.referencia || "?",
      material: row.material || "?",
      color: row.color || "?",
      descpMaterial: row.descp_material || row.material || "?",
      descpColor: row.descp_color || row.color || "?",
      grada: row.grada || "",
      gradesJson: row.grades_json,
      estilo: row.estilo || "SIN ESTILO",
      saldo: Number(row.saldo) || 0,
      precio: Number(row.precio) || 0,
      imagen_url: row.imagen_url,
      imagenNombre,
      excelPadre,
      qtyExcel: row.qty_excel == null ? null : Number(row.qty_excel),
    };
  });

  const excelPadres = [...new Set(rows.map((x) => x.excelPadre).filter(Boolean))];

  return {
    marca,
    casoLabel: opts.casoLabel || `G${codGrupo}`,
    cadenaComercial: opts.cadena ?? null,
    particionId: `G${codGrupo}`,
    listaPrecio: lp,
    depositoLabel: opts.depositos?.join("/") || "TODOS",
    excelPadreLabel: excelPadres.join(" · ") || undefined,
    rows,
  };
}

/** @deprecated */
export async function fetchParticionStockPe(
  pool: Pool,
  opts: {
    marca: string;
    listaPrecio: ListaPrecio;
    codGrupo: string;
    cadena?: CadenaPdf | null;
    depositos?: string[];
    limit?: number;
    casoLabel?: string;
  },
): Promise<PePdfParticion | null> {
  return fetchParticionStockPePorGrupo(pool, opts);
}

export type RamoPdf = "CALZADO" | "CONFECCIONES" | "ACCESORIOS" | "OTROS";

export function pathArchivoGrupoDpe(
  marca: string,
  lp: ListaPrecio,
  plan: PlanPdfGrupoDpe,
  ramo: RamoPdf = "CALZADO",
): { relDir: string; filename: string; relPath: string } {
  const base = slugArchivoCodGrupo({
    marca: plan.marca || marca,
    tipo0: plan.tipo0,
    tipo1: plan.tipo1,
    tipo2: plan.tipo2,
    listaPrecio: lp,
    codGrupo: plan.codGrupo,
  });
  // Prefijo orden solo para sort en carpeta; nombre visible = descripción
  const filename = `${plan.orden}_${base}`;
  const ramoKey = (ramo || "CALZADO").toUpperCase() as RamoPdf;
  const relDir = `${ramoKey}/${lp}`;
  return { relDir, filename, relPath: `${relDir}/${filename}` };
}
