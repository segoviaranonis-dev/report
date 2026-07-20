import type { Pool } from "pg";
import type { EntidadAmLogistica } from "./constants";
import { etiquetaComprador } from "@/lib/clientes/etiqueta-comprador";

export type LogisticaPendienteRow = {
  id: number;
  factura_interna_id: number;
  pedido_proveedor_id: number;
  entidad_am: EntidadAmLogistica;
  fecha_orden: string;
  id_cliente: number;
  id_cadena: number | null;
  id_vendedor: number | null;
  pares: number;
  cajas: number;
  monto_neto: number | null;
  nro_factura: string | null;
  fecha_entrega_vendedor: string | null;
  estado: string;
  cliente: string;
  cadena: string | null;
  vendedor: string;
  pp_numero: string;
  etiqueta_cadena: string;
};

export type LogisticaGrupoCliente = {
  id_cliente: number;
  cliente: string;
  filas: LogisticaPendienteRow[];
  cajas: number;
};

export type LogisticaGrupoCadena = {
  key: string;
  cadena_label: string;
  clientes: LogisticaGrupoCliente[];
  cajas: number;
};

export async function listLogisticaPendientes(
  pool: Pool,
  opts?: { vendedorId?: number | null; estado?: "PENDIENTE" | "CONFIRMADA" | "TODOS" },
): Promise<LogisticaPendienteRow[]> {
  const estado = opts?.estado ?? "PENDIENTE";
  const vendedorId = opts?.vendedorId ?? null;

  const { rows } = await pool.query<{
    id: string;
    factura_interna_id: string;
    pedido_proveedor_id: string;
    entidad_am: EntidadAmLogistica;
    fecha_orden: string;
    id_cliente: string;
    id_cadena: string | null;
    id_vendedor: string | null;
    pares: string;
    cajas: string;
    monto_neto: string | null;
    nro_factura: string | null;
    fecha_entrega_vendedor: string | null;
    estado: string;
    cliente: string;
    cadena: string | null;
    vendedor: string;
    pp_numero: string;
  }>(
    `
    SELECT l.id, l.factura_interna_id, l.pedido_proveedor_id, l.entidad_am,
           l.fecha_orden::text, l.id_cliente::text, l.id_cadena::text, l.id_vendedor::text,
           l.pares::text,
           COALESCE((
             SELECT SUM(fid.cajas)::int
             FROM factura_interna_detalle fid
             WHERE fid.factura_id = l.factura_interna_id
           ), 0)::text AS cajas,
           l.monto_neto::text, l.nro_factura, l.fecha_entrega_vendedor::text,
           l.estado,
           cv.descp_cliente AS cliente,
           cad.descp_cadena AS cadena,
           COALESCE(vd.descp_vendedor, '—') AS vendedor,
           pp.numero_registro AS pp_numero
    FROM logistica_pendiente_confirmacion l
    JOIN cliente_v2 cv ON cv.id_cliente = l.id_cliente
    JOIN pedido_proveedor pp ON pp.id = l.pedido_proveedor_id
    LEFT JOIN cadena_v2 cad ON cad.id_cadena = l.id_cadena
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
    WHERE ($1 = 'TODOS' OR l.estado = $1)
      AND ($2::int IS NULL OR l.id_vendedor = $2)
    ORDER BY
      CASE l.entidad_am WHEN 'PE' THEN 0 WHEN 'CP' THEN 1 WHEN 'PROGRAMADO' THEN 2 ELSE 3 END,
      l.fecha_orden ASC NULLS LAST,
      cad.descp_cadena NULLS LAST,
      cv.descp_cliente,
      l.nro_factura
    `,
    [estado, vendedorId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    factura_interna_id: Number(r.factura_interna_id),
    pedido_proveedor_id: Number(r.pedido_proveedor_id),
    entidad_am: r.entidad_am,
    fecha_orden: r.fecha_orden?.slice(0, 10) ?? "",
    id_cliente: Number(r.id_cliente),
    id_cadena: r.id_cadena != null ? Number(r.id_cadena) : null,
    id_vendedor: r.id_vendedor != null ? Number(r.id_vendedor) : null,
    pares: Number(r.pares ?? 0),
    cajas: Number(r.cajas ?? 0),
    monto_neto: r.monto_neto != null ? Number(r.monto_neto) : null,
    nro_factura: r.nro_factura,
    fecha_entrega_vendedor: r.fecha_entrega_vendedor?.slice(0, 10) ?? null,
    estado: r.estado,
    cliente: r.cliente,
    cadena: r.cadena,
    vendedor: r.vendedor,
    pp_numero: r.pp_numero,
    etiqueta_cadena: etiquetaComprador(r.cadena, r.cliente),
  }));
}

