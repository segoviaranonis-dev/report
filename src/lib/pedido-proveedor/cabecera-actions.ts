import type { Pool, PoolClient } from "pg";
import { quincenaDbValue } from "@/lib/intencion-compra/quincena-arribo";

export function ppCabeceraEditable(estado: string): boolean {
  return estado !== "ENVIADO" && estado !== "ANULADO";
}

/** PRE VENTA (id=2) → etiqueta gerencial COMPRA PREVIA */
export function formatCategoriaPp(categoriaId: number | null, descp: string | null): string {
  if (categoriaId === 2) return "COMPRA PREVIA";
  if (categoriaId === 3) return "PROGRAMADO";
  const u = (descp ?? "").trim().toUpperCase();
  if (u.includes("PRE")) return "COMPRA PREVIA";
  if (u.includes("PROGRAM")) return "PROGRAMADO";
  return descp?.trim() || "—";
}

export async function patchPpCabecera(
  pool: Pool,
  ppId: number,
  fields: {
    numero_proforma?: string | null;
    notas?: string | null;
    nro_pedido_externo?: string | null;
    quincena_arribo_id?: number | null;
    descuento_1?: number;
    descuento_2?: number;
    descuento_3?: number;
    descuento_4?: number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pp = await client.query<{ estado: string }>(
      `SELECT estado FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    const row = pp.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }
    if (!ppCabeceraEditable(row.estado)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP ENVIADO o ANULADO — cabecera bloqueada." };
    }

    const sets: string[] = [];
    const vals: unknown[] = [ppId];
    let i = 2;

    if (fields.numero_proforma !== undefined) {
      const pf = fields.numero_proforma?.trim() || null;
      sets.push(`numero_proforma = $${i++}`);
      vals.push(pf);
    }
    if (fields.notas !== undefined) {
      const n = fields.notas?.trim() || null;
      sets.push(`notas = $${i++}`);
      vals.push(n);
    }
    if (fields.nro_pedido_externo !== undefined) {
      sets.push(`nro_pedido_externo = $${i++}`);
      vals.push(fields.nro_pedido_externo?.trim() || null);
    }
    if (fields.quincena_arribo_id !== undefined) {
      const q = quincenaDbValue(fields.quincena_arribo_id ?? 0);
      if (q == null) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Quincena de arribo obligatoria (1–24)." };
      }
      sets.push(`quincena_arribo_id = $${i++}`);
      vals.push(q);
    }
    for (const [key, col] of [
      ["descuento_1", "descuento_1"],
      ["descuento_2", "descuento_2"],
      ["descuento_3", "descuento_3"],
      ["descuento_4", "descuento_4"],
    ] as const) {
      const v = fields[key];
      if (v !== undefined) {
        sets.push(`${col} = $${i++}`);
        vals.push(Math.max(0, Math.min(100, Number(v) || 0)));
      }
    }

    if (!sets.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Sin campos para actualizar." };
    }

    await client.query(`UPDATE pedido_proveedor SET ${sets.join(", ")} WHERE id = $1`, vals);
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al guardar cabecera" };
  } finally {
    client.release();
  }
}

export type UpdateIcVinculadaInput = {
  nro_pedido_fabrica?: string;
  cantidad_total_pares?: number;
  id_marca?: number;
  id_vendedor?: number;
  id_proveedor?: number;
  categoria_id?: number | null;
  precio_evento_id?: number | null;
};

export async function updateIcVinculadaPp(
  pool: Pool,
  ppId: number,
  icId: number,
  fields: UpdateIcVinculadaInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nroFab = fields.nro_pedido_fabrica?.trim();
  if (fields.nro_pedido_fabrica !== undefined && !nroFab) {
    return { ok: false, error: "Nro. pedido fábrica obligatorio." };
  }
  if (fields.cantidad_total_pares !== undefined && fields.cantidad_total_pares <= 0) {
    return { ok: false, error: "Pares debe ser mayor a 0." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const err = await assertPpEditable(client, ppId);
    if (err) {
      await client.query("ROLLBACK");
      return { ok: false, error: err };
    }

    const link = await client.query<{ pares: string }>(
      `SELECT ic.cantidad_total_pares::text AS pares
       FROM intencion_compra ic
       JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
       WHERE ic.id = $1 AND icp.pedido_proveedor_id = $2
       FOR UPDATE OF ic`,
      [icId, ppId],
    );
    if (!link.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC no vinculada a este PP." };
    }
    const paresAntes = Number(link.rows[0].pares ?? 0);

    if (fields.id_marca !== undefined) {
      const m = await client.query(`SELECT 1 FROM marca_v2 WHERE id_marca = $1`, [fields.id_marca]);
      if (!m.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Marca inválida." };
      }
    }
    if (fields.id_vendedor !== undefined) {
      const v = await client.query(`SELECT 1 FROM vendedor_v2 WHERE id_vendedor = $1`, [fields.id_vendedor]);
      if (!v.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Vendedor inválido." };
      }
    }
    if (fields.id_proveedor !== undefined) {
      const p = await client.query(`SELECT 1 FROM proveedor_importacion WHERE id = $1`, [fields.id_proveedor]);
      if (!p.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Proveedor inválido." };
      }
    }
    if (fields.categoria_id != null && fields.categoria_id !== undefined) {
      const c = await client.query(`SELECT 1 FROM categoria_v2 WHERE id_categoria = $1`, [fields.categoria_id]);
      if (!c.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Categoría inválida." };
      }
    }
    if (fields.precio_evento_id != null && fields.precio_evento_id !== undefined) {
      const e = await client.query(`SELECT 1 FROM precio_evento WHERE id = $1`, [fields.precio_evento_id]);
      if (!e.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Evento de precio inválido." };
      }
    }

    const icSets: string[] = [];
    const icVals: unknown[] = [icId];
    let i = 2;

    if (fields.cantidad_total_pares !== undefined) {
      icSets.push(`cantidad_total_pares = $${i++}`);
      icVals.push(fields.cantidad_total_pares);
    }
    if (fields.id_marca !== undefined) {
      icSets.push(`id_marca = $${i++}`);
      icVals.push(fields.id_marca);
    }
    if (fields.id_vendedor !== undefined) {
      icSets.push(`id_vendedor = $${i++}`);
      icVals.push(fields.id_vendedor);
    }
    if (fields.id_proveedor !== undefined) {
      icSets.push(`id_proveedor = $${i++}`);
      icVals.push(fields.id_proveedor);
    }
    if (fields.categoria_id !== undefined) {
      icSets.push(`categoria_id = $${i++}`);
      icVals.push(fields.categoria_id);
    }
    if (fields.precio_evento_id !== undefined) {
      icSets.push(`precio_evento_id = $${i++}`);
      icVals.push(fields.precio_evento_id);
    }

    if (icSets.length) {
      await client.query(`UPDATE intencion_compra SET ${icSets.join(", ")} WHERE id = $1`, icVals);
    }

    const icpSets: string[] = [];
    const icpVals: unknown[] = [ppId, icId];
    let j = 3;
    if (fields.nro_pedido_fabrica !== undefined) {
      icpSets.push(`nro_pedido_fabrica = $${j++}`);
      icpVals.push(nroFab);
    }
    if (fields.precio_evento_id !== undefined) {
      icpSets.push(`precio_evento_id = $${j++}`);
      icpVals.push(fields.precio_evento_id);
    }
    if (icpSets.length) {
      await client.query(
        `UPDATE intencion_compra_pedido SET ${icpSets.join(", ")}
         WHERE pedido_proveedor_id = $1 AND intencion_compra_id = $2`,
        icpVals,
      );
    }

    if (fields.cantidad_total_pares !== undefined) {
      const delta = fields.cantidad_total_pares - paresAntes;
      if (delta !== 0) {
        await client.query(
          `UPDATE pedido_proveedor
           SET pares_comprometidos = GREATEST(COALESCE(pares_comprometidos, 0) + $2, 0)
           WHERE id = $1`,
          [ppId, delta],
        );
      }
    }

    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar IC" };
  } finally {
    client.release();
  }
}

/** @deprecated usar updateIcVinculadaPp */
export async function updateIcPuenteNroFabrica(
  pool: Pool,
  ppId: number,
  icId: number,
  nroPedidoFabrica: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateIcVinculadaPp(pool, ppId, icId, { nro_pedido_fabrica: nroPedidoFabrica });
}

/** Paridad Streamlit `desasignar_ic_de_pp` — IC vuelve a AUTORIZADO en pool Digitación. */
export async function desasignarIcDePp(
  pool: Pool,
  ppId: number,
  icId: number,
): Promise<{ ok: true; nro_ic: string; pares: number } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const err = await assertPpEditable(client, ppId);
    if (err) {
      await client.query("ROLLBACK");
      return { ok: false, error: err };
    }

    const icRes = await client.query<{ numero_registro: string; pares: string }>(
      `SELECT ic.numero_registro, ic.cantidad_total_pares::text AS pares
       FROM intencion_compra ic
       JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
       WHERE ic.id = $1 AND icp.pedido_proveedor_id = $2
       FOR UPDATE OF ic`,
      [icId, ppId],
    );
    const ic = icRes.rows[0];
    if (!ic) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC no vinculada a este PP." };
    }

    await client.query(
      `DELETE FROM intencion_compra_pedido
       WHERE intencion_compra_id = $1 AND pedido_proveedor_id = $2`,
      [icId, ppId],
    );

    await client.query(
      `UPDATE intencion_compra SET estado = 'AUTORIZADO' WHERE id = $1`,
      [icId],
    );

    const pares = Number(ic.pares ?? 0);
    if (pares > 0) {
      await client.query(
        `UPDATE pedido_proveedor
         SET pares_comprometidos = GREATEST(COALESCE(pares_comprometidos, 0) - $2, 0)
         WHERE id = $1`,
        [ppId, pares],
      );
    }

    await client.query("COMMIT");
    return { ok: true, nro_ic: ic.numero_registro, pares };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al desasignar IC" };
  } finally {
    client.release();
  }
}

async function assertPpEditable(client: PoolClient, ppId: number): Promise<string | null> {
  const { rows } = await client.query<{ estado: string }>(
    `SELECT estado FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
    [ppId],
  );
  if (!rows[0]) return "PP no encontrado.";
  if (!ppCabeceraEditable(rows[0].estado)) return "PP ENVIADO o ANULADO — edición bloqueada.";
  return null;
}
