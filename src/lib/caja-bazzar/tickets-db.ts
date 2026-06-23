import { getRimecPool } from "@/lib/rimec/pool";
import { getCajaTienda } from "./tiendas";

export type TicketPosRow = {
  codigo_ticket: string;
  cliente_id: number;
  tienda_label: string;
  marca: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  cedula_cliente: string | null;
  grada: string;
  estado: string;
  created_at: string;
  staging_id: number | null;
  linea_codigo: string | null;
  referencia_codigo: string | null;
  material_code: string | null;
  color_code: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  imagen_url: string | null;
  descp_material: string | null;
  descp_color: string | null;
};

export type TicketsQuery = {
  clienteId?: number;
  vendedorId?: number;
  estado?: string | null;
  cedula?: string | null;
  desde: Date;
  hasta?: Date | null;
  limit: number;
  offset: number;
  allowedClienteIds?: number[];
};

export function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function tablaTicketsExiste(): Promise<boolean> {
  const pool = getRimecPool();
  const r = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.ticket_venta_pos') IS NOT NULL AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

function buildWhere(q: TicketsQuery, alias?: string): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [];
  const c = (col: string) => (alias ? `${alias}.${col}` : col);

  if (q.allowedClienteIds?.length) {
    params.push(q.allowedClienteIds);
    where.push(`${c("cliente_id")} = ANY($${params.length}::int[])`);
  }

  if (q.clienteId != null) {
    params.push(q.clienteId);
    where.push(`${c("cliente_id")} = $${params.length}`);
  }
  if (q.vendedorId != null) {
    params.push(q.vendedorId);
    where.push(`${c("vendedor_id")} = $${params.length}`);
  }
  if (q.estado?.trim()) {
    params.push(q.estado.trim().toUpperCase());
    where.push(`upper(btrim(${c("estado")})) = $${params.length}`);
  }
  if (q.cedula?.replace(/\D/g, "").trim()) {
    params.push(q.cedula.replace(/\D/g, "").trim());
    where.push(`${c("cedula_cliente")} = $${params.length}`);
  }
  params.push(q.desde.toISOString());
  where.push(`${c("created_at")} >= $${params.length}::timestamptz`);
  if (q.hasta) {
    params.push(q.hasta.toISOString());
    where.push(`${c("created_at")} < $${params.length}::timestamptz`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

type DbRow = {
  codigo_ticket: string;
  cliente_id: number;
  marca: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  cedula_cliente: string | null;
  grada: string;
  estado: string;
  created_at: Date;
  staging_id: number | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  snapshot_json: Record<string, unknown> | null;
  cb_nombre: string | null;
  cb_apellido: string | null;
  cb_razon_social: string | null;
  st_snapshot_cliente: Record<string, unknown> | null;
  sl_snapshot_json: Record<string, unknown> | null;
};

export function titularClientePos(row: {
  nombre_cliente?: string | null;
  cb_nombre?: string | null;
  cb_apellido?: string | null;
  cb_razon_social?: string | null;
  st_snapshot_cliente?: Record<string, unknown> | null;
  cedula_cliente?: string | null;
}): string {
  const rs = row.cb_razon_social?.trim();
  if (rs) return rs;

  const cbParts = [row.cb_nombre?.trim(), row.cb_apellido?.trim()].filter(Boolean);
  if (cbParts.length) return cbParts.join(" ");

  const st = row.st_snapshot_cliente ?? {};
  const stRs = typeof st.razon_social === "string" ? st.razon_social.trim() : "";
  if (stRs) return stRs;
  const stParts = [
    typeof st.nombre === "string" ? st.nombre.trim() : "",
    typeof st.apellido === "string" ? st.apellido.trim() : "",
  ].filter(Boolean);
  if (stParts.length) return stParts.join(" ");

  if (row.nombre_cliente?.trim()) return row.nombre_cliente.trim();

  return row.cedula_cliente?.trim() ? `CI ${row.cedula_cliente}` : "Cliente sin nombre";
}

function mapRow(row: DbRow): TicketPosRow {
  const snap = row.snapshot_json ?? {};
  const lineSnap = row.sl_snapshot_json ?? {};
  const mergedSnap = { ...lineSnap, ...snap };
  const nombre = titularClientePos({
    nombre_cliente:
      [snap.nombre_cliente, snap.apellido_cliente].filter((x) => typeof x === "string" && x).join(" ") ||
      (typeof snap.nombre_cliente === "string" ? snap.nombre_cliente : null),
    cb_nombre: row.cb_nombre,
    cb_apellido: row.cb_apellido,
    cb_razon_social: row.cb_razon_social,
    st_snapshot_cliente: row.st_snapshot_cliente,
    cedula_cliente: row.cedula_cliente,
  });
  return {
    codigo_ticket: row.codigo_ticket,
    cliente_id: row.cliente_id,
    tienda_label: getCajaTienda(row.cliente_id)?.label ?? String(row.cliente_id),
    marca: row.marca,
    vendedor_id: row.vendedor_id,
    vendedor_nombre: row.vendedor_nombre,
    cedula_cliente: row.cedula_cliente,
    grada: row.grada,
    estado: row.estado,
    created_at: row.created_at.toISOString(),
    staging_id: row.staging_id,
    linea_codigo: typeof mergedSnap.linea_codigo === "string" ? mergedSnap.linea_codigo : null,
    referencia_codigo: typeof mergedSnap.referencia_codigo === "string" ? mergedSnap.referencia_codigo : null,
    material_code: typeof mergedSnap.material_code === "string" ? mergedSnap.material_code : null,
    color_code: typeof mergedSnap.color_code === "string" ? mergedSnap.color_code : null,
    linea_id: row.linea_id,
    referencia_id: row.referencia_id,
    material_id: row.material_id,
    color_id: row.color_id,
    nombre_cliente: nombre || null,
    telefono_cliente: typeof mergedSnap.telefono_cliente === "string" ? mergedSnap.telefono_cliente : null,
    imagen_url: typeof mergedSnap.imagen_url === "string" ? mergedSnap.imagen_url : null,
    descp_material: typeof mergedSnap.descp_material === "string" ? mergedSnap.descp_material : null,
    descp_color: typeof mergedSnap.descp_color === "string" ? mergedSnap.descp_color : null,
  };
}

export async function queryTickets(q: TicketsQuery): Promise<{
  tickets: TicketPosRow[];
  total: number;
  pares: number;
}> {
  const pool = getRimecPool();
  const { whereSql, params } = buildWhere(q, "t");

  const countR = await pool.query<{ total: string; pares: string }>(
    `
      SELECT COUNT(*)::text AS total, COALESCE(SUM(t.cantidad), 0)::text AS pares
      FROM public.ticket_venta_pos t
      ${whereSql}
    `,
    params,
  );

  const listParams = [...params, q.limit, q.offset];
  const limitIdx = listParams.length - 1;
  const offsetIdx = listParams.length;

  const listR = await pool.query<DbRow>(
    `
      SELECT
        t.codigo_ticket, t.cliente_id, t.marca, t.vendedor_id, t.vendedor_nombre,
        t.cedula_cliente, t.grada, t.cantidad, t.estado, t.created_at, t.staging_id,
        t.linea_id, t.referencia_id, t.material_id, t.color_id, t.snapshot_json,
        cb.nombre AS cb_nombre, cb.apellido AS cb_apellido, cb.razon_social AS cb_razon_social,
        st.snapshot_cliente AS st_snapshot_cliente,
        sl.snapshot_json AS sl_snapshot_json
      FROM public.ticket_venta_pos t
      LEFT JOIN public.clients_bazaar cb ON cb.cedula = t.cedula_cliente
      LEFT JOIN public.ticket_pos_staging st ON st.id = t.staging_id
      LEFT JOIN public.ticket_pos_staging_linea sl ON sl.staging_id = t.staging_id
        AND sl.linea_id = t.linea_id
        AND sl.referencia_id = t.referencia_id
        AND sl.material_id = t.material_id
        AND sl.color_id = t.color_id
        AND sl.grada::text = t.grada::text
        AND sl.activo = true
      ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listParams,
  );

  return {
    tickets: listR.rows.map(mapRow),
    total: Number(countR.rows[0]?.total ?? 0),
    pares: Number(countR.rows[0]?.pares ?? 0),
  };
}

export async function queryHubStats(clienteIds: number[]): Promise<
  Record<number, { pares_hoy: number; emitidos: number; facturados: number; pendientes: number }>
> {
  const pool = getRimecPool();
  const desde = startOfTodayUtc();
  const out: Record<number, { pares_hoy: number; emitidos: number; facturados: number; pendientes: number }> = {};
  for (const id of clienteIds) {
    out[id] = { pares_hoy: 0, emitidos: 0, facturados: 0, pendientes: 0 };
  }

  if (!clienteIds.length || !(await tablaTicketsExiste())) return out;

  const r = await pool.query<{
    cliente_id: number;
    pares: string;
    emitidos: string;
    facturados: string;
    pendientes: string;
  }>(
    `
      SELECT
        cliente_id,
        COALESCE(SUM(cantidad), 0)::text AS pares,
        COUNT(*)::text AS emitidos,
        COUNT(*) FILTER (WHERE upper(btrim(estado)) = 'FACTURADO')::text AS facturados,
        COUNT(*) FILTER (WHERE upper(btrim(estado)) = 'EMITIDO')::text AS pendientes
      FROM public.ticket_venta_pos
      WHERE cliente_id = ANY($1::int[])
        AND created_at >= $2::timestamptz
      GROUP BY cliente_id
    `,
    [clienteIds, desde.toISOString()],
  );

  for (const row of r.rows) {
    out[row.cliente_id] = {
      pares_hoy: Number(row.pares),
      emitidos: Number(row.emitidos),
      facturados: Number(row.facturados),
      pendientes: Number(row.pendientes),
    };
  }
  return out;
}

export async function marcarFacturados(
  codigos: string[],
  clienteId: number,
): Promise<{ updated: number }> {
  const pool = getRimecPool();
  const r = await pool.query(
    `
      UPDATE public.ticket_venta_pos
      SET estado = 'FACTURADO'
      WHERE codigo_ticket = ANY($1::text[])
        AND cliente_id = $2
        AND upper(btrim(estado)) = 'EMITIDO'
    `,
    [codigos, clienteId],
  );
  return { updated: r.rowCount ?? 0 };
}

export function ticketToCsvRow(t: TicketPosRow): string[] {
  const esNuevo = t.cedula_cliente && !t.nombre_cliente ? "SI" : "NO";
  return [
    t.codigo_ticket,
    String(t.cliente_id),
    t.tienda_label,
    t.cedula_cliente ?? "",
    esNuevo,
    t.nombre_cliente ?? "",
    t.telefono_cliente ?? "",
    t.linea_codigo ?? "",
    t.referencia_codigo ?? "",
    t.material_code ?? "",
    t.color_code ?? "",
    String(t.linea_id ?? ""),
    String(t.referencia_id ?? ""),
    String(t.material_id ?? ""),
    String(t.color_id ?? ""),
    t.grada,
    "1",
    t.marca,
    t.vendedor_nombre ?? "",
    t.created_at,
    t.estado,
  ];
}

export const CSV_HEADERS = [
  "codigo_ticket",
  "cliente_id",
  "tienda_label",
  "cedula_cliente",
  "es_cliente_nuevo",
  "nombre_cliente",
  "telefono_cliente",
  "linea_codigo",
  "referencia_codigo",
  "material_code",
  "color_code",
  "linea_id",
  "referencia_id",
  "material_id",
  "color_id",
  "grada",
  "cantidad",
  "marca",
  "vendedor_nombre",
  "created_at",
  "estado",
];

export function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
