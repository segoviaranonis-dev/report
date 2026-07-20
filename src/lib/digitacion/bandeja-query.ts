import type { Pool } from "pg";
import {
  CATEGORIA_PROGRAMADO_ID,
  type RamoDigitacion,
  categoriaIdFromRamo,
} from "@/lib/intencion-compra/categoria-ic";

export type IcDigitacionPendiente = {
  id: number;
  numero_registro: string;
  marca: string;
  categoria: string;
  categoria_id: number | null;
  estado: string;
  proveedor: string;
  cliente: string;
  vendedor: string;
  nro_pedido_fabrica: string | null;
  pares: number;
  fecha_embarque: string | null;
  quincena_arribo_id: number | null;
  fecha_creacion: string | null;
  evento_precio: string | null;
  precio_evento_id: number | null;
};

export type PpEnProceso = {
  id: number;
  numero_registro: string;
  estado: string;
  estado_digitacion: string | null;
  pares_comprometidos: number;
  nro_factura_importacion: string | null;
  marcas: string;
  n_ics: number;
  quincena: string | null;
  quincena_arribo_id: number | null;
};

export type PpDigitacionQuincenaGrupo = {
  key: string;
  quincena: string;
  quincena_arribo_id: number | null;
  pps: PpEnProceso[];
  n_preventas: number;
  total_pares: number;
};

export type IcPendienteEmbarqueGrupo = {
  key: string;
  quincena: string;
  quincena_arribo_id: number | null;
  ics: IcDigitacionPendiente[];
  n_ics: number;
  n_clientes: number;
  total_pares: number;
};

export type IcDePp = {
  ic_id: number;
  nro_ic: string;
  marca: string;
  proveedor: string;
  pares: number;
  nro_pedido_fabrica: string | null;
};

export async function listIcPendientesDigitacion(
  pool: Pool,
  ramo?: RamoDigitacion,
): Promise<IcDigitacionPendiente[]> {
  const categoriaId = ramo ? categoriaIdFromRamo(ramo) : null;
  const estados =
    ramo === "programado"
      ? ["PENDIENTE_OPERATIVO", "AUTORIZADO"]
      : ["AUTORIZADO"];

  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    marca: string;
    categoria: string;
    categoria_id: string | null;
    estado: string;
    proveedor: string;
    cliente: string;
    vendedor: string | null;
    nro_pedido_fabrica: string | null;
    pares: string;
    fecha_embarque: string | null;
    quincena_arribo_id: string | null;
    fecha_creacion: string | null;
    evento_precio: string | null;
    precio_evento_id: string | null;
  }>(
    `
    SELECT ic.id, ic.numero_registro, ic.estado,
           ic.categoria_id::text AS categoria_id,
           mv.descp_marca AS marca,
           COALESCE(cat.descp_categoria, '—') AS categoria,
           pi.nombre AS proveedor,
           cv.descp_cliente AS cliente,
           COALESCE(NULLIF(TRIM(vd.descp_vendedor), ''), '—') AS vendedor,
           NULL::text AS nro_pedido_fabrica,
           ic.cantidad_total_pares AS pares,
           qa.descripcion AS fecha_embarque,
           ic.quincena_arribo_id::text AS quincena_arribo_id,
           ic.fecha_registro::text AS fecha_creacion,
           pe.nombre_evento AS evento_precio,
           ic.precio_evento_id
    FROM intencion_compra ic
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
    LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
    LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
    WHERE ic.estado = ANY($1::text[])
      AND NOT EXISTS (
        SELECT 1 FROM intencion_compra_pedido icp WHERE icp.intencion_compra_id = ic.id
      )
      AND ($2::int IS NULL OR ic.categoria_id = $2)
    ORDER BY COALESCE(ic.quincena_arribo_id, 9999) ASC, ic.numero_registro ASC
  `,
    [estados, categoriaId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    marca: r.marca,
    categoria: r.categoria,
    categoria_id: r.categoria_id != null ? Number(r.categoria_id) : null,
    estado: r.estado,
    proveedor: r.proveedor,
    cliente: r.cliente,
    vendedor: r.vendedor ?? "—",
    nro_pedido_fabrica: r.nro_pedido_fabrica?.trim() || null,
    pares: Number(r.pares ?? 0),
    fecha_embarque: r.fecha_embarque,
    quincena_arribo_id: r.quincena_arribo_id != null ? Number(r.quincena_arribo_id) : null,
    fecha_creacion: r.fecha_creacion,
    evento_precio: r.evento_precio,
    precio_evento_id: r.precio_evento_id ? Number(r.precio_evento_id) : null,
  }));
}

