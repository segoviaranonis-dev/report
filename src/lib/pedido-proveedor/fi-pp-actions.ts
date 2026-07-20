import type { Pool } from "pg";
import { actualizarEncabezadoFi, actualizarListaPrecioFi } from "@/app/aprobaciones/lib/aprobaciones-mutations";
import { calcularNeto } from "@/lib/intencion-compra/calcular-neto";
import { esListadoPrecioValido } from "@/lib/intencion-compra/listado-precio-tiers";

/** Rellena plazo/LP/descuentos FI desde IC vinculada (SHOP = id_cliente). */
export async function syncFiEncabezadoDesdeIc(pool: Pool, ppId: number): Promise<void> {
  await pool.query(
    `UPDATE factura_interna fi
     SET plazo_id = ic.id_plazo
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = fi.pp_id
       AND ic.id_cliente = fi.cliente_id
       AND fi.pp_id = $1
       AND fi.plazo_id IS NULL
       AND ic.id_plazo IS NOT NULL`,
    [ppId],
  );
  await pool.query(
    `UPDATE factura_interna fi
     SET lista_precio_id = ic.listado_precio_id
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = fi.pp_id
       AND ic.id_cliente = fi.cliente_id
       AND fi.pp_id = $1
       AND ic.listado_precio_id IS NOT NULL
       AND (fi.lista_precio_id IS NULL OR fi.lista_precio_id = 1)
       AND ic.listado_precio_id <> COALESCE(fi.lista_precio_id, 0)`,
    [ppId],
  );
}

export async function actualizarListaPrecioFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  listaPrecioId: number,
): Promise<{ ok: true; totalMonto?: number } | { ok: false; error: string }> {
  if (!esListadoPrecioValido(listaPrecioId)) {
    return { ok: false, error: "Política LP inválida (1–4)." };
  }

  const link = await pool.query<{ id: string }>(
    `SELECT fi.id FROM factura_interna fi WHERE fi.id = $1 AND fi.pp_id = $2`,
    [fiId, ppId],
  );
  if (!link.rowCount) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const result = await actualizarListaPrecioFi(fiId, listaPrecioId);
  if (!result.ok) {
    return { ok: false, error: result.msg };
  }

  await pool.query(
    `UPDATE intencion_compra ic
     SET listado_precio_id = $3
     FROM intencion_compra_pedido icp
     JOIN factura_interna fi ON fi.pp_id = icp.pedido_proveedor_id AND fi.cliente_id = ic.id_cliente
     WHERE ic.id = icp.intencion_compra_id
       AND icp.pedido_proveedor_id = $1
       AND fi.id = $2`,
    [ppId, fiId, listaPrecioId],
  );

  return { ok: true, totalMonto: result.totalMonto };
}

export async function actualizarVendedorFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  vendedorId: number,
): Promise<{ ok: true; vendedor: string } | { ok: false; error: string }> {
  if (!Number.isFinite(vendedorId) || vendedorId <= 0) {
    return { ok: false, error: "Vendedor inválido." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ppRes = await client.query<{ estado: string }>(
      `SELECT estado FROM pedido_proveedor WHERE id = $1 FOR UPDATE`,
      [ppId],
    );
    if (!ppRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP no encontrado." };
    }
    if (ppRes.rows[0].estado === "ENVIADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "PP ENVIADO — FI en solo lectura." };
    }

    const vendRes = await client.query<{ descp_vendedor: string }>(
      `SELECT descp_vendedor FROM vendedor_v2 WHERE id_vendedor = $1`,
      [vendedorId],
    );
    if (!vendRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Vendedor no existe en vendedor_v2." };
    }

    const fiRes = await client.query<{ cliente_id: number | null; estado: string }>(
      `SELECT cliente_id, estado FROM factura_interna WHERE id = $1 AND pp_id = $2 FOR UPDATE`,
      [fiId, ppId],
    );
    if (!fiRes.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no pertenece a este PP." };
    }
    if (!["RESERVADA", "CONFIRMADA"].includes(fiRes.rows[0].estado)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "FI no editable en este estado." };
    }

    await client.query(`UPDATE factura_interna SET vendedor_id = $2 WHERE id = $1`, [fiId, vendedorId]);

    if (fiRes.rows[0].cliente_id != null) {
      await client.query(
        `UPDATE intencion_compra ic SET id_vendedor = $3
         FROM intencion_compra_pedido icp
         WHERE ic.id = icp.intencion_compra_id
           AND icp.pedido_proveedor_id = $1
           AND ic.id_cliente = $2`,
        [ppId, fiRes.rows[0].cliente_id, vendedorId],
      );
    }

    await client.query(
      `UPDATE logistica_pendiente_confirmacion SET id_vendedor = $2, updated_at = now()
       WHERE factura_interna_id = $1 AND estado = 'PENDIENTE'`,
      [fiId, vendedorId],
    );

    await client.query("COMMIT");
    return { ok: true, vendedor: vendRes.rows[0].descp_vendedor };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar vendedor" };
  } finally {
    client.release();
  }
}

export type EncabezadoFiPpInput = {
  plazoId: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
};

/** Plazo + descuentos FI desde PP — recalcula líneas + sincroniza IC vinculada. */
export async function actualizarEncabezadoFiDesdePp(
  pool: Pool,
  ppId: number,
  fiId: number,
  input: EncabezadoFiPpInput,
): Promise<{ ok: true; totalMonto: number } | { ok: false; error: string }> {
  const link = await pool.query<{ cliente_id: number | null }>(
    `SELECT cliente_id FROM factura_interna WHERE id = $1 AND pp_id = $2`,
    [fiId, ppId],
  );
  if (!link.rows[0]) {
    return { ok: false, error: "FI no pertenece a este PP." };
  }

  const result = await actualizarEncabezadoFi(fiId, input);
  if (!result.ok) {
    return { ok: false, error: result.msg };
  }

  const clienteId = link.rows[0].cliente_id;
  if (clienteId != null) {
    const icRows = await pool.query<{ id: number; monto_bruto: number }>(
      `SELECT ic.id, COALESCE(ic.monto_bruto, 0)::float AS monto_bruto
       FROM intencion_compra_pedido icp
       JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
       WHERE icp.pedido_proveedor_id = $1 AND ic.id_cliente = $2`,
      [ppId, clienteId],
    );
    for (const ic of icRows.rows) {
      const neto = calcularNeto(
        ic.monto_bruto,
        input.descuento_1,
        input.descuento_2,
        input.descuento_3,
        input.descuento_4,
      );
      await pool.query(
        `UPDATE intencion_compra
         SET id_plazo = $2,
             descuento_1 = $3, descuento_2 = $4, descuento_3 = $5, descuento_4 = $6,
             monto_neto = $7
         WHERE id = $1`,
        [
          ic.id,
          input.plazoId,
          input.descuento_1,
          input.descuento_2,
          input.descuento_3,
          input.descuento_4,
          neto,
        ],
      );
    }
  }

  return { ok: true, totalMonto: result.totalMonto ?? 0 };
}
