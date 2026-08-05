/**
 * Bóveda RIMEC — archivo operativo Facturación PE (MIG-186).
 * Soft-archive: no muta factura_interna.estado.
 */
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { SQL_FI_ES_PE } from "@/lib/facturacion/filters";
import {
  SQL_VENDEDOR_FI_DISPLAY,
  SQL_VENDEDOR_FI_JOINS,
} from "@/lib/facturacion/vendedor-fi-display";

export type BovedaOrigen = "pronta-entrega" | "transito";

export type BovedaRow = {
  boveda_id: number;
  fi_id: number;
  nro_factura: string;
  factura_display: string;
  pv_global: number | null;
  marca: string;
  cliente: string;
  codigo_cliente: string;
  vendedor: string;
  total_monto: number;
  total_pares: number;
  fi_estado: string;
  origen: string;
  archivado_en: string;
  archivado_por: number | null;
  nota: string | null;
};

export async function fiYaEnBoveda(fiId: number): Promise<boolean> {
  if (!isRimecDatabaseConfigured()) return false;
  const pool = getRimecPool();
  const { rows } = await pool.query<{ n: string }>(
    `SELECT 1::text AS n FROM facturacion_boveda_rimec WHERE factura_interna_id = $1 LIMIT 1`,
    [fiId],
  );
  return rows.length > 0;
}

export async function resolveFiIdForBoveda(input: {
  fi_id?: number | null;
  nro_factura?: string | null;
}): Promise<{ ok: true; fiId: number; nro: string } | { ok: false; error: string }> {
  const pool = getRimecPool();
  if (input.fi_id != null && Number.isFinite(Number(input.fi_id)) && Number(input.fi_id) > 0) {
    const { rows } = await pool.query<{ id: number; nro_factura: string }>(
      `SELECT id, nro_factura FROM factura_interna WHERE id = $1 LIMIT 1`,
      [Number(input.fi_id)],
    );
    if (!rows[0]) return { ok: false, error: "FI no encontrada." };
    return { ok: true, fiId: rows[0].id, nro: rows[0].nro_factura };
  }
  const nro = String(input.nro_factura ?? "").trim();
  if (!nro) return { ok: false, error: "fi_id o nro_factura requerido." };
  const { rows } = await pool.query<{ id: number; nro_factura: string }>(
    `SELECT id, nro_factura FROM factura_interna WHERE nro_factura = $1 LIMIT 1`,
    [nro],
  );
  if (!rows[0]) return { ok: false, error: "FI no encontrada." };
  return { ok: true, fiId: rows[0].id, nro: rows[0].nro_factura };
}

/** Solo PE en este corte — valida universo Pronta entrega. */
export async function fiEsProntaEntrega(fiId: number): Promise<boolean> {
  const pool = getRimecPool();
  const { rows } = await pool.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1 FROM factura_interna fi
      WHERE fi.id = $1 AND ${SQL_FI_ES_PE}
    ) AS ok
    `,
    [fiId],
  );
  return Boolean(rows[0]?.ok);
}

export async function archivarFiEnBoveda(input: {
  fiId: number;
  origen?: BovedaOrigen;
  archivadoPor?: number | null;
  nota?: string | null;
}): Promise<{ ok: true; boveda_id: number } | { ok: false; error: string }> {
  if (!isRimecDatabaseConfigured()) {
    return { ok: false, error: "DATABASE_URL no configurada." };
  }
  const origen = input.origen ?? "pronta-entrega";
  if (origen === "pronta-entrega") {
    const pe = await fiEsProntaEntrega(input.fiId);
    if (!pe) return { ok: false, error: "Solo FI de Pronta entrega pueden archivarse en este corte." };
  }
  if (await fiYaEnBoveda(input.fiId)) {
    return { ok: false, error: "Esta FI ya está en la bóveda." };
  }

  const pool = getRimecPool();
  try {
    const { rows } = await pool.query<{ id: number }>(
      `
      INSERT INTO facturacion_boveda_rimec (
        factura_interna_id, origen, archivado_por, nota
      ) VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [
        input.fiId,
        origen,
        input.archivadoPor ?? null,
        input.nota?.trim() ? input.nota.trim().slice(0, 500) : null,
      ],
    );
    return { ok: true, boveda_id: Number(rows[0].id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|uq_facturacion_boveda/i.test(msg)) {
      return { ok: false, error: "Esta FI ya está en la bóveda." };
    }
    if (/does not exist|relation.*boveda/i.test(msg)) {
      return { ok: false, error: "Tabla bóveda ausente — aplicar MIG-186." };
    }
    return { ok: false, error: msg };
  }
}

export async function listarBoveda(
  origen: BovedaOrigen = "pronta-entrega",
): Promise<BovedaRow[]> {
  if (!isRimecDatabaseConfigured()) return [];
  const pool = getRimecPool();
  try {
    const { rows } = await pool.query<{
      boveda_id: number;
      fi_id: number;
      nro_factura: string;
      pv_global: number | null;
      marca: string | null;
      cliente: string | null;
      codigo_cliente: string | null;
      vendedor: string | null;
      total_monto: string | null;
      total_pares: string | null;
      fi_estado: string;
      origen: string;
      archivado_en: string;
      archivado_por: number | null;
      nota: string | null;
    }>(
      `
      SELECT
        b.id AS boveda_id,
        fi.id AS fi_id,
        fi.nro_factura,
        fi.pv_global::int AS pv_global,
        COALESCE(fi.marca, '—') AS marca,
        COALESCE(c.descp_cliente, fi.cliente_id::text, '—') AS cliente,
        COALESCE(fi.cliente_id::text, '—') AS codigo_cliente,
        ${SQL_VENDEDOR_FI_DISPLAY} AS vendedor,
        COALESCE(fi.total_monto, 0)::text AS total_monto,
        COALESCE(fi.total_pares, 0)::text AS total_pares,
        fi.estado AS fi_estado,
        b.origen,
        b.archivado_en::text AS archivado_en,
        b.archivado_por,
        b.nota
      FROM facturacion_boveda_rimec b
      JOIN factura_interna fi ON fi.id = b.factura_interna_id
      LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
      ${SQL_VENDEDOR_FI_JOINS}
      WHERE b.origen = $1
      ORDER BY b.archivado_en DESC, b.id DESC
      LIMIT 500
      `,
      [origen],
    );

    return rows.map((r) => {
      const pv = r.pv_global != null ? Number(r.pv_global) : null;
      const factura_display =
        pv != null && pv > 0
          ? `PV${String(pv).padStart(6, "0")}`
          : r.nro_factura;
      return {
        boveda_id: Number(r.boveda_id),
        fi_id: Number(r.fi_id),
        nro_factura: r.nro_factura,
        factura_display,
        pv_global: pv,
        marca: r.marca ?? "—",
        cliente: r.cliente ?? "—",
        codigo_cliente: r.codigo_cliente ?? "—",
        vendedor: r.vendedor ?? "—",
        total_monto: Number(r.total_monto) || 0,
        total_pares: Number(r.total_pares) || 0,
        fi_estado: r.fi_estado,
        origen: r.origen,
        archivado_en: r.archivado_en,
        archivado_por: r.archivado_por != null ? Number(r.archivado_por) : null,
        nota: r.nota,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|relation.*boveda/i.test(msg)) {
      console.warn("[boveda] MIG-186 pendiente:", msg);
      return [];
    }
    throw e;
  }
}
