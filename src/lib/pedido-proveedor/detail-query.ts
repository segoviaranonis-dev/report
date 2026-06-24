import type { Pool } from "pg";
import type { IcDePp } from "@/lib/digitacion/bandeja-query";

export type PpDetalleHeader = {
  id: number;
  numero_registro: string;
  estado: string;
  estado_digitacion: string | null;
  numero_proforma: string | null;
  nro_factura_importacion: string | null;
  pares_comprometidos: number;
  total_articulos: number;
  total_vendido: number;
  saldo: number;
  proveedor: string;
  marcas: string;
  quincena: string | null;
  cliente: string;
  vendedor: string;
  notas: string | null;
  listado_editable: boolean;
  listado_precio: { evento_id: number; nombre: string } | null;
  n_facturas_internas: number;
  n_fi_confirmadas: number;
  fi_bloqueada: boolean;
};

export type PpAlaNorteRow = {
  id: number;
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  grada: string | null;
  cantidad_inicial: number;
  vendido: number;
  saldo: number;
};

export type PpFacturaInternaRow = {
  id: number;
  nro_factura: string;
  estado: string;
  total_pares: number;
  total_monto: number;
  cliente: string;
  vendedor: string;
};

export type PpIcVinculada = IcDePp & {
  evento_id: number | null;
  evento_nombre: string | null;
};

export async function getPpDetalle(pool: Pool, ppId: number): Promise<PpDetalleHeader | null> {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    estado_digitacion: string | null;
    numero_proforma: string | null;
    nro_factura_importacion: string | null;
    pares_comprometidos: string | null;
    proveedor: string;
    marcas: string;
    quincena: string | null;
    cliente: string;
    vendedor: string;
    notas: string | null;
    total_articulos: string;
    total_vendido: string;
    evento_id: string | null;
    evento_nombre: string | null;
    n_fi: string;
    n_fi_confirmadas: string;
  }>(
    `
    SELECT
      pp.id,
      pp.numero_registro,
      pp.estado,
      pp.estado_digitacion,
      pp.numero_proforma,
      pp.nro_factura_importacion,
      COALESCE(pp.pares_comprometidos, 0)::text AS pares_comprometidos,
      COALESCE(pi.nombre, '—') AS proveedor,
      qa.descripcion AS quincena,
      pp.notas,
      COALESCE(
        (SELECT STRING_AGG(DISTINCT mv2.descp_marca, ' / ' ORDER BY mv2.descp_marca)
         FROM pedido_proveedor_detalle ppd2
         JOIN marca_v2 mv2 ON mv2.id_marca = ppd2.id_marca
         WHERE ppd2.pedido_proveedor_id = pp.id AND ppd2.linea IS NOT NULL),
        (SELECT STRING_AGG(DISTINCT mv3.descp_marca, ' / ' ORDER BY mv3.descp_marca)
         FROM intencion_compra_pedido icp2
         JOIN intencion_compra ic2 ON ic2.id = icp2.intencion_compra_id
         JOIN marca_v2 mv3 ON mv3.id_marca = ic2.id_marca
         WHERE icp2.pedido_proveedor_id = pp.id),
        '—'
      ) AS marcas,
      COALESCE(
        c.descp_cliente,
        (SELECT c2.descp_cliente
         FROM intencion_compra_pedido icp3
         JOIN intencion_compra ic3 ON ic3.id = icp3.intencion_compra_id
         JOIN cliente_v2 c2 ON c2.id_cliente = ic3.id_cliente
         WHERE icp3.pedido_proveedor_id = pp.id
         LIMIT 1),
        '—'
      ) AS cliente,
      COALESCE(
        v.descp_usuario,
        (SELECT v2.descp_usuario
         FROM intencion_compra_pedido icp4
         JOIN intencion_compra ic4 ON ic4.id = icp4.intencion_compra_id
         JOIN usuario_v2 v2 ON v2.id_usuario = ic4.id_vendedor
         WHERE icp4.pedido_proveedor_id = pp.id
         LIMIT 1),
        '—'
      ) AS vendedor,
      (SELECT COUNT(*)::text
       FROM pedido_proveedor_detalle ppd5
       WHERE ppd5.pedido_proveedor_id = pp.id AND ppd5.linea IS NOT NULL) AS total_articulos,
      (
        COALESCE(
          (SELECT SUM(vt2.cantidad_vendida)
           FROM venta_transito vt2
           WHERE vt2.pedido_proveedor_id = pp.id),
          0
        )
        + COALESCE(
          (SELECT SUM(ppd6.pares_vendidos)
           FROM pedido_proveedor_detalle ppd6
           WHERE ppd6.pedido_proveedor_id = pp.id),
          0
        )
      )::text AS total_vendido,
      (
        SELECT pe.id::text
        FROM intencion_compra_pedido icp5
        JOIN precio_evento pe ON pe.id = icp5.precio_evento_id
        WHERE icp5.pedido_proveedor_id = pp.id
        ORDER BY icp5.id
        LIMIT 1
      ) AS evento_id,
      (
        SELECT pe.nombre_evento
        FROM intencion_compra_pedido icp6
        JOIN precio_evento pe ON pe.id = icp6.precio_evento_id
        WHERE icp6.pedido_proveedor_id = pp.id
        ORDER BY icp6.id
        LIMIT 1
      ) AS evento_nombre,
      (SELECT COUNT(*)::text FROM factura_interna fi WHERE fi.pp_id = pp.id) AS n_fi,
      (SELECT COUNT(*)::text FROM factura_interna fi WHERE fi.pp_id = pp.id AND fi.estado = 'CONFIRMADA') AS n_fi_confirmadas
    FROM pedido_proveedor pp
    LEFT JOIN proveedor_importacion pi ON pi.id = pp.proveedor_importacion_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN intencion_compra ic ON ic.id = pp.id_intencion_compra
    LEFT JOIN cliente_v2 c ON c.id_cliente = ic.id_cliente
    LEFT JOIN usuario_v2 v ON v.id_usuario = ic.id_vendedor
    WHERE pp.id = $1
    `,
    [ppId],
  );

  const r = rows[0];
  if (!r) return null;

  const pares = Number(r.pares_comprometidos ?? 0);
  const vendido = Number(r.total_vendido ?? 0);

  return {
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    numero_proforma: r.numero_proforma,
    nro_factura_importacion: r.nro_factura_importacion,
    pares_comprometidos: pares,
    total_articulos: Number(r.total_articulos ?? 0),
    total_vendido: vendido,
    saldo: pares - vendido,
    proveedor: r.proveedor,
    marcas: r.marcas,
    quincena: r.quincena,
    cliente: r.cliente,
    vendedor: r.vendedor,
    notas: r.notas,
    listado_editable: r.estado !== "ENVIADO",
    listado_precio:
      r.evento_id != null
        ? { evento_id: Number(r.evento_id), nombre: r.evento_nombre ?? `Evento #${r.evento_id}` }
        : null,
    n_facturas_internas: Number(r.n_fi ?? 0),
    n_fi_confirmadas: Number(r.n_fi_confirmadas ?? 0),
    fi_bloqueada: Number(r.total_articulos ?? 0) === 0,
  };
}

