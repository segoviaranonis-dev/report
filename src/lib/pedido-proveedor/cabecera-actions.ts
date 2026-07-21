import type { Pool, PoolClient } from "pg";
import { calcularNeto } from "@/lib/intencion-compra/calcular-neto";
import { getNextNumeroRegistro } from "@/lib/intencion-compra/numeracion";
import { quincenaDbValue } from "@/lib/intencion-compra/quincena-arribo";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";
import { formatNumeroPreventaCarlos } from "./dato-duro-cabecera";

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
      const ext = fields.nro_pedido_externo?.trim();
      const normalizado = ext ? formatNumeroPreventaCarlos(ext) : null;
      sets.push(`nro_pedido_externo = $${i++}`);
      vals.push(normalizado);
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

    if (fields.quincena_arribo_id !== undefined) {
      const qid = quincenaDbValue(fields.quincena_arribo_id ?? 0);
      if (qid != null) {
        await client.query(
          `
          UPDATE intencion_compra ic
          SET quincena_arribo_id = $2
          FROM intencion_compra_pedido icp
          WHERE icp.intencion_compra_id = ic.id
            AND icp.pedido_proveedor_id = $1
        `,
          [ppId, qid],
        );
      }
    }

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
  listado_precio_id?: number | null;
  monto_bruto?: number;
  id_plazo?: number | null;
  descuento_1?: number;
  descuento_2?: number;
  descuento_3?: number;
  descuento_4?: number;
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
  if (fields.monto_bruto !== undefined && (!Number.isFinite(fields.monto_bruto) || fields.monto_bruto < 0)) {
    return { ok: false, error: "Monto bruto inválido." };
  }
  for (const key of ["descuento_1", "descuento_2", "descuento_3", "descuento_4"] as const) {
    if (fields[key] !== undefined) {
      const v = Number(fields[key]);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        return { ok: false, error: `${key} debe estar entre 0 y 100.` };
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const err = await assertPpEditable(client, ppId);
    if (err) {
      await client.query("ROLLBACK");
      return { ok: false, error: err };
    }

    const link = await client.query<{
      pares: string;
      monto_bruto: string;
      descuento_1: string;
      descuento_2: string;
      descuento_3: string;
      descuento_4: string;
    }>(
      `SELECT ic.cantidad_total_pares::text AS pares,
              COALESCE(ic.monto_bruto, 0)::text AS monto_bruto,
              COALESCE(ic.descuento_1, 0)::text AS descuento_1,
              COALESCE(ic.descuento_2, 0)::text AS descuento_2,
              COALESCE(ic.descuento_3, 0)::text AS descuento_3,
              COALESCE(ic.descuento_4, 0)::text AS descuento_4
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
    if (fields.listado_precio_id !== undefined && fields.listado_precio_id != null && !esListadoPrecioValido(fields.listado_precio_id)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Política LP inválida (use 1–4)." };
    }
    if (fields.id_plazo !== undefined && fields.id_plazo != null) {
      const pl = await client.query(`SELECT 1 FROM plazo_v2 WHERE id_plazo = $1`, [fields.id_plazo]);
      if (!pl.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Plazo inválido." };
      }
    }

    const d1 =
      fields.descuento_1 !== undefined
        ? Number(fields.descuento_1)
        : Number(link.rows[0]?.descuento_1 ?? 0);
    const d2 =
      fields.descuento_2 !== undefined
        ? Number(fields.descuento_2)
        : Number(link.rows[0]?.descuento_2 ?? 0);
    const d3 =
      fields.descuento_3 !== undefined
        ? Number(fields.descuento_3)
        : Number(link.rows[0]?.descuento_3 ?? 0);
    const d4 =
      fields.descuento_4 !== undefined
        ? Number(fields.descuento_4)
        : Number(link.rows[0]?.descuento_4 ?? 0);

    const descChanged =
      fields.descuento_1 !== undefined ||
      fields.descuento_2 !== undefined ||
      fields.descuento_3 !== undefined ||
      fields.descuento_4 !== undefined;

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
    if (fields.listado_precio_id !== undefined) {
      icSets.push(`listado_precio_id = $${i++}`);
      icVals.push(fields.listado_precio_id);
    }
    if (fields.monto_bruto !== undefined || descChanged) {
      const bruto = Math.round(
        Math.max(
          0,
          fields.monto_bruto !== undefined
            ? fields.monto_bruto
            : Number(link.rows[0]?.monto_bruto ?? 0),
        ),
      );
      const neto = calcularNeto(bruto, d1, d2, d3, d4);
      if (fields.monto_bruto !== undefined) {
        icSets.push(`monto_bruto = $${i++}`);
        icVals.push(bruto);
      }
      if (descChanged) {
        icSets.push(`descuento_1 = $${i++}`);
        icVals.push(d1);
        icSets.push(`descuento_2 = $${i++}`);
        icVals.push(d2);
        icSets.push(`descuento_3 = $${i++}`);
        icVals.push(d3);
        icSets.push(`descuento_4 = $${i++}`);
        icVals.push(d4);
      }
      icSets.push(`monto_neto = $${i++}`);
      icVals.push(neto);
    }
    if (fields.id_plazo !== undefined) {
      icSets.push(`id_plazo = $${i++}`);
      icVals.push(fields.id_plazo);
    }

    if (icSets.length) {
      await client.query(`UPDATE intencion_compra SET ${icSets.join(", ")} WHERE id = $1`, icVals);
    }

    if (fields.listado_precio_id !== undefined && esListadoPrecioValido(fields.listado_precio_id)) {
      await client.query(
        `UPDATE factura_interna fi
         SET lista_precio_id = $3
         FROM intencion_compra ic
         WHERE fi.pp_id = $1
           AND fi.cliente_id = ic.id_cliente
           AND ic.id = $2
           AND fi.estado IN ('RESERVADA', 'CONFIRMADA')`,
        [ppId, icId, fields.listado_precio_id],
      );
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

/** Clona IC vinculada al PP con N pares (negociación / split prefactura). */
export async function duplicarIcEnPp(
  pool: Pool,
  ppId: number,
  icId: number,
  paresNueva: number,
  idClienteOverride?: number,
  opts?: { ajustarComprometidos?: boolean },
): Promise<{ ok: true; new_ic_id: number; nro_ic: string } | { ok: false; error: string }> {
  if (paresNueva <= 0) return { ok: false, error: "Pares de la nueva IC debe ser > 0." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const err = await assertPpEditable(client, ppId);
    if (err) {
      await client.query("ROLLBACK");
      return { ok: false, error: err };
    }

    const { rows } = await client.query<{
      numero_registro: string;
      pares: string;
      id_proveedor: number;
      id_cliente: number;
      id_vendedor: number;
      id_marca: number;
      id_plazo: number | null;
      tipo_id: number;
      categoria_id: number;
      monto_bruto: string;
      descuento_1: string;
      descuento_2: string;
      descuento_3: string;
      descuento_4: string;
      fecha_registro: string;
      quincena_arribo_id: number | null;
      nota_pedido: string | null;
      observaciones: string | null;
      precio_evento_id: number | null;
      listado_precio_id: number | null;
      nro_pedido_fabrica: string | null;
      asignado_por: number | null;
    }>(
      `SELECT ic.numero_registro, ic.cantidad_total_pares::text AS pares,
              ic.id_proveedor, ic.id_cliente, ic.id_vendedor, ic.id_marca, ic.id_plazo,
              ic.tipo_id, ic.categoria_id, COALESCE(ic.monto_bruto,0)::text AS monto_bruto,
              COALESCE(ic.descuento_1,0)::text AS descuento_1,
              COALESCE(ic.descuento_2,0)::text AS descuento_2,
              COALESCE(ic.descuento_3,0)::text AS descuento_3,
              COALESCE(ic.descuento_4,0)::text AS descuento_4,
              ic.fecha_registro::text, ic.quincena_arribo_id,
              ic.nota_pedido, ic.observaciones, ic.precio_evento_id, ic.listado_precio_id,
              icp.nro_pedido_fabrica, icp.asignado_por
       FROM intencion_compra ic
       JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
       WHERE ic.id = $1 AND icp.pedido_proveedor_id = $2
       FOR UPDATE OF ic`,
      [icId, ppId],
    );
    const src = rows[0];
    if (!src) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC no vinculada a este PP." };
    }

    const paresOrig = Number(src.pares ?? 0);
    const brutoOrig = Number(src.monto_bruto ?? 0);
    const brutoNuevo =
      paresOrig > 0 ? Math.round((brutoOrig * paresNueva) / paresOrig) : brutoOrig;
    const d1 = Number(src.descuento_1);
    const d2 = Number(src.descuento_2);
    const d3 = Number(src.descuento_3);
    const d4 = Number(src.descuento_4);
    const neto = calcularNeto(brutoNuevo, d1, d2, d3, d4);
    const numero = await getNextNumeroRegistro(pool);
    const idCliente = idClienteOverride ?? src.id_cliente;

    const ins = await client.query<{ id: string }>(
      `INSERT INTO intencion_compra (
        numero_registro, id_proveedor, id_cliente, id_vendedor, id_marca, id_plazo,
        tipo_id, categoria_id, cantidad_total_pares,
        monto_bruto, descuento_1, descuento_2, descuento_3, descuento_4,
        monto_neto, fecha_registro, quincena_arribo_id,
        estado, nota_pedido, observaciones, precio_evento_id, listado_precio_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        'DIGITADO',$18,$19,$20,$21
      ) RETURNING id`,
      [
        numero,
        src.id_proveedor,
        idCliente,
        src.id_vendedor,
        src.id_marca,
        src.id_plazo,
        src.tipo_id,
        src.categoria_id,
        paresNueva,
        brutoNuevo,
        d1,
        d2,
        d3,
        d4,
        neto,
        src.fecha_registro,
        src.quincena_arribo_id,
        src.nota_pedido,
        src.observaciones,
        src.precio_evento_id,
        src.listado_precio_id,
      ],
    );
    const newId = Number(ins.rows[0].id);

    await client.query(
      `INSERT INTO intencion_compra_pedido (
        intencion_compra_id, pedido_proveedor_id, nro_pedido_fabrica, precio_evento_id, asignado_por
      ) VALUES ($1, $2, $3, $4, $5)`,
      [newId, ppId, src.nro_pedido_fabrica, src.precio_evento_id, src.asignado_por],
    );

    if (opts?.ajustarComprometidos !== false) {
      await client.query(
        `UPDATE pedido_proveedor SET pares_comprometidos = COALESCE(pares_comprometidos, 0) + $2 WHERE id = $1`,
        [ppId, paresNueva],
      );
    }

    await client.query("COMMIT");
    return { ok: true, new_ic_id: newId, nro_ic: numero };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al duplicar IC" };
  } finally {
    client.release();
  }
}

/** Reduce IC origen y crea IC hija con pares separados (split prefactura). */
export async function splitIcParesEnPp(
  pool: Pool,
  ppId: number,
  icId: number,
  paresHija: number,
  idClienteDestino?: number,
): Promise<
  | { ok: true; ic_origen_id: number; ic_nueva_id: number; nro_ic_nueva: string }
  | { ok: false; error: string }
> {
  const { rows } = await pool.query<{ pares: string; monto_bruto: string }>(
    `SELECT ic.cantidad_total_pares::text AS pares, COALESCE(ic.monto_bruto,0)::text AS monto_bruto
     FROM intencion_compra ic
     JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
     WHERE ic.id = $1 AND icp.pedido_proveedor_id = $2`,
    [icId, ppId],
  );
  const total = Number(rows[0]?.pares ?? 0);
  const brutoOrig = Number(rows[0]?.monto_bruto ?? 0);
  if (paresHija <= 0 || paresHija >= total) {
    return { ok: false, error: `Pares a separar inválido (IC tiene ${total}).` };
  }

  const dup = await duplicarIcEnPp(pool, ppId, icId, paresHija, idClienteDestino, {
    ajustarComprometidos: false,
  });
  if (!dup.ok) return dup;

  const paresResto = total - paresHija;
  const brutoResto = total > 0 ? Math.round((brutoOrig * paresResto) / total) : brutoOrig;
  const upd = await updateIcVinculadaPp(pool, ppId, icId, {
    cantidad_total_pares: paresResto,
    monto_bruto: brutoResto,
  });
  if (!upd.ok) return upd;

  return {
    ok: true,
    ic_origen_id: icId,
    ic_nueva_id: dup.new_ic_id,
    nro_ic_nueva: dup.nro_ic,
  };
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
