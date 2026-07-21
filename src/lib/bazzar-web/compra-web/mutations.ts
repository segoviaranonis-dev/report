/**
 * procesar_ingreso_bazar — gemelo compra_legal/logic.py (transacción completa)
 */
import type { PoolClient } from "pg";
import { getRimecPool } from "@/lib/rimec/pool";
import { ALM_TRANSITO, ALM_WEB_BAZAR, CLIENTE_WEB_BAZAR_ID } from "./constants";
import { hydrateTraspasoDetalleFromSnapshot } from "./traspaso-detalle-hydrate";
import { aplicarStockSanoAlmacen } from "@/lib/bazzar-web/stock-sano/aplicar";

export type ProcesarIngresoResult = { ok: true; message: string } | { ok: false; error: string };

async function procesarIngresoBazarTx(client: PoolClient, idTrp: number): Promise<ProcesarIngresoResult> {
  const lock = await client.query<{ estado: string; numero_registro: string }>(
    `SELECT estado, numero_registro FROM traspaso WHERE id = $1 FOR UPDATE`,
    [idTrp],
  );

  if (!lock.rows.length) {
    return { ok: false, error: "Traspaso no encontrado." };
  }

  const { estado, numero_registro: trpNum } = lock.rows[0];
  if (estado !== "ENVIADO" && estado !== "BORRADOR") {
    return { ok: false, error: `Traspaso en estado '${estado}' — no se puede procesar.` };
  }

  const esWeb = await client.query<{ ok: number }>(
    `
    SELECT 1 AS ok FROM traspaso t
    WHERE t.id = $1
      AND (
        EXISTS (
          SELECT 1 FROM factura_interna fi
          WHERE fi.nro_factura = t.documento_ref
            AND fi.cliente_id = $2
        )
        OR EXISTS (
          SELECT 1 FROM venta_transito vt
          WHERE vt.numero_factura_interna = t.documento_ref
            AND TRIM(vt.codigo_cliente) = '5000'
        )
      )
    LIMIT 1
    `,
    [idTrp, CLIENTE_WEB_BAZAR_ID],
  );
  if (!esWeb.rows.length) {
    return {
      ok: false,
      error: `Traspaso no pertenece al cliente web (${CLIENTE_WEB_BAZAR_ID}). Solo mercadería canal e-commerce.`,
    };
  }

  await hydrateTraspasoDetalleFromSnapshot(client, idTrp);

  const mov = await client.query<{ id: number }>(
    `
    INSERT INTO movimiento (
      tipo, fecha,
      almacen_origen_id, almacen_destino_id,
      documento_ref, estado
    ) VALUES (
      'INGRESO_COMPRA', CURRENT_DATE,
      $1, $2, $3, 'CONFIRMADO'
    )
    RETURNING id
    `,
    [ALM_TRANSITO, ALM_WEB_BAZAR, trpNum],
  );

  const movId = mov.rows[0]?.id;
  if (!movId) {
    return { ok: false, error: "No se pudo crear el movimiento de ingreso." };
  }

  const lines = await client.query<{ combinacion_id: number; cantidad: number }>(
    `SELECT combinacion_id, cantidad FROM traspaso_detalle WHERE traspaso_id = $1`,
    [idTrp],
  );

  let nLines = 0;
  for (const line of lines.rows) {
    await client.query(
      `
      INSERT INTO movimiento_detalle (movimiento_id, combinacion_id, cantidad, signo)
      VALUES ($1, $2, $3, 1)
      `,
      [movId, line.combinacion_id, Math.trunc(Number(line.cantidad) || 0)],
    );
    nLines += 1;
  }

  await client.query(
    `
    UPDATE traspaso
    SET estado = 'CONFIRMADO', confirmado_en = NOW()
    WHERE id = $1
    `,
    [idTrp],
  );

  const stockSano = await aplicarStockSanoAlmacen(client, ALM_WEB_BAZAR);

  return {
    ok: true,
    message: `Ingreso procesado: ${nLines} línea(s) en depósito Web Bazar. Stock Sano: ${stockSano.depositos} tripletas · ${stockSano.precios} precios WEB.`,
  };
}

export async function procesarIngresoBazar(idTrp: number): Promise<ProcesarIngresoResult> {
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await procesarIngresoBazarTx(client, idTrp);
    if (!result.ok) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