export async function listAlaNortePp(pool: Pool, ppId: number): Promise<PpAlaNorteRow[]> {
  const { rows } = await pool.query<{
    id: string;
    marca: string;
    linea: string;
    referencia: string;
    material: string;
    color: string;
    grada: string | null;
    cantidad_inicial: string;
    vendido: string;
    saldo: string;
  }>(
    `
    SELECT
      ppd.id,
      COALESCE(mv.descp_marca, '—') AS marca,
      ppd.linea,
      ppd.referencia,
      COALESCE(ppd.descp_material, '—') AS material,
      COALESCE(ppd.descp_color, '—') AS color,
      ppd.grada,
      COALESCE(ppd.cantidad_pares, 0)::text AS cantidad_inicial,
      GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE(SUM(vt.cantidad_vendida), 0)
      )::text AS vendido,
      (
        COALESCE(ppd.cantidad_pares, 0) - GREATEST(
          COALESCE(ppd.pares_vendidos, 0),
          COALESCE(SUM(vt.cantidad_vendida), 0)
        )
      )::text AS saldo
    FROM pedido_proveedor_detalle ppd
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN venta_transito vt ON vt.pedido_proveedor_detalle_id = ppd.id
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.referencia IS NOT NULL
    GROUP BY ppd.id, mv.descp_marca, ppd.linea, ppd.referencia,
             ppd.descp_material, ppd.descp_color, ppd.grada,
             ppd.cantidad_pares, ppd.pares_vendidos
    ORDER BY ppd.id
    `,
    [ppId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    marca: r.marca,
    linea: r.linea,
    referencia: r.referencia,
    material: r.material,
    color: r.color,
    grada: r.grada,
    cantidad_inicial: Number(r.cantidad_inicial ?? 0),
    vendido: Number(r.vendido ?? 0),
    saldo: Number(r.saldo ?? 0),
  }));
}

export async function listFacturasInternasPp(pool: Pool, ppId: number): Promise<PpFacturaInternaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    nro_factura: string;
    estado: string;
    total_pares: string;
    total_monto: string;
    cliente: string;
    vendedor: string;
  }>(
    `
    SELECT fi.id, fi.nro_factura, fi.estado,
           COALESCE(fi.total_pares, 0)::text AS total_pares,
           COALESCE(fi.total_monto, 0)::text AS total_monto,
           COALESCE(cv.descp_cliente, '—') AS cliente,
           COALESCE(uv.descp_usuario, '—') AS vendedor
    FROM factura_interna fi
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
    LEFT JOIN usuario_v2 uv ON uv.id_usuario = fi.vendedor_id
    WHERE fi.pp_id = $1
    ORDER BY fi.id
    `,
    [ppId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    nro_factura: r.nro_factura,
    estado: r.estado,
    total_pares: Number(r.total_pares ?? 0),
    total_monto: Number(r.total_monto ?? 0),
    cliente: r.cliente,
    vendedor: r.vendedor,
  }));
}

export async function listIcsVinculadasPp(pool: Pool, ppId: number): Promise<PpIcVinculada[]> {
  const { rows } = await pool.query<{
    ic_id: string;
    nro_ic: string;
    marca: string;
    proveedor: string;
    pares: string;
    nro_pedido_fabrica: string | null;
    evento_id: string | null;
    evento_nombre: string | null;
  }>(
    `
    SELECT ic.id AS ic_id, ic.numero_registro AS nro_ic,
           mv.descp_marca AS marca,
           COALESCE(pi.nombre, '—') AS proveedor,
           ic.cantidad_total_pares AS pares,
           icp.nro_pedido_fabrica,
           icp.precio_evento_id::text AS evento_id,
           pe.nombre_evento AS evento_nombre
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    LEFT JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    WHERE icp.pedido_proveedor_id = $1
    ORDER BY ic.numero_registro
    `,
    [ppId],
  );

  return rows.map((r) => ({
    ic_id: Number(r.ic_id),
    nro_ic: r.nro_ic,
    marca: r.marca,
    proveedor: r.proveedor,
    pares: Number(r.pares ?? 0),
    nro_pedido_fabrica: r.nro_pedido_fabrica,
    evento_id: r.evento_id ? Number(r.evento_id) : null,
    evento_nombre: r.evento_nombre,
  }));
}
