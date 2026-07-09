import type { Pool } from "pg";

export type IcPendienteRow = {
  id: number;
  numero_registro: string;
  tipo_id: number | null;
  tipo: string;
  categoria_id: number | null;
  categoria: string;
  id_marca: number;
  marca: string;
  proveedor: string;
  id_cliente: number;
  cliente: string;
  vendedor: string;
  quincena_arribo_id: number | null;
  fecha_embarque: string | null;
  pares: number;
  monto_neto: number;
  precio_evento_id: number | null;
  evento_precio: string | null;
  listado_precio_id: number | null;
  nota_pedido: string | null;
};

const IC_SELECT = `
  SELECT ic.id, ic.numero_registro,
         ic.tipo_id, COALESCE(tv.descp_tipo, '—') AS tipo,
         ic.categoria_id, COALESCE(cv2.descp_categoria, '—') AS categoria,
         ic.id_marca, mv.descp_marca AS marca,
         pi2.nombre AS proveedor,
         ic.id_cliente,
         cv.descp_cliente AS cliente,
         vv.descp_vendedor AS vendedor,
         ic.quincena_arribo_id,
         qa.descripcion AS fecha_embarque,
         ic.cantidad_total_pares AS pares,
         ic.monto_neto,
         ic.precio_evento_id,
         pe.nombre_evento AS evento_precio,
         ic.listado_precio_id,
         ic.nota_pedido
  FROM intencion_compra ic
  JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
  JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
  JOIN vendedor_v2 vv ON vv.id_vendedor = ic.id_vendedor
  JOIN proveedor_importacion pi2 ON pi2.id = ic.id_proveedor
  LEFT JOIN tipo_v2 tv ON tv.id_tipo = ic.tipo_id
  LEFT JOIN categoria_v2 cv2 ON cv2.id_categoria = ic.categoria_id
  LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
  LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
`;

function mapRow(r: Record<string, unknown>): IcPendienteRow {
  return {
    id: Number(r.id),
    numero_registro: String(r.numero_registro),
    tipo_id: r.tipo_id != null ? Number(r.tipo_id) : null,
    tipo: String(r.tipo),
    categoria_id: r.categoria_id != null ? Number(r.categoria_id) : null,
    categoria: String(r.categoria),
    id_marca: Number(r.id_marca),
    marca: String(r.marca),
    proveedor: String(r.proveedor),
    id_cliente: Number(r.id_cliente),
    cliente: String(r.cliente),
    vendedor: String(r.vendedor),
    quincena_arribo_id: r.quincena_arribo_id != null ? Number(r.quincena_arribo_id) : null,
    fecha_embarque: r.fecha_embarque != null ? String(r.fecha_embarque) : null,
    pares: Number(r.pares ?? 0),
    monto_neto: Number(r.monto_neto ?? 0),
    precio_evento_id: r.precio_evento_id != null ? Number(r.precio_evento_id) : null,
    evento_precio: r.evento_precio != null ? String(r.evento_precio) : null,
    listado_precio_id: r.listado_precio_id != null ? Number(r.listado_precio_id) : null,
    nota_pedido: r.nota_pedido != null ? String(r.nota_pedido) : null,
  };
}

export async function listIcPendientes(pool: Pool): Promise<IcPendienteRow[]> {
  const { rows } = await pool.query(`${IC_SELECT} WHERE ic.estado = 'PENDIENTE_OPERATIVO'
    ORDER BY ic.numero_registro ASC`);
  return rows.map(mapRow);
}

export type IcDevueltaRow = IcPendienteRow & {
  motivo_devolucion: string | null;
  devuelto_at: string | null;
};

export async function listIcDevueltas(pool: Pool): Promise<IcDevueltaRow[]> {
  const { rows } = await pool.query(
    `${IC_SELECT}, ic.motivo_devolucion, ic.devuelto_at
     WHERE ic.estado = 'DEVUELTO_ADMIN'
     ORDER BY ic.devuelto_at DESC NULLS LAST, ic.numero_registro ASC`,
  );
  return rows.map((r) => ({
    ...mapRow(r),
    motivo_devolucion: r.motivo_devolucion != null ? String(r.motivo_devolucion) : null,
    devuelto_at: r.devuelto_at ? new Date(String(r.devuelto_at)).toISOString().slice(0, 16).replace("T", " ") : null,
  }));
}

export type IcHistorialRow = {
  numero_registro: string;
  tipo: string;
  categoria: string;
  marca: string;
  cliente: string;
  vendedor: string;
  fecha_embarque: string | null;
  pares: number;
  monto_neto: number;
  evento_precio: string | null;
  estado: string;
};

export async function listIcHistorial(pool: Pool): Promise<IcHistorialRow[]> {
  const { rows } = await pool.query<{
    numero_registro: string;
    tipo: string;
    categoria: string;
    marca: string;
    cliente: string;
    vendedor: string;
    fecha_embarque: string | null;
    pares: string | null;
    monto_neto: string | null;
    evento_precio: string | null;
    estado: string;
  }>(`
    SELECT ic.numero_registro,
           COALESCE(tv.descp_tipo, '—') AS tipo,
           COALESCE(cv2.descp_categoria, '—') AS categoria,
           mv.descp_marca AS marca,
           cv.descp_cliente AS cliente,
           vv.descp_vendedor AS vendedor,
           qa.descripcion AS fecha_embarque,
           ic.cantidad_total_pares AS pares,
           ic.monto_neto,
           pe.nombre_evento AS evento_precio,
           ic.estado
    FROM intencion_compra ic
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    JOIN vendedor_v2 vv ON vv.id_vendedor = ic.id_vendedor
    LEFT JOIN tipo_v2 tv ON tv.id_tipo = ic.tipo_id
    LEFT JOIN categoria_v2 cv2 ON cv2.id_categoria = ic.categoria_id
    LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
    LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
    WHERE ic.estado != 'PENDIENTE_OPERATIVO'
    ORDER BY ic.quincena_arribo_id DESC NULLS LAST, ic.numero_registro DESC
  `);

  return rows.map((r) => ({
    numero_registro: r.numero_registro,
    tipo: r.tipo,
    categoria: r.categoria,
    marca: r.marca,
    cliente: r.cliente,
    vendedor: r.vendedor,
    fecha_embarque: r.fecha_embarque,
    pares: Number(r.pares ?? 0),
    monto_neto: Number(r.monto_neto ?? 0),
    evento_precio: r.evento_precio,
    estado: r.estado,
  }));
}
