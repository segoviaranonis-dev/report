import type { Pool } from "pg";
import {
  agregarVentasPorComprador,
  type VentaCompradorLinea,
} from "@/lib/clientes/etiqueta-comprador";
import { SQL_PP_CATEGORIA_CTE, SQL_FILTER_PROGRAMADO } from "@/lib/stock-programado/pp-categoria-sql";

/** Ventas PROGRAMADO · FI RESERVADA+CONFIRMADA · molécula×PP + cadena/cliente. */
export async function listVentasCompradorProgramado(
  pool: Pool,
): Promise<Map<string, VentaCompradorLinea[]>> {
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    pp_id: string;
    cadena: string | null;
    cliente: string;
    pares: string;
  }>(
    `
    WITH ${SQL_PP_CATEGORIA_CTE}
    SELECT
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      TRIM(ppd.material_code::text) AS material_code,
      TRIM(ppd.color_code::text) AS color_code,
      pp.id::text AS pp_id,
      cad_lat.descp_cadena AS cadena,
      COALESCE(NULLIF(TRIM(c.descp_cliente), ''), '—') AS cliente,
      SUM(fid.pares)::text AS pares
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN LATERAL (
      SELECT cad.descp_cadena
      FROM cliente_cadena_v2 cc
      JOIN cadena_v2 cad ON cad.id_cadena = cc.id_cadena
      WHERE cc.id_cliente = c.id_cliente
      ORDER BY cc.id_cadena
      LIMIT 1
    ) cad_lat ON true
    WHERE fi.estado IN ('RESERVADA', 'CONFIRMADA')
      AND fid.ppd_id IS NOT NULL
      AND ${SQL_FILTER_PROGRAMADO}
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    HAVING SUM(fid.pares) > 0
    `,
  );

  return agregarVentasPorComprador(
    rows.map((r) => ({
      linea: String(r.linea ?? "").trim(),
      referencia: String(r.referencia ?? "").trim(),
      material_code: String(r.material_code ?? "").trim(),
      color_code: String(r.color_code ?? "").trim(),
      pp_id: Number(r.pp_id),
      cadena: r.cadena,
      cliente: r.cliente,
      pares: Number(r.pares),
    })),
    { keyWithPp: true },
  );
}
