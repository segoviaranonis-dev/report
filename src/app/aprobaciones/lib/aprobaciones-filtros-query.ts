import type { AprobacionesFiltros } from "./aprobaciones-filtros-types";
import { filtrosActivos } from "./aprobaciones-filtros-types";

type BuildOpts = {
  fiAlias?: string;
  /** Campo fecha principal para rango */
  fechaExpr?: string;
};

function pvDigits(raw: string): number | null {
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  const n = Number.parseInt(d, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cláusulas WHERE sobre alias FI (+ joins cliente/vendedor vía subselects mínimos).
 * Retorna fragmento `AND ...` (vacío si sin filtros).
 */
export function buildFiFiltrosSql(
  f: AprobacionesFiltros,
  opts: BuildOpts = {},
): { sql: string; params: unknown[] } {
  if (!filtrosActivos(f)) return { sql: "", params: [] };

  const fi = opts.fiAlias ?? "fi";
  const fechaExpr = opts.fechaExpr ?? `COALESCE(${fi}.fecha_confirmacion, ${fi}.created_at)`;
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const push = (clause: string, ...vals: unknown[]) => {
    parts.push(clause);
    params.push(...vals);
  };

  if (f.clienteIds.length) {
    push(`${fi}.cliente_id = ANY($${i}::int[])`, f.clienteIds);
    i++;
  }

  if (f.clienteNombres.length) {
    push(
      `EXISTS (
        SELECT 1 FROM cliente_v2 c_f
        WHERE c_f.id_cliente = ${fi}.cliente_id
          AND TRIM(c_f.descp_cliente) = ANY($${i}::text[])
      )`,
      f.clienteNombres,
    );
    i++;
  }

  if (f.marcas.length) {
    push(`TRIM(${fi}.marca) = ANY($${i}::text[])`, f.marcas);
    i++;
  }

  if (f.vendedores.length) {
    push(
      `EXISTS (
        SELECT 1
        FROM pedido_venta_rimec pvr_v
        LEFT JOIN usuario_v2 u_v ON u_v.id_usuario = ${fi}.vendedor_id
        LEFT JOIN vendedor_v2 vd_v ON vd_v.id_vendedor = ${fi}.vendedor_id
        WHERE pvr_v.id = ${fi}.pedido_id
          AND (
            TRIM(COALESCE(
              NULLIF(TRIM(pvr_v.payload_json->>'vendedor_nombre'), ''),
              NULLIF(TRIM(u_v.descp_usuario), ''),
              NULLIF(TRIM(vd_v.descp_vendedor), ''),
              ''
            )) = ANY($${i}::text[])
          )
      )`,
      f.vendedores,
    );
    i++;
  }

  const pv = pvDigits(f.pvGlobalQ);
  if (pv != null) {
    push(`${fi}.pv_global = $${i}`, pv);
    i++;
  } else if (f.pvGlobalQ.trim()) {
    push(`CAST(${fi}.pv_global AS TEXT) ILIKE $${i}`, `%${f.pvGlobalQ.trim()}%`);
    i++;
  }

  if (f.nroFacturaQ.trim()) {
    push(`${fi}.nro_factura ILIKE $${i}`, `%${f.nroFacturaQ.trim()}%`);
    i++;
  }

  if (f.fechaDesde) {
    push(`${fechaExpr}::date >= $${i}::date`, f.fechaDesde);
    i++;
  }
  if (f.fechaHasta) {
    push(`${fechaExpr}::date <= $${i}::date`, f.fechaHasta);
    i++;
  }

  const detalleParts: string[] = [];
  if (f.codigosArticulo.length) {
    detalleParts.push(`(ppd_f.linea || '.' || ppd_f.referencia) = ANY($${i}::text[])`);
    params.push(f.codigosArticulo);
    i++;
  }
  if (f.lineaQ.trim()) {
    detalleParts.push(`ppd_f.linea ILIKE $${i}`);
    params.push(`%${f.lineaQ.trim()}%`);
    i++;
  }
  if (f.referenciaQ.trim()) {
    detalleParts.push(`ppd_f.referencia ILIKE $${i}`);
    params.push(`%${f.referenciaQ.trim()}%`);
    i++;
  }
  if (f.codigosGrupoDpe.length) {
    detalleParts.push(`COALESCE(lr_f.grupo_estilo_id::text, '') = ANY($${i}::text[])`);
    params.push(f.codigosGrupoDpe);
    i++;
  }

  if (detalleParts.length) {
    parts.push(`EXISTS (
      SELECT 1
      FROM factura_interna_detalle fid_f
      JOIN pedido_proveedor_detalle ppd_f ON ppd_f.id = fid_f.ppd_id
      LEFT JOIN pedido_proveedor pp_f ON pp_f.id = ${fi}.pp_id
      LEFT JOIN linea l_f
        ON l_f.codigo_proveedor::text = ppd_f.linea
       AND l_f.proveedor_id = COALESCE(pp_f.proveedor_importacion_id, 654)
      LEFT JOIN referencia ref_f
        ON ref_f.codigo_proveedor::text = ppd_f.referencia
       AND ref_f.linea_id = l_f.id
      LEFT JOIN linea_referencia lr_f
        ON lr_f.linea_id = l_f.id
       AND lr_f.referencia_id = ref_f.id
      WHERE fid_f.factura_id = ${fi}.id
        AND (${detalleParts.join(" OR ")})
    )`);
  }

  if (!parts.length) return { sql: "", params: [] };
  return { sql: ` AND ${parts.join(" AND ")}`, params };
}

/** Filtros a nivel pedido pendiente (cabecera PVR + FIs hijas). */
export function buildPedidoFiltrosSql(
  f: AprobacionesFiltros,
): { sql: string; params: unknown[] } {
  if (!filtrosActivos(f)) return { sql: "", params: [] };

  const parts: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (f.clienteIds.length) {
    parts.push(`pvr.cliente_id = ANY($${i}::int[])`);
    params.push(f.clienteIds);
    i++;
  }
  if (f.clienteNombres.length) {
    parts.push(`TRIM(c.descp_cliente) = ANY($${i}::text[])`);
    params.push(f.clienteNombres);
    i++;
  }
  if (f.vendedores.length) {
    parts.push(
      `TRIM(COALESCE(
        NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), ''),
        NULLIF(TRIM(v.descp_usuario), ''),
        '—'
      )) = ANY($${i}::text[])`,
    );
    params.push(f.vendedores);
    i++;
  }
  if (f.fechaDesde) {
    parts.push(`pvr.created_at::date >= $${i}::date`);
    params.push(f.fechaDesde);
    i++;
  }
  if (f.fechaHasta) {
    parts.push(`pvr.created_at::date <= $${i}::date`);
    params.push(f.fechaHasta);
    i++;
  }

  const fiOnly = {
    ...f,
    clienteIds: [],
    clienteNombres: [],
    vendedores: [],
    fechaDesde: null,
    fechaHasta: null,
  };
  const fiDet = buildFiFiltrosSql(fiOnly, {
    fiAlias: "fi_p",
    fechaExpr: "fi_p.created_at",
  });

  if (fiDet.sql) {
    parts.push(`EXISTS (
      SELECT 1 FROM factura_interna fi_p
      WHERE fi_p.pedido_id = pvr.id
        AND UPPER(TRIM(fi_p.estado)) = 'RESERVADA'
        ${fiDet.sql}
    )`);
    params.push(...fiDet.params);
  }

  if (!parts.length) return { sql: "", params: [] };
  return { sql: ` AND ${parts.join(" AND ")}`, params };
}
