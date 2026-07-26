import type { Pool } from "pg";
import {
  FACTURA_REAL_LABEL,
  FI_NEXUS_LABEL,
  resolveFacturaCarlosImport,
} from "@/lib/logistica-ok/factura-real";
import { syncLogisticaPpIfBandera } from "@/lib/logistica-ok/sync-pp";
import { backfillFiIcNotasProgramado } from "@/lib/pedido-proveedor/proforma-programado-engine";

export type CierreImportRow = {
  nro_ic: string;
  fi_nexus: string;
  evento_precio?: string;
  listado_lp?: string | number | null;
  factura_real?: string;
  id_cliente?: number;
};

export type ImportCierreResult = {
  ok: boolean;
  pp_id: number;
  filas_leidas: number;
  emparejamientos_ok: number;
  pv_actualizados: number;
  pv_omitidos_vacio: number;
  errores: string[];
  sync_logistica?: number;
  notas_backfill?: number;
};

function normIc(nro: string): string {
  const s = String(nro ?? "").trim();
  const m = s.match(/IC-2026-(\d+)/i);
  if (m) return `IC-2026-${m[1].padStart(4, "0")}`;
  if (/^\d+$/.test(s)) return `IC-2026-${s.padStart(4, "0")}`;
  return s;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const HEADER_ALIASES: Record<string, keyof CierreImportRow> = {
  "nro ic": "nro_ic",
  "nro_ic": "nro_ic",
  "fi nexus": "fi_nexus",
  [FI_NEXUS_LABEL.toLowerCase()]: "fi_nexus",
  "evento precio": "evento_precio",
  "listado lp": "listado_lp",
  [FACTURA_REAL_LABEL.toLowerCase()]: "factura_real",
  "cód cliente": "id_cliente",
  "cod cliente": "id_cliente",
};

function mapHeader(cells: string[]): Partial<Record<keyof CierreImportRow, number>> {
  const map: Partial<Record<keyof CierreImportRow, number>> = {};
  cells.forEach((h, i) => {
    const key = HEADER_ALIASES[h.trim().toLowerCase()];
    if (key) map[key] = i;
  });
  return map;
}

/** Parsea CSV cierre (export Nexus) — comentarios # ignorados */
export function parseCierreImportacionCsv(text: string): CierreImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let colMap: Partial<Record<keyof CierreImportRow, number>> | null = null;
  const rows: CierreImportRow[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith('"#')) continue;
    const cells = parseCsvLine(line);
    if (!colMap) {
      const hdr = mapHeader(cells);
      if (hdr.nro_ic != null && hdr.fi_nexus != null) {
        colMap = hdr;
        continue;
      }
      continue;
    }
    const get = (k: keyof CierreImportRow) => {
      const idx = colMap![k];
      return idx == null ? "" : String(cells[idx] ?? "").trim();
    };
    const nro_ic = normIc(get("nro_ic"));
    const fi_nexus = get("fi_nexus");
    if (!nro_ic || !fi_nexus) continue;
    rows.push({
      nro_ic,
      fi_nexus,
      evento_precio: get("evento_precio") || undefined,
      listado_lp: get("listado_lp") || null,
      factura_real: get("factura_real") || undefined,
      id_cliente: get("id_cliente") ? Number(get("id_cliente")) : undefined,
    });
  }
  if (!colMap) {
    throw new Error(`CSV inválido — faltan columnas «Nro IC» y «${FI_NEXUS_LABEL}».`);
  }
  return rows;
}

