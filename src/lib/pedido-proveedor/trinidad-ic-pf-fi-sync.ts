/**
 * Trinidad PROGRAMADO: IC (editable) ↔ PF (vista Admin IC) ↔ FI (rígida operativa).
 * Emparejamiento canónico: factura_interna.notas = intencion_compra.numero_registro.
 * PF se recalcula en lectura desde IC.listado_precio_id — no persiste tier aparte.
 */
import type { Pool } from "pg";
import {
  actualizarEncabezadoFi,
  actualizarListaPrecioFi,
} from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { calcularNeto } from "@/lib/intencion-compra/calcular-neto";
import {
  esListadoPrecioValido,
  type ListadoPrecioTierId,
} from "@/lib/intencion-compra/listado-precio-tiers";
import type { UpdateIcVinculadaInput } from "@/lib/pedido-proveedor/cabecera-actions";

export type TrinidadSyncResult = {
  ok: true;
  fi_ids: number[];
  avisos: string[];
};

export async function listFiIdsPorIcEnPp(
  pool: Pool,
  ppId: number,
  icNumeroRegistro: string,
): Promise<number[]> {
  const nro = icNumeroRegistro.trim();
  if (!nro) return [];
  const { rows } = await pool.query<{ id: string }>(
    `SELECT fi.id
     FROM factura_interna fi
     WHERE fi.pp_id = $1
       AND TRIM(COALESCE(fi.notas, '')) = $2
       AND UPPER(TRIM(fi.estado)) IN ('RESERVADA', 'CONFIRMADA')
     ORDER BY fi.nro_factura`,
    [ppId, nro],
  );
  return rows.map((r) => Number(r.id));
}

/** IC emparejada 1:1 por fi.notas (fallback null si legacy sin notas). */
export async function resolveIcIdPorFiNotas(
  pool: Pool,
  ppId: number,
  fiId: number,
): Promise<number | null> {
  const { rows } = await pool.query<{ ic_id: string }>(
    `SELECT ic.id AS ic_id
     FROM factura_interna fi
     JOIN intencion_compra ic ON TRIM(ic.numero_registro) = TRIM(COALESCE(fi.notas, ''))
     JOIN intencion_compra_pedido icp
       ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
     WHERE fi.id = $1 AND fi.pp_id = $2
       AND TRIM(COALESCE(fi.notas, '')) <> ''
     LIMIT 1`,
    [fiId, ppId],
  );
  return rows[0] ? Number(rows[0].ic_id) : null;
}

export async function syncIcDesdeFiPatch(
  pool: Pool,
  ppId: number,
  fiId: number,
  patch: {
    listado_precio_id?: ListadoPrecioTierId;
    id_plazo?: number;
    descuento_1?: number;
    descuento_2?: number;
    descuento_3?: number;
    descuento_4?: number;
    precio_evento_id?: number | null;
    id_vendedor?: number;
  },
): Promise<boolean> {
  const icId = await resolveIcIdPorFiNotas(pool, ppId, fiId);
  if (!icId) return false;

  const icRow = await pool.query<{ monto_bruto: string }>(
    `SELECT COALESCE(monto_bruto, 0)::text AS monto_bruto FROM intencion_compra WHERE id = $1`,
    [icId],
  );
  const bruto = Number(icRow.rows[0]?.monto_bruto ?? 0);

  const sets: string[] = [];
  const vals: unknown[] = [icId];
  let i = 2;

  if (patch.listado_precio_id !== undefined && esListadoPrecioValido(patch.listado_precio_id)) {
    sets.push(`listado_precio_id = $${i++}`);
    vals.push(patch.listado_precio_id);
  }
  if (patch.id_plazo !== undefined) {
    sets.push(`id_plazo = $${i++}`);
    vals.push(patch.id_plazo);
  }
  if (patch.id_vendedor !== undefined) {
    sets.push(`id_vendedor = $${i++}`);
    vals.push(patch.id_vendedor);
  }
  if (patch.precio_evento_id !== undefined) {
    sets.push(`precio_evento_id = $${i++}`);
    vals.push(patch.precio_evento_id);
  }

  const d1 = patch.descuento_1;
  const d2 = patch.descuento_2;
  const d3 = patch.descuento_3;
  const d4 = patch.descuento_4;
  const descPatch =
    d1 !== undefined || d2 !== undefined || d3 !== undefined || d4 !== undefined;

  if (descPatch) {
    const cur = await pool.query<{
      descuento_1: string;
      descuento_2: string;
      descuento_3: string;
      descuento_4: string;
    }>(
      `SELECT COALESCE(descuento_1,0)::text AS descuento_1,
              COALESCE(descuento_2,0)::text AS descuento_2,
              COALESCE(descuento_3,0)::text AS descuento_3,
              COALESCE(descuento_4,0)::text AS descuento_4
       FROM intencion_compra WHERE id = $1`,
      [icId],
    );
    const c = cur.rows[0];
    const nd1 = d1 ?? Number(c?.descuento_1 ?? 0);
    const nd2 = d2 ?? Number(c?.descuento_2 ?? 0);
    const nd3 = d3 ?? Number(c?.descuento_3 ?? 0);
    const nd4 = d4 ?? Number(c?.descuento_4 ?? 0);
    sets.push(`descuento_1 = $${i++}`, `descuento_2 = $${i++}`, `descuento_3 = $${i++}`, `descuento_4 = $${i++}`);
    vals.push(nd1, nd2, nd3, nd4);
    sets.push(`monto_neto = $${i++}`);
    vals.push(calcularNeto(bruto, nd1, nd2, nd3, nd4));
  }

  if (sets.length) {
    await pool.query(`UPDATE intencion_compra SET ${sets.join(", ")} WHERE id = $1`, vals);
  }

  if (patch.precio_evento_id !== undefined) {
    await pool.query(
      `UPDATE intencion_compra_pedido SET precio_evento_id = $3
       WHERE pedido_proveedor_id = $1 AND intencion_compra_id = $2`,
      [ppId, icId, patch.precio_evento_id],
    );
  }

  return true;
}

