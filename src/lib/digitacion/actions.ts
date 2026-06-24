import type { Pool } from "pg";
import { getNextNumeroPp } from "./numeracion-pp";

export type AsignarIcInput = {
  ic_id: number;
  precio_evento_id: number;
  nro_pedido_fabrica: string;
  pedido_proveedor_id?: number | null;
  asignado_por?: number | null;
};

export async function crearPpDigitacion(pool: Pool): Promise<number> {
  const numero = await getNextNumeroPp(pool);
  const anio = new Date().getFullYear();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO pedido_proveedor (
      numero_registro, anio_fiscal, estado, estado_digitacion, pares_comprometidos
    ) VALUES ($1, $2, 'ABIERTO', 'ABIERTO', 0)
    RETURNING id`,
    [numero, anio],
  );
  return Number(rows[0].id);
}

export async function asignarIc(
  pool: Pool,
  input: AsignarIcInput,
): Promise<{ ok: true; pp_id: number; pp_numero: string } | { ok: false; error: string }> {
  const nroFab = input.nro_pedido_fabrica?.trim();
  if (!nroFab) return { ok: false, error: "Nro. pedido fábrica obligatorio." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const icRes = await client.query<{
      id: string;
      id_proveedor: string;
      categoria_id: string | null;
      pares: string;
      estado: string;
      quincena_arribo_id: string | null;
    }>(
      `SELECT id, id_proveedor, categoria_id, cantidad_total_pares AS pares, estado,
              quincena_arribo_id
       FROM intencion_compra WHERE id = $1 FOR UPDATE`,
      [input.ic_id],
    );
    const ic = icRes.rows[0];
    if (!ic || ic.estado !== "AUTORIZADO") {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC no está AUTORIZADA." };
    }

    const exists = await client.query(
      `SELECT 1 FROM intencion_compra_pedido WHERE intencion_compra_id = $1`,
      [input.ic_id],
    );
    if (exists.rowCount) {
      await client.query("ROLLBACK");
      return { ok: false, error: "IC ya tiene puente PP." };
    }

    let ppId = input.pedido_proveedor_id ?? null;
    const quincenaId = ic.quincena_arribo_id ? Number(ic.quincena_arribo_id) : null;
    if (!ppId) {
      const numero = await getNextNumeroPp(pool);
      const anio = new Date().getFullYear();
      const ins = await client.query<{ id: string; numero_registro: string }>(
        `INSERT INTO pedido_proveedor (
          numero_registro, anio_fiscal, estado, estado_digitacion,
          proveedor_importacion_id, categoria_id, pares_comprometidos, quincena_arribo_id
        ) VALUES ($1, $2, 'ABIERTO', 'ABIERTO', $3, $4, 0, $5)
        RETURNING id, numero_registro`,
        [numero, anio, Number(ic.id_proveedor), ic.categoria_id ? Number(ic.categoria_id) : null, quincenaId],
      );
      ppId = Number(ins.rows[0].id);
    } else {
      const ppCheck = await client.query(`SELECT id FROM pedido_proveedor WHERE id = $1 AND estado = 'ABIERTO'`, [
        ppId,
      ]);
      if (!ppCheck.rowCount) {
        await client.query("ROLLBACK");
        return { ok: false, error: "PP destino no existe o no está ABIERTO." };
      }
    }

    await client.query(
      `INSERT INTO intencion_compra_pedido (
        intencion_compra_id, pedido_proveedor_id, nro_pedido_fabrica, precio_evento_id, asignado_por
      ) VALUES ($1, $2, $3, $4, $5)`,
      [input.ic_id, ppId, nroFab, input.precio_evento_id, input.asignado_por ?? null],
    );

    await client.query(
      `UPDATE intencion_compra SET estado = 'DIGITADO', precio_evento_id = $2 WHERE id = $1`,
      [input.ic_id, input.precio_evento_id],
    );

    const pares = Number(ic.pares ?? 0);
    await client.query(
      `UPDATE pedido_proveedor SET
         pares_comprometidos = COALESCE(pares_comprometidos, 0) + $2,
         proveedor_importacion_id = COALESCE(proveedor_importacion_id, $3),
         categoria_id = COALESCE(categoria_id, $4),
         quincena_arribo_id = COALESCE(quincena_arribo_id, $5)
       WHERE id = $1`,
      [ppId, pares, Number(ic.id_proveedor), ic.categoria_id ? Number(ic.categoria_id) : null, quincenaId],
    );

    const ppNum = await client.query<{ numero_registro: string }>(
      `SELECT numero_registro FROM pedido_proveedor WHERE id = $1`,
      [ppId],
    );

    await client.query("COMMIT");
    return { ok: true, pp_id: ppId!, pp_numero: ppNum.rows[0]?.numero_registro ?? "" };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al asignar" };
  } finally {
    client.release();
  }
}

export async function cerrarPp(
  pool: Pool,
  ppId: number,
  nroFacturaImportacion: string,
): Promise<{ ok: boolean; error?: string }> {
  const nro = nroFacturaImportacion?.trim();
  if (!nro) return { ok: false, error: "Nro. factura importación obligatorio." };

  const { rowCount } = await pool.query(
    `UPDATE pedido_proveedor SET estado_digitacion = 'CERRADO', nro_factura_importacion = $2
     WHERE id = $1 AND estado IN ('ABIERTO', 'CERRADO')`,
    [ppId, nro],
  );
  if (!rowCount) return { ok: false, error: "PP no encontrado." };
  return { ok: true };
}

export async function devolverIc(
  pool: Pool,
  icId: number,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const m = motivo?.trim();
  if (!m) return { ok: false, error: "Motivo de devolución obligatorio." };

  const { rowCount } = await pool.query(
    `UPDATE intencion_compra SET estado = 'DEVUELTO_ADMIN', motivo_devolucion = $2, devuelto_at = NOW()
     WHERE id = $1 AND estado = 'AUTORIZADO'`,
    [icId, m],
  );
  if (!rowCount) return { ok: false, error: "IC no está AUTORIZADA." };
  return { ok: true };
}