export async function importCierreImportacionCsv(
  pool: Pool,
  ppId: number,
  csvText: string,
  opts?: { syncLogistica?: boolean; dryRun?: boolean },
): Promise<ImportCierreResult> {
  const rows = parseCierreImportacionCsv(csvText);
  const errores: string[] = [];
  let emparejamientos_ok = 0;
  let pv_actualizados = 0;
  let pv_omitidos_vacio = 0;

  const { rows: ppRows } = await pool.query<{ numero_registro: string }>(
    `SELECT numero_registro FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  if (!ppRows[0]) {
    return {
      ok: false,
      pp_id: ppId,
      filas_leidas: rows.length,
      emparejamientos_ok: 0,
      pv_actualizados: 0,
      pv_omitidos_vacio: 0,
      errores: ["PP no encontrado"],
    };
  }

  const client = await pool.connect();
  try {
    if (!opts?.dryRun) await client.query("BEGIN");

    for (const row of rows) {
      const { rows: icFi } = await client.query<{
        fi_id: string;
        ic_id: string;
        pv_global: string | null;
        factura_carlos: string | null;
        evento: string | null;
        listado_lp: string | null;
        id_cliente: string;
      }>(
        `
        SELECT fi.id::text AS fi_id,
               ic.id::text AS ic_id,
               fi.pv_global::text,
               fi.factura_carlos,
               pe.nombre_evento AS evento,
               ic.listado_precio_id::text AS listado_lp,
               ic.id_cliente::text
        FROM intencion_compra ic
        JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1
        JOIN factura_interna fi ON fi.pp_id = $1 AND fi.nro_factura = $2
        LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
        WHERE ic.numero_registro = $3
        LIMIT 1
        `,
        [ppId, row.fi_nexus, row.nro_ic],
      );

      const hit = icFi[0];
      if (!hit) {
        errores.push(`Sin match IC=${row.nro_ic} · FI=${row.fi_nexus}`);
        continue;
      }

      if (row.id_cliente != null && Number(hit.id_cliente) !== row.id_cliente) {
        errores.push(`Cliente distinto IC=${row.nro_ic} CSV=${row.id_cliente} BD=${hit.id_cliente}`);
        continue;
      }

      if (row.evento_precio && hit.evento) {
        const q = row.evento_precio.toLowerCase().slice(0, 15);
        const bd = hit.evento.toLowerCase();
        if (q.length >= 8 && !bd.includes(q.slice(0, 8))) {
          errores.push(`Evento Q mismatch IC=${row.nro_ic}`);
          continue;
        }
      }

      if (row.listado_lp != null && String(row.listado_lp).trim() !== "") {
        const lpCsv = String(row.listado_lp).trim();
        if (hit.listado_lp && hit.listado_lp !== lpCsv) {
          errores.push(`Listado R mismatch IC=${row.nro_ic} CSV=${lpCsv} BD=${hit.listado_lp}`);
          continue;
        }
      }

      emparejamientos_ok++;

      const resolved = resolveFacturaCarlosImport(row.factura_real);
      if (!resolved.factura_carlos && resolved.pv_global == null) {
        pv_omitidos_vacio++;
        continue;
      }

      if (!opts?.dryRun) {
        const upd = await client.query(
          `UPDATE factura_interna
           SET factura_carlos = COALESCE($2, factura_carlos),
               pv_global = COALESCE($3, pv_global),
               factura_carlos_at = CASE WHEN $2 IS NOT NULL THEN now() ELSE factura_carlos_at END
           WHERE id = $1
             AND (
               (factura_carlos IS NULL OR BTRIM(factura_carlos) = '' OR factura_carlos = $2)
               AND (pv_global IS NULL OR pv_global = $3 OR $3 IS NULL)
             )`,
          [hit.fi_id, resolved.factura_carlos, resolved.pv_global],
        );
        if ((upd.rowCount ?? 0) > 0) pv_actualizados++;
      } else {
        const yaTiene =
          (hit.factura_carlos?.trim() && hit.factura_carlos === resolved.factura_carlos) ||
          (resolved.pv_global != null &&
            hit.pv_global != null &&
            Number(hit.pv_global) === resolved.pv_global);
        const vacio = !hit.factura_carlos?.trim() && hit.pv_global == null;
        if (yaTiene || vacio) pv_actualizados++;
      }
    }

    let notas_backfill = 0;
    let sync_logistica: number | undefined;

    if (!opts?.dryRun && errores.length === 0) {
      notas_backfill = await backfillFiIcNotasProgramado(ppId);
      if (opts?.syncLogistica !== false) {
        await syncLogisticaPpIfBandera(pool, ppId);
        const { rows: cnt } = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM logistica_pendiente_confirmacion WHERE pedido_proveedor_id = $1`,
          [ppId],
        );
        sync_logistica = Number(cnt[0]?.n ?? 0);
      }
      await client.query("COMMIT");
    } else if (!opts?.dryRun) {
      await client.query("ROLLBACK");
    }

    const ok = errores.length === 0 && emparejamientos_ok === rows.length && rows.length > 0;
    return {
      ok,
      pp_id: ppId,
      filas_leidas: rows.length,
      emparejamientos_ok,
      pv_actualizados,
      pv_omitidos_vacio,
      errores,
      notas_backfill: !opts?.dryRun && ok ? notas_backfill : undefined,
      sync_logistica: !opts?.dryRun && ok ? sync_logistica : undefined,
    };
  } catch (e) {
    if (!opts?.dryRun) await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
