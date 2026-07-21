import type { Pool } from "pg";
import type { IcDePp } from "@/lib/digitacion/bandeja-query";
import { CATEGORIA_PROGRAMADO_ID } from "@/lib/intencion-compra/categoria-ic";
import { formatCategoriaPp, ppCabeceraEditable } from "./cabecera-actions";
import { formatNumeroPreventaCarlos } from "./dato-duro-cabecera";

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
  /** Política Corazón 1 — cabecera PP (2.3.1.7.5.3.13). */
  biblioteca_precio_id: number | null;
  biblioteca_nombre: string | null;
  proveedor_motor_id: number;
  /** EN_TRANSITO = visible catálogo RIMEC Web (v_stock_rimec · TRÁNSITO_PP). */
  estado_transito: string | null;
  web_alzado: boolean;
  n_facturas_internas: number;
  n_fi_confirmadas: number;
  fi_bloqueada: boolean;
  /** Palabra reservada: Fecha de entrega Real → fecha_arribo_real */
  fecha_entrega_real: string | null;
  logistica_bandera_activa: boolean;
  logistica_activada_at: string | null;
  logistica_n_fi: number;
  logistica_cajas: number;
};

import type { PpAlaNorteRow } from "./ala-norte-types";

export type { PpAlaNorteRow };

export type PpFacturaInternaRow = {
  id: number;
  nro_factura: string;
  estado: string;
  total_pares: number;
  total_cajas: number;
  total_monto: number;
  created_at: string | null;
  cliente_id: number | null;
  cliente: string;
  vendedor: string;
  vendedor_id: number | null;
  marca: string;
  caso: string;
  lista_precio_id: number | null;
  ic_listado_precio_id: number | null;
  plazo_nombre: string | null;
  plazo_id: number | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  item_count: number;
};