export async function listPpsEnProceso(pool: Pool, ramo?: RamoDigitacion): Promise<PpEnProceso[]> {
  const categoriaId = ramo ? categoriaIdFromRamo(ramo) : null;
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    estado_digitacion: string | null;
    pares_comprometidos: string | null;
    nro_factura_importacion: string | null;
    marcas: string;
    n_ics: string;
    quincena: string | null;
    quincena_arribo_id: string | null;
  }>(`
    SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_digitacion,
           pp.pares_comprometidos, pp.nro_factura_importacion,
           COALESCE(string_agg(DISTINCT mv.descp_marca, ', '), '—') AS marcas,
           COUNT(DISTINCT icp.intencion_compra_id)::text AS n_ics,
           COALESCE(
             pp.quincena_arribo_id,
             (SELECT ic0.quincena_arribo_id
              FROM intencion_compra_pedido icp0
              JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
              WHERE icp0.pedido_proveedor_id = pp.id
              ORDER BY ic0.numero_registro
              LIMIT 1)
           )::text AS quincena_arribo_id,
           COALESCE(
             qa.descripcion,
             (SELECT qa2.descripcion
              FROM intencion_compra_pedido icp_q
              JOIN intencion_compra ic_q ON ic_q.id = icp_q.intencion_compra_id
              JOIN quincena_arribo qa2 ON qa2.id = ic_q.quincena_arribo_id
              WHERE icp_q.pedido_proveedor_id = pp.id
              ORDER BY ic_q.numero_registro
              LIMIT 1),
             'Sin fecha de embarque'
           ) AS quincena
    FROM pedido_proveedor pp
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
    LEFT JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    WHERE pp.estado IN ('ABIERTO', 'CERRADO')
      AND COALESCE(pp.estado, '') != 'ENVIADO'
      AND COALESCE(pp.estado_digitacion, 'ABIERTO') != 'CERRADO'
      AND (
        $1::int IS NULL
        OR COALESCE(
          pp.categoria_id,
          (SELECT ic0.categoria_id
           FROM intencion_compra_pedido icp0
           JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
           WHERE icp0.pedido_proveedor_id = pp.id
           ORDER BY ic0.numero_registro
           LIMIT 1)
        ) = $1
      )
    GROUP BY pp.id, qa.descripcion
    ORDER BY
      COALESCE(
        pp.quincena_arribo_id,
        (SELECT ic_s.quincena_arribo_id
         FROM intencion_compra_pedido icp_s
         JOIN intencion_compra ic_s ON ic_s.id = icp_s.intencion_compra_id
         WHERE icp_s.pedido_proveedor_id = pp.id
         LIMIT 1),
        9999
      ) ASC,
      pp.numero_registro ASC
  `, [categoriaId]);

  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    pares_comprometidos: Number(r.pares_comprometidos ?? 0),
    nro_factura_importacion: r.nro_factura_importacion,
    marcas: r.marcas,
    n_ics: Number(r.n_ics ?? 0),
    quincena: r.quincena,
    quincena_arribo_id: r.quincena_arribo_id ? Number(r.quincena_arribo_id) : null,
  }));
}

export async function listIcsDePp(pool: Pool, ppId: number): Promise<IcDePp[]> {
  const { rows } = await pool.query<{
    ic_id: string;
    nro_ic: string;
    marca: string;
    proveedor: string;
    pares: string;
    nro_pedido_fabrica: string | null;
  }>(`
    SELECT ic.id AS ic_id, ic.numero_registro AS nro_ic,
           mv.descp_marca AS marca,
           COALESCE(pi.nombre, '—') AS proveedor,
           ic.cantidad_total_pares AS pares,
           icp.nro_pedido_fabrica
    FROM intencion_compra_pedido icp
    JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    LEFT JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    WHERE icp.pedido_proveedor_id = $1
    ORDER BY ic.numero_registro
  `, [ppId]);

  return rows.map((r) => ({
    ic_id: Number(r.ic_id),
    nro_ic: r.nro_ic,
    marca: r.marca,
    proveedor: r.proveedor,
    pares: Number(r.pares ?? 0),
    nro_pedido_fabrica: r.nro_pedido_fabrica,
  }));
}

