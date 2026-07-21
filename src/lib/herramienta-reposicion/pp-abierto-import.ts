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

/** Busca cabecera tipo «FACTURA PROFORMA: 0004/2026» + FECHA (no la fila ITEM/STYLE). */
function extraerFacturaMeta(raw: unknown[][]): { nro: string; fecha: string | null } {
  let nro: string | null = null;
  let fecha: string | null = null;
  const max = Math.min(raw.length, 40);
  for (let i = 0; i < max; i++) {
    const row = raw[i] ?? [];
    for (let c = 0; c < Math.min(row.length, 12); c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      const upper = cell.toUpperCase();
      if (!nro && (upper.includes("FACTURA") || upper.includes("PROFORMA") || upper.includes("FATURA"))) {
        const m = cell.match(/(\d{3,5}\s*\/\s*\d{4}|\d+\s*\/\s*\d+)/);
        if (m) nro = m[1].replace(/\s+/g, "");
      }
      if (!fecha) {
        const fm = cell.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (fm && (upper.includes("FECHA") || c >= 4)) fecha = fm[1];
      }
    }
    if (nro && fecha) break;
  }
  if (!nro) {
    const r0 = raw[0] ?? [];
    const cell = String(r0[0] ?? "").trim();
    const m = cell.match(/(\d{3,5}\s*\/\s*\d{4}|\d+\s*\/\s*\d+)/);
    if (m) nro = m[1].replace(/\s+/g, "");
    else if (cell && !/^ITEM$/i.test(cell) && !/^STYLE$/i.test(cell)) nro = cell;
  }
  return { nro: nro || "S/N", fecha };
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
    // Prioridad: hoja con «FACTURA/FATURA PROFORMA»; si no, recorrer todas (hoja 0 a veces es solo ITEM).
    const preferidas = wb.SheetNames.filter((n) =>
      /fatura|factura|proforma/i.test(n),
    );
    const orden = [...preferidas, ...wb.SheetNames.filter((n) => !preferidas.includes(n))];
    for (const name of orden) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const raw = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        raw: true,
      }) as unknown[][];
      const meta = extraerFacturaMeta(raw);
      if (meta.nro && meta.nro !== "S/N" && !/^ITEM$/i.test(meta.nro)) {
        metaNro = meta.nro;
        metaFecha = parseFechaIso(meta.fecha);
        break;
      }
    }
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