export type PpIcVinculada = IcDePp & {
  id_cliente: number;
  cliente: string;
  evento_id: number | null;
  evento_nombre: string | null;
  listado_precio_id: number | null;
  monto_bruto: number;
  monto_neto: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  id_plazo: number | null;
  plazo_nombre: string | null;
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
    estado_transito: string | null;
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
    vendido_vt: string;
    vendido_ppd: string;
    pares_ic_sum: string;
    pares_ppd_inicial: string;
    evento_id: string | null;
    evento_nombre: string | null;
    n_fi: string;
    n_fi_confirmadas: string;
    fecha_arribo_real: string | null;
    logistica_bandera_activa: boolean;
    logistica_activada_at: string | null;
    logistica_n_fi: string;
    logistica_cajas: string;
    biblioteca_precio_id: string | null;
    biblioteca_nombre: string | null;
    proveedor_importacion_id: string | null;
  }>(
    `
    SELECT
      pp.id,
      pp.numero_registro,
      pp.estado,
      pp.estado_transito,
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
      pp.biblioteca_precio_id::text AS biblioteca_precio_id,
      pp.proveedor_importacion_id::text AS proveedor_importacion_id,
      bp.nombre AS biblioteca_nombre,
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
        SELECT COALESCE(
          (SELECT SUM(vt2.cantidad_vendida)
           FROM venta_transito vt2
           WHERE vt2.pedido_proveedor_id = pp.id),
          0
        )::text
      ) AS vendido_vt,
      (
        SELECT COALESCE(
          (SELECT SUM(ppd6.pares_vendidos)
           FROM pedido_proveedor_detalle ppd6
           WHERE ppd6.pedido_proveedor_id = pp.id),
          0
        )::text
      ) AS vendido_ppd,
      (
        SELECT COALESCE(SUM(ic7.cantidad_total_pares), 0)::text
        FROM intencion_compra_pedido icp7
        JOIN intencion_compra ic7 ON ic7.id = icp7.intencion_compra_id
        WHERE icp7.pedido_proveedor_id = pp.id
      ) AS pares_ic_sum,
      (
        SELECT COALESCE(SUM(ppd8.cantidad_pares), 0)::text
        FROM pedido_proveedor_detalle ppd8
        WHERE ppd8.pedido_proveedor_id = pp.id AND ppd8.linea IS NOT NULL
      ) AS pares_ppd_inicial,
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
      (SELECT COUNT(*)::text FROM factura_interna fi WHERE fi.pp_id = pp.id AND fi.estado = 'CONFIRMADA') AS n_fi_confirmadas,
      pp.fecha_arribo_real::text AS fecha_arribo_real,
      COALESCE(pp.logistica_bandera_activa, false) AS logistica_bandera_activa,
      pp.logistica_activada_at::text AS logistica_activada_at,
      (SELECT COUNT(*)::text FROM logistica_pendiente_confirmacion l WHERE l.pedido_proveedor_id = pp.id) AS logistica_n_fi,
      /* cajas desde FI detalle — no depende de columna snapshot MIG-168 */
      (
        SELECT COALESCE(SUM(fid.cajas), 0)::text
        FROM logistica_pendiente_confirmacion l
        JOIN factura_interna_detalle fid ON fid.factura_id = l.factura_interna_id
        WHERE l.pedido_proveedor_id = pp.id
      ) AS logistica_cajas
    FROM pedido_proveedor pp
    LEFT JOIN proveedor_importacion pi ON pi.id = pp.proveedor_importacion_id
    LEFT JOIN biblioteca_precio bp ON bp.id = pp.biblioteca_precio_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN categoria_v2 cv ON cv.id_categoria = pp.categoria_id
    WHERE pp.id = $1
    `,
    [ppId],
  );

  const r = rows[0];
  if (!r) return null;

  const paresDb = Number(r.pares_comprometidos ?? 0);
  const paresIcSum = Number(r.pares_ic_sum ?? 0);
  const paresPpdInicial = Number(r.pares_ppd_inicial ?? 0);
  const vendidoVt = Number(r.vendido_vt ?? 0);
  const vendidoPpd = Number(r.vendido_ppd ?? 0);
  const nFi = Number(r.n_fi ?? 0);
  const categoriaId = r.categoria_id != null ? Number(r.categoria_id) : null;

  /** PROGRAMADO sin FI: reserva stock (pares_vendidos) no cuenta — saldo = inicial. */
  const vendido =
    categoriaId === CATEGORIA_PROGRAMADO_ID && nFi === 0
      ? vendidoVt
      : Math.max(vendidoVt, vendidoPpd);

  /** PARES IC: cabecera BD · fallback suma ICs (programado multi-IC). */
  const paresComprometidos = Math.max(paresDb, paresIcSum);
  /** Saldo KPI: base = stock F9 importado (Ala Norte) si existe; no pares_comprometidos=0 post-import. */
  const paresInicial = paresPpdInicial > 0 ? paresPpdInicial : paresComprometidos;
  const saldo = paresInicial - vendido;

  return {
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    numero_proforma: r.numero_proforma,
    nro_factura_importacion: r.nro_factura_importacion,
    pares_comprometidos: paresComprometidos,
    total_articulos: Number(r.total_articulos ?? 0),
    total_vendido: vendido,
    saldo,
    proveedor: r.proveedor,
    marcas: r.marcas,
    quincena: r.quincena,
    quincena_arribo_id: r.quincena_arribo_id != null ? Number(r.quincena_arribo_id) : null,
    categoria: formatCategoriaPp(categoriaId, r.categoria_descp),
    categoria_id: categoriaId,
    creador: r.creador,
    notas: r.notas,
    nro_pedido_externo: r.nro_pedido_externo
      ? formatNumeroPreventaCarlos(r.nro_pedido_externo) || null
      : null,
    fecha_arribo_estimada: r.fecha_arribo_estimada?.slice(0, 10) ?? null,
    descuento_1: Number(r.descuento_1 ?? 0),
    descuento_2: Number(r.descuento_2 ?? 0),
    descuento_3: Number(r.descuento_3 ?? 0),
    descuento_4: Number(r.descuento_4 ?? 0),
    cabecera_editable: ppCabeceraEditable(r.estado),
    listado_editable: r.estado !== "ENVIADO",
    estado_transito: r.estado_transito,
    web_alzado: r.estado_transito === "EN_TRANSITO",
    listado_precio:
      r.evento_id != null
        ? { evento_id: Number(r.evento_id), nombre: r.evento_nombre ?? `Evento #${r.evento_id}` }
        : null,
    biblioteca_precio_id:
      r.biblioteca_precio_id != null ? Number(r.biblioteca_precio_id) : null,
    biblioteca_nombre: r.biblioteca_nombre?.trim() || null,
    proveedor_motor_id: Number(r.proveedor_importacion_id ?? 654) || 654,
    n_facturas_internas: Number(r.n_fi ?? 0),
    n_fi_confirmadas: Number(r.n_fi_confirmadas ?? 0),
    fi_bloqueada: Number(r.total_articulos ?? 0) === 0,
    fecha_entrega_real: r.fecha_arribo_real?.slice(0, 10) ?? null,
    logistica_bandera_activa: Boolean(r.logistica_bandera_activa),
    logistica_activada_at: r.logistica_activada_at,
    logistica_n_fi: Number(r.logistica_n_fi ?? 0),
    logistica_cajas: Number(r.logistica_cajas ?? 0),
  };
}