export async function getIcAsignacion(pool: Pool, icId: number) {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    id_proveedor: string;
    categoria_id: string | null;
    pares: string;
    precio_evento_id: string | null;
    marca: string;
    categoria: string;
    proveedor: string;
    cliente: string;
    fecha_embarque: string | null;
  }>(`
    SELECT ic.id, ic.numero_registro, ic.id_proveedor, ic.categoria_id,
           ic.cantidad_total_pares AS pares, ic.precio_evento_id,
           mv.descp_marca AS marca,
           COALESCE(cat.descp_categoria, '—') AS categoria,
           pi.nombre AS proveedor,
           cv.descp_cliente AS cliente,
           qa.descripcion AS fecha_embarque
    FROM intencion_compra ic
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
    LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
    WHERE ic.id = $1
      AND (
        ic.estado = 'AUTORIZADO'
        OR (ic.estado = 'PENDIENTE_OPERATIVO' AND ic.categoria_id = $2)
      )
  `, [icId, CATEGORIA_PROGRAMADO_ID]);

  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    numero_registro: r.numero_registro,
    id_proveedor: Number(r.id_proveedor),
    categoria_id: r.categoria_id ? Number(r.categoria_id) : null,
    pares: Number(r.pares ?? 0),
    precio_evento_id: r.precio_evento_id ? Number(r.precio_evento_id) : null,
    marca: r.marca,
    categoria: r.categoria,
    proveedor: r.proveedor,
    cliente: r.cliente,
    fecha_embarque: r.fecha_embarque,
  };
}

export async function listPpsDigitacionCerrados(pool: Pool, ramo?: RamoDigitacion): Promise<PpEnProceso[]> {
  const categoriaId = ramo ? categoriaIdFromRamo(ramo) : null;
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    estado_digitacion: string | null;
    pares_comprometidos: string | null;
    nro_factura_importacion: string | null;
    marcas: string;
    n_ics: string;
    quincena: string | null;
    quincena_arribo_id: string | null;
  }>(`
    SELECT pp.id, pp.numero_registro, pp.estado, pp.estado_digitacion,
           pp.pares_comprometidos, pp.nro_factura_importacion,
           COALESCE(string_agg(DISTINCT mv.descp_marca, ', '), '—') AS marcas,
           COUNT(DISTINCT icp.intencion_compra_id)::text AS n_ics,
           COALESCE(
             pp.quincena_arribo_id,
             (SELECT ic0.quincena_arribo_id
              FROM intencion_compra_pedido icp0
              JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
              WHERE icp0.pedido_proveedor_id = pp.id
              ORDER BY ic0.numero_registro
              LIMIT 1)
           )::text AS quincena_arribo_id,
           COALESCE(
             qa.descripcion,
             (SELECT qa2.descripcion
              FROM intencion_compra_pedido icp_q
              JOIN intencion_compra ic_q ON ic_q.id = icp_q.intencion_compra_id
              JOIN quincena_arribo qa2 ON qa2.id = ic_q.quincena_arribo_id
              WHERE icp_q.pedido_proveedor_id = pp.id
              ORDER BY ic_q.numero_registro
              LIMIT 1),
             'Sin fecha de embarque'
           ) AS quincena
    FROM pedido_proveedor pp
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
    LEFT JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    WHERE pp.estado IN ('ABIERTO', 'CERRADO')
      AND pp.estado_digitacion = 'CERRADO'
      AND (
        $1::int IS NULL
        OR COALESCE(
          pp.categoria_id,
          (SELECT ic0.categoria_id
           FROM intencion_compra_pedido icp0
           JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
           WHERE icp0.pedido_proveedor_id = pp.id
           ORDER BY ic0.numero_registro
           LIMIT 1)
        ) = $1
      )
    GROUP BY pp.id, qa.descripcion
    ORDER BY
      COALESCE(
        pp.quincena_arribo_id,
        (SELECT ic_s.quincena_arribo_id
         FROM intencion_compra_pedido icp_s
         JOIN intencion_compra ic_s ON ic_s.id = icp_s.intencion_compra_id
         WHERE icp_s.pedido_proveedor_id = pp.id
         LIMIT 1),
        9999
      ) ASC,
      pp.numero_registro ASC
  `, [categoriaId]);

  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
    estado_digitacion: r.estado_digitacion,
    pares_comprometidos: Number(r.pares_comprometidos ?? 0),
    nro_factura_importacion: r.nro_factura_importacion,
    marcas: r.marcas,
    n_ics: Number(r.n_ics ?? 0),
    quincena: r.quincena,
    quincena_arribo_id: r.quincena_arribo_id ? Number(r.quincena_arribo_id) : null,
  }));
}

