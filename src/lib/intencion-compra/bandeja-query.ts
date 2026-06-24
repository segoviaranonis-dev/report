import type { Pool } from "pg";

export type IcBandejaRow = {
  id: number;
  numero_registro: string;
  estado: string;
  ubicacion: string;
  proveedor: string;
  marca: string;
  cliente: string;
  tipo: string;
  categoria: string;
  pares: number | null;
  monto_neto: number | null;
  evento_precio: string | null;
  fecha_registro: string | null;
  fecha_llegada: string | null;
  quincena_arribo_id: number | null;
  fecha_embarque: string | null;
  pp_id: number | null;
  pp_nro: string | null;
  pp_estado: string | null;
  nro_pedido_fabrica: string | null;
};

const UBICACION: Record<string, string> = {
  PENDIENTE_OPERATIVO: "Bandeja IC · editable",
  AUTORIZADO: "Esperando Digitación",
  DIGITADO: "En Pedido Proveedor",
  DEVUELTO_ADMIN: "Bandeja IC · DEVUELTAS",
  ANULADO: "Anulada",
};

export function ubicacionIc(row: {
  estado: string;
  pp_id: number | null;
  pp_nro: string | null;
  pp_estado: string | null;
  nro_pedido_fabrica: string | null;
}): string {
  if (row.estado === "AUTORIZADO") return UBICACION.AUTORIZADO;
  if (row.estado === "PENDIENTE_OPERATIVO") return UBICACION.PENDIENTE_OPERATIVO;
  if (row.estado === "DIGITADO" && row.pp_id) {
    const enviado = row.pp_estado === "ENVIADO" ? " · Compra legal" : "";
    return `PP ${row.pp_nro} (${row.pp_estado}${enviado})`;
  }
  if (row.estado === "DIGITADO") return "DIGITADO sin PP";
  return UBICACION[row.estado] ?? row.estado;
}

export function parseIcSeq(numero: string): number {
  const m = numero.match(/^IC-\d{4}-(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

export function parsePpSeq(ppNro: string | null): number {
  if (!ppNro) return 0;
  const m = ppNro.match(/^PP-\d{4}-(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

export async function listIcBandeja(pool: Pool): Promise<IcBandejaRow[]> {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
    fecha_registro: Date | null;
    fecha_llegada: Date | null;
    quincena_arribo_id: string | null;
    fecha_embarque: string | null;
    pares: number | null;
    monto_neto: string | null;
    proveedor: string;
    marca: string;
    cliente: string;
    tipo: string;
    categoria: string;
    evento_precio: string | null;
    nro_pedido_fabrica: string | null;
    pp_id: string | null;
    pp_nro: string | null;
    pp_estado: string | null;
  }>(`
    SELECT
      ic.id,
      ic.numero_registro,
      ic.estado,
      ic.fecha_registro,
      ic.fecha_llegada,
      ic.quincena_arribo_id,
      qa.descripcion AS fecha_embarque,
      ic.cantidad_total_pares AS pares,
      ic.monto_neto,
      pi.nombre AS proveedor,
      mv.descp_marca AS marca,
      cv.descp_cliente AS cliente,
      COALESCE(tv.descp_tipo, '—') AS tipo,
      COALESCE(cat.descp_categoria, '—') AS categoria,
      pe.nombre_evento AS evento_precio,
      icp.nro_pedido_fabrica,
      pp.id AS pp_id,
      pp.numero_registro AS pp_nro,
      pp.estado AS pp_estado
    FROM intencion_compra ic
    JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    LEFT JOIN tipo_v2 tv ON tv.id_tipo = ic.tipo_id
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
    LEFT JOIN precio_evento pe ON pe.id = ic.precio_evento_id
    LEFT JOIN quincena_arribo qa ON qa.id = ic.quincena_arribo_id
    LEFT JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id
    LEFT JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
    ORDER BY ic.id ASC
  `);

  const byId = new Map<number, (typeof rows)[0]>();
  for (const r of rows) byId.set(Number(r.id), r);

  return [...byId.values()].map((r) => {
    const pp_id = r.pp_id ? Number(r.pp_id) : null;
    return {
      id: Number(r.id),
      numero_registro: r.numero_registro,
      estado: r.estado,
      ubicacion: ubicacionIc({
        estado: r.estado,
        pp_id,
        pp_nro: r.pp_nro,
        pp_estado: r.pp_estado,
        nro_pedido_fabrica: r.nro_pedido_fabrica,
      }),
      proveedor: r.proveedor,
      marca: r.marca,
      cliente: r.cliente,
      tipo: r.tipo,
      categoria: r.categoria,
      pares: r.pares,
      monto_neto: r.monto_neto != null ? Number(r.monto_neto) : null,
      evento_precio: r.evento_precio,
      fecha_registro: r.fecha_registro?.toISOString().slice(0, 10) ?? null,
      fecha_llegada: r.fecha_llegada?.toISOString().slice(0, 10) ?? null,
      quincena_arribo_id: r.quincena_arribo_id ? Number(r.quincena_arribo_id) : null,
      fecha_embarque: r.fecha_embarque,
      pp_id,
      pp_nro: r.pp_nro,
      pp_estado: r.pp_estado,
      nro_pedido_fabrica: r.nro_pedido_fabrica,
    };
  });
}