export async function listAlaNortePp(pool: Pool, ppId: number): Promise<PpAlaNorteRow[]> {
  const { rows } = await pool.query<{
    id: string;
    marca: string;
    linea: string;
    referencia: string;
    style_code: string | null;
    material_code: string | null;
    material: string;
    color_code: string | null;
    color: string;
    grada: string | null;
    grades_json: unknown;
    cantidad_cajas: string;
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
      ppd.style_code,
      ppd.material_code,
      COALESCE(ppd.descp_material, '—') AS material,
      ppd.color_code,
      COALESCE(ppd.descp_color, '—') AS color,
      ppd.grada,
      ppd.grades_json,
      COALESCE(ppd.cantidad_cajas, 0)::text AS cantidad_cajas,
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
             ppd.style_code, ppd.material_code, ppd.descp_material,
             ppd.color_code, ppd.descp_color, ppd.grada, ppd.grades_json,
             ppd.cantidad_cajas, ppd.cantidad_pares, ppd.pares_vendidos
    ORDER BY ppd.id
    `,
    [ppId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    marca: r.marca,
    linea: r.linea,
    referencia: r.referencia,
    style_code: r.style_code,
    material_code: r.material_code,
    material: r.material,
    color_code: r.color_code,
    color: r.color,
    grada: r.grada,
    grades_json: r.grades_json,
    cantidad_cajas: Number(r.cantidad_cajas ?? 0),
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
    total_cajas: string;
    total_monto: string;
    created_at: string | null;
    cliente_id: string | null;
    cliente: string;
    vendedor_id: string | null;
    vendedor: string;
    marca: string;
    caso: string;
    lista_precio_id: string | null;
    ic_listado_precio_id: string | null;
    plazo_id: string | null;
    plazo_nombre: string | null;
    descuento_1: string;
    descuento_2: string;
    descuento_3: string;
    descuento_4: string;
    item_count: string;
  }>(
    `
    SELECT fi.id, fi.nro_factura, fi.estado,
           COALESCE(fi.total_pares, 0)::text AS total_pares,
           COALESCE((
             SELECT SUM(fid.cajas)::text
             FROM factura_interna_detalle fid
             WHERE fid.factura_id = fi.id
           ), '0') AS total_cajas,
           COALESCE(fi.total_monto, 0)::text AS total_monto,
           fi.created_at::text AS created_at,
           fi.cliente_id::text AS cliente_id,
           COALESCE(cv.descp_cliente, '—') AS cliente,
           fi.vendedor_id::text AS vendedor_id,
           COALESCE(
             NULLIF(TRIM(vd_fi.descp_vendedor), ''),
             NULLIF(TRIM(vd_ic.descp_vendedor), ''),
             '—'
           ) AS vendedor,
           COALESCE(NULLIF(TRIM(fi.marca), ''), NULLIF(TRIM(mv.descp_marca), ''), '—') AS marca,
           COALESCE(fi.caso, '—') AS caso,
           fi.lista_precio_id::text AS lista_precio_id,
           ic.listado_precio_id::text AS ic_listado_precio_id,
           COALESCE(fi.plazo_id, ic.id_plazo)::text AS plazo_id,
           COALESCE(NULLIF(TRIM(pl.descp_plazo), ''), NULLIF(TRIM(pl_ic.descp_plazo), '')) AS plazo_nombre,
           COALESCE(fi.descuento_1, ic.descuento_1, 0)::text AS descuento_1,
           COALESCE(fi.descuento_2, ic.descuento_2, 0)::text AS descuento_2,
           COALESCE(fi.descuento_3, ic.descuento_3, 0)::text AS descuento_3,
           COALESCE(fi.descuento_4, ic.descuento_4, 0)::text AS descuento_4,
           (SELECT COUNT(*)::text FROM factura_interna_detalle d WHERE d.factura_id = fi.id) AS item_count
    FROM factura_interna fi
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = fi.cliente_id
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = fi.plazo_id
    LEFT JOIN LATERAL (
      SELECT ic.id_vendedor, ic.listado_precio_id, ic.id_plazo, ic.id_marca,
             ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND ic.id_cliente = fi.cliente_id
      ORDER BY ABS(ic.cantidad_total_pares - COALESCE(fi.total_pares, 0)) ASC, ic.id ASC
      LIMIT 1
    ) ic ON true
    LEFT JOIN vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
    LEFT JOIN vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor
    LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = COALESCE(fi.plazo_id, ic.id_plazo)
    LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    WHERE fi.pp_id = $1
    ORDER BY fi.nro_factura
    `,
    [ppId],
  );

  const seen = new Set<number>();
  return rows
    .filter((r) => {
      const id = Number(r.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((r) => ({
    id: Number(r.id),
    nro_factura: r.nro_factura,
    estado: r.estado,
    total_pares: Number(r.total_pares ?? 0),
    total_cajas: Number(r.total_cajas ?? 0),
    total_monto: Number(r.total_monto ?? 0),
    created_at: r.created_at,
    cliente_id: r.cliente_id != null ? Number(r.cliente_id) : null,
    cliente: r.cliente,
    vendedor_id: r.vendedor_id != null ? Number(r.vendedor_id) : null,
    vendedor: r.vendedor,
    marca: r.marca,
    caso: r.caso,
    lista_precio_id: r.lista_precio_id != null ? Number(r.lista_precio_id) : null,
    ic_listado_precio_id: r.ic_listado_precio_id != null ? Number(r.ic_listado_precio_id) : null,
    plazo_id: r.plazo_id != null ? Number(r.plazo_id) : null,
    plazo_nombre: r.plazo_nombre,
    descuento_1: Number(r.descuento_1 ?? 0),
    descuento_2: Number(r.descuento_2 ?? 0),
    descuento_3: Number(r.descuento_3 ?? 0),
    descuento_4: Number(r.descuento_4 ?? 0),
    item_count: Number(r.item_count ?? 0),
  }));
}

export async function listIcsVinculadasPp(pool: Pool, ppId: number): Promise<PpIcVinculada[]> {
  const { rows } = await pool.query<{
    ic_id: string;
    nro_ic: string;
    id_cliente: string;
    cliente: string | null;
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
    listado_precio_id: string | null;
    monto_bruto: string | null;
    monto_neto: string | null;
    descuento_1: string | null;
    descuento_2: string | null;
    descuento_3: string | null;
    descuento_4: string | null;
    id_plazo: string | null;
    plazo_nombre: string | null;
  }>(
    `
    SELECT ic.id AS ic_id, ic.numero_registro AS nro_ic,
           ic.id_cliente,
           COALESCE(cv.descp_cliente, '—') AS cliente,
           mv.descp_marca AS marca,
           COALESCE(pi.nombre, '—') AS proveedor,
           ic.cantidad_total_pares AS pares,
           ic.id_marca::text AS id_marca,
           ic.id_vendedor::text AS id_vendedor,
           ic.id_proveedor::text AS id_proveedor,
           ic.categoria_id::text AS categoria_id,
           ic.listado_precio_id::text AS listado_precio_id,
           COALESCE(ic.monto_bruto, 0)::text AS monto_bruto,
           COALESCE(ic.monto_neto, 0)::text AS monto_neto,
           COALESCE(ic.descuento_1, 0)::text AS descuento_1,
           COALESCE(ic.descuento_2, 0)::text AS descuento_2,
           COALESCE(ic.descuento_3, 0)::text AS descuento_3,
           COALESCE(ic.descuento_4, 0)::text AS descuento_4,
           ic.id_plazo::text AS id_plazo,
           COALESCE(NULLIF(TRIM(pl.descp_plazo), ''), '—') AS plazo_nombre,
           COALESCE(cat.descp_categoria, '—') AS categoria,
           COALESCE(vd.descp_vendedor, '—') AS vendedor,
           icp.nro_pedido_fabrica,
           icp.precio_evento_id::text AS evento_id,
           pe.nombre_evento AS evento_nombre
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    LEFT JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = ic.id_plazo
    LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    WHERE icp.pedido_proveedor_id = $1
    ORDER BY ic.numero_registro
    `,
    [ppId],
  );

  return rows.map((r) => ({
    ic_id: Number(r.ic_id),
    nro_ic: r.nro_ic,
    id_cliente: Number(r.id_cliente),
    cliente: r.cliente ?? "—",
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
    listado_precio_id: r.listado_precio_id != null ? Number(r.listado_precio_id) : null,
    monto_bruto: Number(r.monto_bruto ?? 0),
    monto_neto: Number(r.monto_neto ?? 0),
    descuento_1: Number(r.descuento_1 ?? 0),
    descuento_2: Number(r.descuento_2 ?? 0),
    descuento_3: Number(r.descuento_3 ?? 0),
    descuento_4: Number(r.descuento_4 ?? 0),
    id_plazo: r.id_plazo != null ? Number(r.id_plazo) : null,
    plazo_nombre: r.plazo_nombre ?? "—",
  }));
}