export function groupLogisticaPorCadenaCliente(filas: LogisticaPendienteRow[]): LogisticaGrupoCadena[] {
  const byCadena = new Map<string, LogisticaGrupoCadena>();

  for (const f of filas) {
    const key = f.id_cadena != null ? `c-${f.id_cadena}` : `z-${f.etiqueta_cadena}`;
    let g = byCadena.get(key);
    if (!g) {
      g = {
        key,
        cadena_label: f.cadena?.trim() || f.etiqueta_cadena,
        clientes: [],
        cajas: 0,
      };
      byCadena.set(key, g);
    }
    g.cajas += f.cajas;

    let c = g.clientes.find((x) => x.id_cliente === f.id_cliente);
    if (!c) {
      c = { id_cliente: f.id_cliente, cliente: f.cliente, filas: [], cajas: 0 };
      g.clientes.push(c);
    }
    c.filas.push(f);
    c.cajas += f.cajas;
  }

  return [...byCadena.values()].sort((a, b) => a.cadena_label.localeCompare(b.cadena_label, "es"));
}

export type LogisticaGrupoVendedor = {
  key: string;
  id_vendedor: number | null;
  vendedor_label: string;
  cadenas: LogisticaGrupoCadena[];
  cajas: number;
  n_fi: number;
};

/** Vista vendedor: acordeón vendedor → cadena → cliente */
export function groupLogisticaPorVendedorCadenaCliente(filas: LogisticaPendienteRow[]): LogisticaGrupoVendedor[] {
  const byVendedor = new Map<string, LogisticaPendienteRow[]>();

  for (const f of filas) {
    const vKey = f.id_vendedor != null ? `v-${f.id_vendedor}` : `z-${(f.vendedor || "—").trim()}`;
    const bucket = byVendedor.get(vKey) ?? [];
    bucket.push(f);
    byVendedor.set(vKey, bucket);
  }

  return [...byVendedor.values()]
    .map((subset) => {
      const head = subset[0];
      const vKey = head.id_vendedor != null ? `v-${head.id_vendedor}` : `z-${(head.vendedor || "—").trim()}`;
      return {
        key: vKey,
        id_vendedor: head.id_vendedor,
        vendedor_label: head.vendedor?.trim() || "—",
        cadenas: groupLogisticaPorCadenaCliente(subset),
        cajas: subset.reduce((s, f) => s + f.cajas, 0),
        n_fi: subset.length,
      };
    })
    .sort((a, b) => a.vendedor_label.localeCompare(b.vendedor_label, "es"));
}

export async function confirmarEntregaVendedor(
  pool: Pool,
  pendienteId: number,
  fechaEntrega: string,
  usuarioId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const fecha = fechaEntrega?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "Fecha de entrega inválida." };
  }

  const { rowCount } = await pool.query(
    `
    UPDATE logistica_pendiente_confirmacion SET
      fecha_entrega_vendedor = $2::date,
      estado = 'CONFIRMADA',
      confirmado_at = now(),
      confirmado_por = $3,
      updated_at = now()
    WHERE id = $1 AND estado = 'PENDIENTE'
    `,
    [pendienteId, fecha, usuarioId],
  );
  if (!rowCount) return { ok: false, error: "Pendiente no encontrado o ya confirmado." };
  return { ok: true };
}
