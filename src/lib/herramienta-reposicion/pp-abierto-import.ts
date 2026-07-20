import type { Pool } from "pg";
import { parseProforma, type ProformaRow } from "@/lib/pedido-proveedor/parse-proforma";

export type PpAbiertoImportResult = {
  importId: number;
  facturaNro: string;
  facturaFecha: string | null;
  archivoNombre: string;
  filas: number;
  totalPares: number;
};

function extraerFacturaMeta(raw: unknown[][]): { nro: string; fecha: string | null } {
  const r0 = raw[0] ?? [];
  const cell = String(r0[0] ?? "").trim();
  const m = cell.match(/(\d{4}\/\d{4}|\d+\/\d+)/);
  const nro = m?.[1] ?? (cell || "S/N");
  const fechaCell = String(r0[5] ?? r0[4] ?? "").trim();
  const fm = fechaCell.match(/(\d{2}\/\d{2}\/\d{4})/);
  return { nro, fecha: fm?.[1] ?? null };
}

function parseFechaIso(dmy: string | null): string | null {
  if (!dmy) return null;
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Importa proforma Excel → pp_abierto_import + filas (solo moléculas producto). */
export async function importPpAbiertoDesdeBuffer(
  pool: Pool,
  buffer: Buffer,
  archivoNombre: string,
): Promise<PpAbiertoImportResult> {
  const parsed = parseProforma(buffer);
  if (parsed.error) throw new Error(parsed.error);
  if (!parsed.rows.length) throw new Error("Proforma sin filas de producto.");

  let metaNro = "S/N";
  let metaFecha: string | null = null;
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][];
    const meta = extraerFacturaMeta(raw);
    metaNro = meta.nro;
    metaFecha = parseFechaIso(meta.fecha);
  } catch {
    /* meta opcional */
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE pp_abierto_import SET activo = false WHERE activo = true`);

    const ins = await client.query<{ id: string }>(
      `INSERT INTO pp_abierto_import (
         factura_nro, factura_fecha, archivo_nombre, total_filas, total_pares, activo
       ) VALUES ($1, $2::date, $3, $4, $5, true)
       RETURNING id`,
      [metaNro, metaFecha, archivoNombre, parsed.rows.length, parsed.totalPares],
    );
    const importId = Number(ins.rows[0]?.id);
    if (!Number.isFinite(importId)) throw new Error("No se pudo crear cabecera PP abierto.");

    for (const row of parsed.rows) {
      await insertFila(client, importId, row);
    }

    await client.query("COMMIT");
    return {
      importId,
      facturaNro: metaNro,
      facturaFecha: metaFecha,
      archivoNombre,
      filas: parsed.rows.length,
      totalPares: parsed.totalPares,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function insertFila(
  client: { query: Pool["query"] },
  importId: number,
  row: ProformaRow,
) {
  await client.query(
    `INSERT INTO pp_abierto_import_fila (
       import_id, item_nro, linea_codigo, referencia_codigo, material_code, color_code,
       descp_material, descp_color, marca, style_code, boxes, pares, unit_fob
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (import_id, linea_codigo, referencia_codigo, material_code, color_code)
     DO UPDATE SET
       pares = pp_abierto_import_fila.pares + EXCLUDED.pares,
       boxes = pp_abierto_import_fila.boxes + EXCLUDED.boxes,
       descp_material = COALESCE(NULLIF(EXCLUDED.descp_material, ''), pp_abierto_import_fila.descp_material),
       descp_color = COALESCE(NULLIF(EXCLUDED.descp_color, ''), pp_abierto_import_fila.descp_color),
       marca = COALESCE(NULLIF(EXCLUDED.marca, ''), pp_abierto_import_fila.marca)`,
    [
      importId,
      Number.parseInt(row.item, 10) || null,
      row.linea_codigo_proveedor,
      row.referencia_codigo_proveedor,
      row.material_code,
      row.color_code,
      row.material || null,
      row.color || null,
      row.brand || null,
      row.style_code || null,
      row.boxes,
      row.pairs,
      row.unit_fob > 0 ? row.unit_fob : null,
    ],
  );
}
