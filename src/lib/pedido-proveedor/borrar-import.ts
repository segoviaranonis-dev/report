import type { Pool } from "pg";
import { runProformaBorrarPython } from "./run-python-pp";

export type BorrarImportEstado = {
  n_articulos: number;
  pares_total: number;
  vendido: number;
  n_facturas: number;
  puede_borrar: boolean;
  motivo: string;
  web_alzado: boolean;
};

export async function getEstadoBorradoImportPp(pool: Pool, ppId: number): Promise<BorrarImportEstado> {
  const { rows } = await pool.query<{
    n_articulos: string;
    pares_total: string;
    vendido_ppd: string;
    vendido_vt: string;
    n_facturas: string;
    fi_confirmadas: string;
    estado_transito: string | null;
  }>(
    `
    SELECT
      COUNT(ppd.id)::text AS n_articulos,
      COALESCE(SUM(ppd.cantidad_pares), 0)::text AS pares_total,
      COALESCE(SUM(ppd.pares_vendidos), 0)::text AS vendido_ppd,
      COALESCE((
        SELECT SUM(vt.cantidad_vendida)::text
        FROM venta_transito vt
        JOIN pedido_proveedor_detalle d ON d.id = vt.pedido_proveedor_detalle_id
        WHERE d.pedido_proveedor_id = $1
      ), '0') AS vendido_vt,
      (SELECT COUNT(*)::text FROM factura_interna fi WHERE fi.pp_id = $1) AS n_facturas,
      (SELECT COUNT(*)::text FROM factura_interna fi
       WHERE fi.pp_id = $1 AND UPPER(TRIM(fi.estado)) = 'CONFIRMADA') AS fi_confirmadas,
      pp.estado_transito
    FROM pedido_proveedor pp
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.pedido_proveedor_id = pp.id
    WHERE pp.id = $1
    GROUP BY pp.estado_transito
    `,
    [ppId],
  );

  const r = rows[0];
  if (!r || Number(r.n_articulos) === 0) {
    return {
      n_articulos: 0,
      pares_total: 0,
      vendido: 0,
      n_facturas: 0,
      puede_borrar: false,
      motivo: "No hay importación cargada.",
      web_alzado: r?.estado_transito === "EN_TRANSITO",
    };
  }

  const vendidoVt = Number(r.vendido_vt ?? 0);
  const vendidoPpd = Number(r.vendido_ppd ?? 0);
  const vendido = Math.max(vendidoVt, vendidoPpd);
  const fiConf = Number(r.fi_confirmadas ?? 0);
  const puede = fiConf === 0 && vendidoVt === 0;

  return {
    n_articulos: Number(r.n_articulos),
    pares_total: Number(r.pares_total),
    vendido,
    n_facturas: Number(r.n_facturas ?? 0),
    puede_borrar: puede,
    motivo: puede
      ? ""
      : `Ya hay ${vendido.toLocaleString("es-PY")} pares vendidos en este PP. No se puede borrar la importación.`,
    web_alzado: r.estado_transito === "EN_TRANSITO",
  };
}

export async function borrarImportacionPp(
  pool: Pool,
  ppId: number,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const estado = await getEstadoBorradoImportPp(pool, ppId);
  if (estado.n_articulos === 0) {
    return { ok: false, error: "No hay artículos importados." };
  }
  if (!estado.puede_borrar) {
    return { ok: false, error: estado.motivo || "No se puede borrar esta importación." };
  }

  const py = await runProformaBorrarPython(ppId);
  if (!py.ok) {
    return { ok: false, error: py.error || py.message || "Error al borrar importación." };
  }

  await pool.query(
    `UPDATE pedido_proveedor SET estado_transito = NULL WHERE id = $1 AND estado_transito = 'EN_TRANSITO'`,
    [ppId],
  );

  return { ok: true, message: py.message || "Importación eliminada. Podés cargar la proforma de nuevo." };
}
