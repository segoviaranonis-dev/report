/**
 * Import color descriptions from proveedor xlsx → color.nombre
 * Paridad control_central/scripts/import_color_xlsx.py + upsert_color.
 */
import type { Pool } from "pg";
import * as XLSX from "xlsx";

export type ColorImportRow = { codigo: string; nombre: string };

export type ColorImportResult = {
  parsed: number;
  inserted: number;
  updated: number;
  skipped_empty: number;
  errors: string[];
};

const BATCH = 250;

const HEADER_ALIASES: Record<string, string[]> = {
  codigo: ["color code", "codigo", "código", "code", "color_code", "cod"],
  nombre: ["color", "descripcion", "descripción", "nombre", "desc"],
};

function normHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function pickColumn(headers: string[], keys: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (const key of keys) {
      if (HEADER_ALIASES[key]?.includes(h)) return i;
    }
  }
  return -1;
}

/** Parse Beira Rio / proveedor xlsx (COLOR CODE + COLOR). */
export function parseColorXlsxBuffer(buf: Buffer): ColorImportRow[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][];
  if (!matrix.length) return [];

  const headerRow = matrix[0].map(normHeader);
  let codIdx = pickColumn(headerRow, ["codigo"]);
  let nomIdx = pickColumn(headerRow, ["nombre"]);

  // Fallback: col0=codigo, col1=nombre (Beira Rio estándar)
  if (codIdx < 0) codIdx = 0;
  if (nomIdx < 0) nomIdx = codIdx === 0 ? 1 : 0;

  const out: ColorImportRow[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    const rawCod = row[codIdx];
    if (rawCod == null || String(rawCod).trim() === "") continue;

    const codigo = String(rawCod).trim().replace(/\.0+$/, "");
    const nombreRaw = row[nomIdx];
    const nombre = nombreRaw == null ? "" : String(nombreRaw).trim();
    if (!nombre) continue;
    if (seen.has(codigo)) continue;
    seen.add(codigo);
    out.push({ codigo, nombre });
  }
  return out;
}

/** Upsert masivo — listado proveedor (654 Beira Rio). */
export async function importColorRowsUpsert(
  pool: Pool,
  proveedorId: number,
  rows: ColorImportRow[],
): Promise<ColorImportResult> {
  const result: ColorImportResult = {
    parsed: rows.length,
    inserted: 0,
    updated: 0,
    skipped_empty: 0,
    errors: [],
  };

  const valid = rows.filter((r) => {
    if (!r.codigo?.trim() || !r.nombre?.trim()) {
      result.skipped_empty++;
      return false;
    }
    return true;
  });

  for (let i = 0; i < valid.length; i += BATCH) {
    const chunk = valid.slice(i, i + BATCH);
    const codes: string[] = [];
    const names: string[] = [];
    for (const row of chunk) {
      codes.push(row.codigo.trim().replace(/\.0+$/, ""));
      names.push(row.nombre.trim());
    }
    try {
      const before = await pool.query<{ codigo_proveedor: string }>(
        `
        SELECT codigo_proveedor::text
        FROM color
        WHERE proveedor_id = $1 AND codigo_proveedor = ANY($2::bigint[])
        `,
        [proveedorId, codes],
      );
      const existing = new Set(before.rows.map((r) => r.codigo_proveedor));

      await pool.query(
        `
        INSERT INTO color (codigo_proveedor, proveedor_id, nombre, activo)
        SELECT cod, $1::bigint, nom, true
        FROM unnest($2::bigint[], $3::text[]) AS t(cod, nom)
        ON CONFLICT (proveedor_id, codigo_proveedor) DO UPDATE SET
          nombre = CASE
            WHEN EXCLUDED.nombre IS NOT NULL AND btrim(EXCLUDED.nombre) <> ''
            THEN EXCLUDED.nombre
            ELSE color.nombre
          END,
          activo = true
        `,
        [proveedorId, codes, names],
      );

      for (const row of chunk) {
        const cod = row.codigo.trim().replace(/\.0+$/, "");
        if (existing.has(cod)) result.updated++;
        else result.inserted++;
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : "error en lote");
    }
  }

  return result;
}

export const POLITICA_IDIOMA_COLOR = {
  titulo: "Idioma del proveedor vs. operación RIMEC",
  proveedor:
    "Beira Rio (654) puede enviar descripciones en español, portugués e inglés mezclados — se guardan tal cual en color.nombre.",
  operacion:
    "Filtros y buscadores usan tono_canon.etiqueta en español (Negro, Beige, Gris…) asignado en este administrador.",
  regla:
    "Import sincroniza el listado oficial del proveedor. No traducimos nombre; tono_canon sí usa etiqueta en español.",
} as const;