/** Agrupa PP digitación por FECHA DE EMBARQUE (misma lógica que Pedido proveedor). */
export function groupPpDigitacionPorQuincena(pps: PpEnProceso[]): PpDigitacionQuincenaGrupo[] {
  const map = new Map<string, PpDigitacionQuincenaGrupo>();

  for (const p of pps) {
    const quincena = p.quincena?.trim() || "Sin fecha de embarque";
    const key = p.quincena_arribo_id != null ? `q-${p.quincena_arribo_id}` : `z-${quincena}`;

    let g = map.get(key);
    if (!g) {
      g = {
        key,
        quincena,
        quincena_arribo_id: p.quincena_arribo_id,
        pps: [],
        n_preventas: 0,
        total_pares: 0,
      };
      map.set(key, g);
    }
    g.pps.push(p);
    g.n_preventas += 1;
    g.total_pares += p.pares_comprometidos;
  }

  const grupos = [...map.values()];
  grupos.sort((a, b) => {
    const sa = a.quincena_arribo_id ?? 9999;
    const sb = b.quincena_arribo_id ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.quincena.localeCompare(b.quincena, "es");
  });

  return grupos;
}

/** Agrupa IC pendientes digitación por FECHA DE EMBARQUE · contadores pares + clientes. */
export function groupIcPendientesPorEmbarque(ics: IcDigitacionPendiente[]): IcPendienteEmbarqueGrupo[] {
  const map = new Map<string, IcPendienteEmbarqueGrupo>();

  for (const ic of ics) {
    const quincena = ic.fecha_embarque?.trim() || "Sin fecha de embarque";
    const key = ic.quincena_arribo_id != null ? `q-${ic.quincena_arribo_id}` : `z-${quincena}`;

    let g = map.get(key);
    if (!g) {
      g = {
        key,
        quincena,
        quincena_arribo_id: ic.quincena_arribo_id,
        ics: [],
        n_ics: 0,
        n_clientes: 0,
        total_pares: 0,
      };
      map.set(key, g);
    }
    g.ics.push(ic);
    g.n_ics += 1;
    g.total_pares += ic.pares || 0;
  }

  for (const g of map.values()) {
    g.n_clientes = new Set(g.ics.map((ic) => ic.cliente)).size;
  }

  const grupos = [...map.values()];
  grupos.sort((a, b) => {
    const sa = a.quincena_arribo_id ?? 9999;
    const sb = b.quincena_arribo_id ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.quincena.localeCompare(b.quincena, "es");
  });

  return grupos;
}

export async function listPpsAbiertosSelector(pool: Pool, categoriaId?: number | null) {
  const { rows } = await pool.query<{ id: string; numero_registro: string; marcas: string; pares: string }>(
    `
    SELECT pp.id, pp.numero_registro,
           COALESCE(string_agg(DISTINCT mv.descp_marca, ', '), '—') AS marcas,
           COALESCE(pp.pares_comprometidos, 0)::text AS pares
    FROM pedido_proveedor pp
    LEFT JOIN intencion_compra_pedido icp ON icp.pedido_proveedor_id = pp.id
    LEFT JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    WHERE pp.estado = 'ABIERTO'
      AND COALESCE(pp.estado_digitacion, 'ABIERTO') != 'CERRADO'
      AND (
        $1::int IS NULL
        OR COALESCE(
          pp.categoria_id,
          (SELECT ic0.categoria_id
           FROM intencion_compra_pedido icp0
           JOIN intencion_compra ic0 ON ic0.id = icp0.intencion_compra_id
           WHERE icp0.pedido_proveedor_id = pp.id
           ORDER BY ic0.numero_registro
           LIMIT 1)
        ) = $1
      )
    GROUP BY pp.id
    ORDER BY pp.numero_registro DESC
  `,
    [categoriaId ?? null],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    label: `${r.numero_registro} · ${r.marcas} · ${Number(r.pares).toLocaleString("es-PY")} pares`,
  }));
}
