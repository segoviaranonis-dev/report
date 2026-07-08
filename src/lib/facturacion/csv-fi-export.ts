import type { Pool } from "pg";
import { fiDisplayId } from "@/app/aprobaciones/lib/aprobaciones-utils";
import {
  buildCsvCarlosContent,
  csvCarlosFilename,
  type CsvCarlosRow,
} from "@/lib/pedido-proveedor/csv-ventas-export";
import { loadFrancisTranslator } from "@/lib/pedido-proveedor/csv-vendedor-francis";
import { exportCsvPeVentasFi, isPeFi } from "@/lib/facturacion/csv-pe-ventas-export";

/** Filas CSV Carlos — FI tránsito / PP (no PE). */
export async function fetchCsvCarlosRowsByFiId(pool: Pool, fiId: number): Promise<CsvCarlosRow[]> {
  const { rows } = await pool.query<CsvCarlosRow>(
    `
    SELECT
      fi.cliente_id::text AS cliente_id,
      fi.plazo_id::text AS plazo_id,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      mv.descp_marca AS marca,
      ppd.material_code,
      ppd.descp_material,
      ppd.color_code,
      ppd.descp_color,
      ppd.grades_json,
      COALESCE(pl.nombre_caso_aplicado, NULLIF(TRIM(fi.caso), ''), '—') AS caso,
      pe_evt.evento_nombre AS biblioteca,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo,
      fid.pares::text AS pares,
      COALESCE(NULLIF(TRIM(pl_fi.descp_plazo), ''), 'N/A') AS plazo,
      fi.lista_precio_id::text AS lista_precio_id,
      COALESCE(fi.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, 0)::text AS descuento_4
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN plazo_v2 pl_fi ON pl_fi.id_plazo = fi.plazo_id
    LEFT JOIN material m
      ON m.proveedor_id = pp.proveedor_importacion_id
     AND m.codigo_proveedor::text = ppd.material_code
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.codigo_proveedor::text = ppd.referencia
     AND ref.linea_id = l.id
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = ref.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN LATERAL (
      SELECT icp.precio_evento_id
      FROM intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.id
      LIMIT 1
    ) icp ON TRUE
    LEFT JOIN LATERAL (
      SELECT pe.nombre_evento AS evento_nombre
      FROM precio_evento pe
      WHERE pe.id = icp.precio_evento_id
      LIMIT 1
    ) pe_evt ON TRUE
    LEFT JOIN precio_lista pl
      ON pl.evento_id = icp.precio_evento_id
     AND pl.linea_id = l.id
     AND pl.referencia_id = ref.id
     AND pl.material_id = m.id
    WHERE fi.id = $1
      AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
    ORDER BY fid.id
    `,
    [fiId],
  );
  return rows;
}

export async function exportCsvVentasFi(
  pool: Pool,
  fiId: number,
  meta: {
    pv_global: number | null;
    nro_factura: string;
    proforma?: string | null;
    pedido?: string;
    pp_id?: number | null;
    pedido_id?: number | null;
    cliente_id?: number | null;
  },
): Promise<{ content: string; filename: string; rowCount: number }> {
  if (isPeFi({ nro_factura: meta.nro_factura, pp_id: meta.pp_id ?? null })) {
    return exportCsvPeVentasFi(pool, fiId, {
      nro_factura: meta.nro_factura,
      pp_id: meta.pp_id ?? null,
      pedido_id: meta.pedido_id ?? null,
      cliente_id: meta.cliente_id ?? null,
    });
  }

  const rows = await fetchCsvCarlosRowsByFiId(pool, fiId);
  if (!rows.length) {
    throw new Error("Sin líneas para exportar CSV");
  }
  const display = fiDisplayId({ pv_global: meta.pv_global, nro_factura: meta.nro_factura });
  const filename =
    display !== "—" && display.startsWith("PV")
      ? `${display}.csv`
      : csvCarlosFilename(meta.proforma ?? null, meta.pedido ?? meta.nro_factura);
  return {
    content: buildCsvCarlosContent(rows, loadFrancisTranslator()),
    filename,
    rowCount: rows.length,
  };
}
