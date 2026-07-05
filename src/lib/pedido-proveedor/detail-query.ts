import type { Pool } from "pg";
import type { IcDePp } from "@/lib/digitacion/bandeja-query";
import { formatCategoriaPp, ppCabeceraEditable } from "./cabecera-actions";

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
  quincena_arribo_id: number | null;
  /** Estrategia comercial: COMPRA PREVIA | PROGRAMADO (no nombre de cliente). */
  categoria: string;
  categoria_id: number | null;
  /** Usuario Report que asignó la IC al PP (asignado_por), no vendedor comercial. */
  creador: string;
  notas: string | null;
  nro_pedido_externo: string | null;
  fecha_arribo_estimada: string | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  cabecera_editable: boolean;
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
  id_marca: number;
  id_vendedor: number;
  id_proveedor: number;
  categoria_id: number | null;
  categoria: string;
  vendedor: string;
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
    quincena_arribo_id: string | null;
    categoria_id: string | null;
    categoria_descp: string | null;
    creador: string;
    notas: string | null;
    nro_pedido_externo: string | null;
    fecha_arribo_estimada: string | null;
    descuento_1: string | null;
    descuento_2: string | null;
    descuento_3: string | null;
    descuento_4: string | null;
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
      pp.quincena_arribo_id::text AS quincena_arribo_id,
      pp.notas,
      pp.nro_pedido_externo,
      pp.fecha_arribo_estimada::text AS fecha_arribo_estimada,
      COALESCE(pp.descuento_1, 0)::text AS descuento_1,
      COALESCE(pp.descuento_2, 0)::text AS descuento_2,
      COALESCE(pp.descuento_3, 0)::text AS descuento_3,
      COALESCE(pp.descuento_4, 0)::text AS descuento_4,
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
        pp.categoria_id,
        (SELECT ic3.categoria_id
         FROM intencion_compra_pedido icp3
         JOIN intencion_compra ic3 ON ic3.id = icp3.intencion_compra_id
         WHERE icp3.pedido_proveedor_id = pp.id
         ORDER BY icp3.id
         LIMIT 1)
      )::text AS categoria_id,
      COALESCE(
        cv.descp_categoria,
        (SELECT cv2.descp_categoria
         FROM intencion_compra_pedido icp3b
         JOIN intencion_compra ic3b ON ic3b.id = icp3b.intencion_compra_id
         JOIN categoria_v2 cv2 ON cv2.id_categoria = ic3b.categoria_id
         WHERE icp3b.pedido_proveedor_id = pp.id
         ORDER BY icp3b.id
         LIMIT 1)
      ) AS categoria_descp,
      COALESCE(
        (SELECT u.descp_usuario
         FROM intencion_compra_pedido icp4
         JOIN usuario_v2 u ON u.id_usuario = icp4.asignado_por
         WHERE icp4.pedido_proveedor_id = pp.id AND icp4.asignado_por IS NOT NULL
         ORDER BY icp4.id
         LIMIT 1),
        (SELECT vd.descp_vendedor
         FROM intencion_compra_pedido icp4b
         JOIN intencion_compra ic4b ON ic4b.id = icp4b.intencion_compra_id
         JOIN vendedor_v2 vd ON vd.id_vendedor = ic4b.id_vendedor
         WHERE icp4b.pedido_proveedor_id = pp.id
         ORDER BY icp4b.id
         LIMIT 1),
        '—'
      ) AS creador,
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
    LEFT JOIN categoria_v2 cv ON cv.id_categoria = pp.categoria_id
    WHERE pp.id = $1
    `,
    [ppId],
  );

  const r = rows[0];
  if (!r) return null;

  const pares = Number(r.pares_comprometidos ?? 0);
  const vendido = Number(r.total_vendido ?? 0);
  const categoriaId = r.categoria_id != null ? Number(r.categoria_id) : null;

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
    quincena_arribo_id: r.quincena_arribo_id != null ? Number(r.quincena_arribo_id) : null,
    categoria: formatCategoriaPp(categoriaId, r.categoria_descp),
    categoria_id: categoriaId,
    creador: r.creador,
    notas: r.notas,
    nro_pedido_externo: r.nro_pedido_externo,
    fecha_arribo_estimada: r.fecha_arribo_estimada?.slice(0, 10) ?? null,
    descuento_1: Number(r.descuento_1 ?? 0),
    descuento_2: Number(r.descuento_2 ?? 0),
    descuento_3: Number(r.descuento_3 ?? 0),
    descuento_4: Number(r.descuento_4 ?? 0),
    cabecera_editable: ppCabeceraEditable(r.estado),
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
    id_marca: string;
    id_vendedor: string;
    id_proveedor: string;
    categoria_id: string | null;
    categoria: string | null;
    vendedor: string | null;
  }>(
    `
    SELECT ic.id AS ic_id, ic.numero_registro AS nro_ic,
           mv.descp_marca AS marca,
           COALESCE(pi.nombre, '—') AS proveedor,
           ic.cantidad_total_pares AS pares,
           ic.id_marca::text AS id_marca,
           ic.id_vendedor::text AS id_vendedor,
           ic.id_proveedor::text AS id_proveedor,
           ic.categoria_id::text AS categoria_id,
           COALESCE(cat.descp_categoria, '—') AS categoria,
           COALESCE(vd.descp_vendedor, '—') AS vendedor,
           icp.nro_pedido_fabrica,
           icp.precio_evento_id::text AS evento_id,
           pe.nombre_evento AS evento_nombre
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    LEFT JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
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
    id_marca: Number(r.id_marca),
    id_vendedor: Number(r.id_vendedor),
    id_proveedor: Number(r.id_proveedor),
    categoria_id: r.categoria_id != null ? Number(r.categoria_id) : null,
    categoria: r.categoria ?? "—",
    vendedor: r.vendedor ?? "—",
  }));
}