/** Tras guardar IC en PP: propaga encabezado + LP a FI emparejada(s) por notas. PF = lectura IC. */
export async function propagarTrinidadDesdeIc(
  pool: Pool,
  ppId: number,
  icId: number,
  fields: UpdateIcVinculadaInput,
): Promise<TrinidadSyncResult | { ok: false; error: string }> {
  const icRes = await pool.query<{
    numero_registro: string;
    id_plazo: number | null;
    descuento_1: string;
    descuento_2: string;
    descuento_3: string;
    descuento_4: string;
    listado_precio_id: string | null;
  }>(
    `SELECT numero_registro, id_plazo,
            COALESCE(descuento_1, 0)::text AS descuento_1,
            COALESCE(descuento_2, 0)::text AS descuento_2,
            COALESCE(descuento_3, 0)::text AS descuento_3,
            COALESCE(descuento_4, 0)::text AS descuento_4,
            listado_precio_id::text
     FROM intencion_compra WHERE id = $1`,
    [icId],
  );
  const ic = icRes.rows[0];
  if (!ic?.numero_registro?.trim()) {
    return { ok: false, error: "IC sin numero_registro — no se puede emparejar FI." };
  }

  const fiIds = await listFiIdsPorIcEnPp(pool, ppId, ic.numero_registro);
  const avisos: string[] = [];

  if (fiIds.length === 0) {
    return { ok: true, fi_ids: [], avisos: [] };
  }

  const needsEnc =
    fields.id_plazo !== undefined
    || fields.descuento_1 !== undefined
    || fields.descuento_2 !== undefined
    || fields.descuento_3 !== undefined
    || fields.descuento_4 !== undefined;

  const plazoId = fields.id_plazo !== undefined ? fields.id_plazo : ic.id_plazo;
  const d1 = fields.descuento_1 !== undefined ? fields.descuento_1 : Number(ic.descuento_1);
  const d2 = fields.descuento_2 !== undefined ? fields.descuento_2 : Number(ic.descuento_2);
  const d3 = fields.descuento_3 !== undefined ? fields.descuento_3 : Number(ic.descuento_3);
  const d4 = fields.descuento_4 !== undefined ? fields.descuento_4 : Number(ic.descuento_4);

  const tierAfterIc =
    fields.listado_precio_id !== undefined && esListadoPrecioValido(fields.listado_precio_id)
      ? fields.listado_precio_id
      : esListadoPrecioValido(Number(ic.listado_precio_id))
        ? (Number(ic.listado_precio_id) as ListadoPrecioTierId)
        : null;

  for (const fiId of fiIds) {
    if (needsEnc && plazoId) {
      const enc = await actualizarEncabezadoFi(fiId, {
        plazoId,
        descuento_1: d1,
        descuento_2: d2,
        descuento_3: d3,
        descuento_4: d4,
      });
      if (!enc.ok) avisos.push(`FI #${fiId} · plazo/desc: ${enc.msg}`);
    }

    if (fields.listado_precio_id !== undefined && esListadoPrecioValido(fields.listado_precio_id)) {
      const lp = await actualizarListaPrecioFi(fiId, fields.listado_precio_id);
      if (!lp.ok) avisos.push(`FI #${fiId} · LP: ${lp.msg}`);
    } else if (needsEnc && tierAfterIc != null) {
      const lp = await actualizarListaPrecioFi(fiId, tierAfterIc);
      if (!lp.ok) avisos.push(`FI #${fiId} · recalc tier: ${lp.msg}`);
    }
  }

  return { ok: true, fi_ids: fiIds, avisos };
}
