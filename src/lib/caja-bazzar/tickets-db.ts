import { getRimecPool } from "@/lib/rimec/pool";
import { getCajaTienda } from "./tiendas";
import {
  codigoColumn,
  estadosFiltroBd,
  fuentePorEstadoApi,
  TABLA_BANDEJA,
  TABLA_BOBINA,
  TABLA_LEGACY,
  type FuentePos,
} from "./pos-tables";
import { tablaBandejaExiste, tablaBobedaExiste } from "./handoff-bobeda";

export { marcarFacturados, marcarCsvDescargado, enviarBandejaAEmpaque, marcarEntregadoBobeda } from "./handoff-bobeda";

export type TicketPosRow = {
  codigo_ticket: string;
  cliente_id: number;
  tienda_label: string;
  marca: string;
  vendedor_id: number | null;
  vendedor_nombre: string | null;
  cedula_cliente: string | null;
  ruc_cliente: string | null;
  grada: string;
  estado: string;
  created_at: string;
  staging_id: number | null;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
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
  email_cliente: string | null;
  imagen_url: string | null;
  descp_material: string | null;
  descp_color: string | null;
  precio_unitario: number | null;
};

export type TicketsQuery = {
  clienteId?: number;
  vendedorId?: number;
  estado?: string | null;
  cedula?: string | null;
  /** Sin `desde`: sin límite inferior (p. ej. bandeja EMITIDO pendiente). */
  desde?: Date | null;
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
  if (await tablaBandejaExiste()) return true;
  const pool = getRimecPool();
  const r = await pool.query<{ reg: boolean }>(
    `SELECT to_regclass('public.${TABLA_LEGACY}') IS NOT NULL AS reg`,
  );
  return Boolean(r.rows[0]?.reg);
}

async function resolveFuente(estado: string | null | undefined): Promise<FuentePos> {
  const f = fuentePorEstadoApi(estado);
  if (f === "bandeja" && (await tablaBandejaExiste())) return "bandeja";
  if (f === "bobeda" && (await tablaBobedaExiste())) return "bobeda";
  return "legacy";
}

function tablaSql(fuente: FuentePos): string {
  if (fuente === "bandeja") return TABLA_BANDEJA;
  if (fuente === "bobeda") return TABLA_BOBINA;
  return TABLA_LEGACY;
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
    const fuente = fuentePorEstadoApi(q.estado);
    const estados = estadosFiltroBd(fuente, q.estado);
    if (estados?.length === 1) {
      params.push(estados[0]);
      where.push(`upper(btrim(${c("estado")})) = $${params.length}`);
    } else if (estados && estados.length > 1) {
      params.push(estados);
      where.push(`upper(btrim(${c("estado")})) = ANY($${params.length}::text[])`);
    }
  }
  if (q.cedula?.replace(/\D/g, "").trim()) {
    params.push(q.cedula.replace(/\D/g, "").trim());
    where.push(`${c("cedula_cliente")} = $${params.length}`);
  }
  if (q.desde) {
    params.push(q.desde.toISOString());
    where.push(`${c("created_at")} >= $${params.length}::timestamptz`);
  }
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
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  snapshot_json: Record<string, unknown> | null;
  precio_unitario: number | null;
  cb_nombre: string | null;
  cb_apellido: string | null;
  cb_razon_social: string | null;
  cb_ruc: string | null;
  cb_telefono: string | null;
  cb_email: string | null;
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

function resolveRucCliente(row: {
  cb_ruc?: string | null;
  st_snapshot_cliente?: Record<string, unknown> | null;
  snapshot_json?: Record<string, unknown> | null;
}): string | null {
  const st = row.st_snapshot_cliente ?? {};
  const stRuc = typeof st.ruc === "string" ? st.ruc.replace(/\D/g, "").trim() : "";
  if (stRuc) return stRuc;
  const cbRuc = row.cb_ruc?.replace(/\D/g, "").trim();
  if (cbRuc) return cbRuc;
  const snap = row.snapshot_json ?? {};
  const snapRuc =
    typeof snap.ruc_cliente === "string" ? snap.ruc_cliente.replace(/\D/g, "").trim() : "";
  return snapRuc || null;
}

function resolveTelefonoCliente(row: {
  cb_telefono?: string | null;
  st_snapshot_cliente?: Record<string, unknown> | null;
  snapshot_json?: Record<string, unknown> | null;
}): string | null {
  const st = row.st_snapshot_cliente ?? {};
  const stTel = typeof st.telefono === "string" ? st.telefono.trim() : "";
  if (stTel) return stTel;
  const cbTel = row.cb_telefono?.trim();
  if (cbTel) return cbTel;
  const snap = row.snapshot_json ?? {};
  const snapTel =
    typeof snap.telefono_cliente === "string" ? snap.telefono_cliente.trim() : "";
  return snapTel || null;
}

function resolveEmailCliente(row: {
  cb_email?: string | null;
  st_snapshot_cliente?: Record<string, unknown> | null;
  snapshot_json?: Record<string, unknown> | null;
}): string | null {
  const st = row.st_snapshot_cliente ?? {};
  const stMail = typeof st.email === "string" ? st.email.trim().toLowerCase() : "";
  if (stMail) return stMail;
  const cbMail = row.cb_email?.trim().toLowerCase();
  if (cbMail) return cbMail;
  const snap = row.snapshot_json ?? {};
  const snapMail =
    typeof snap.email_cliente === "string" ? snap.email_cliente.trim().toLowerCase() : "";
  return snapMail || null;
}

export async function queryTickets(q: TicketsQuery): Promise<{
  tickets: TicketPosRow[];
  total: number;
  pares: number;
}> {
  const pool = getRimecPool();
  const fuente = await resolveFuente(q.estado);
  const tabla = tablaSql(fuente);
  const codCol = codigoColumn(fuente);
  const { whereSql, params } = buildWhere(q, "t");

  const countR = await pool.query<{ total: string; pares: string }>(
    `
      SELECT COUNT(*)::text AS total, COALESCE(SUM(t.cantidad), 0)::text AS pares
      FROM public.${tabla} t
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
        t.${codCol} AS codigo_ticket, t.cliente_id, t.marca, t.vendedor_id, t.vendedor_nombre,
        t.cedula_cliente, t.grada, t.cantidad, t.estado, t.created_at, t.staging_id,
        t.linea_id, t.referencia_id, t.material_id, t.color_id, t.snapshot_json,
        t.numero_fi_fa, t.numero_factura_legal, t.precio_unitario,
        cb.nombre AS cb_nombre, cb.apellido AS cb_apellido, cb.razon_social AS cb_razon_social,
        cb.ruc AS cb_ruc, cb.telefono AS cb_telefono, cb.email AS cb_email,
        t.snapshot_cliente AS st_snapshot_cliente
      FROM public.${tabla} t
      LEFT JOIN public.clients_bazaar cb ON cb.cedula = t.cedula_cliente
      ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listParams,
  );

  return {
    tickets: listR.rows.map((row) => mapRow(row, fuente)),
    total: Number(countR.rows[0]?.total ?? 0),
    pares: Number(countR.rows[0]?.pares ?? 0),
  };
}

function mapRow(row: DbRow, fuente: FuentePos): TicketPosRow {
  const snap = row.snapshot_json ?? {};
  const mergedSnap = { ...snap };
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
  const estadoUi =
    fuente === "bandeja" && row.estado.toUpperCase() === "PENDIENTE_CAJA"
      ? "PENDIENTE_CAJA"
      : fuente === "bobeda" && row.estado.toUpperCase() === "PENDIENTE_ENTREGA"
        ? "PENDIENTE_ENTREGA"
        : row.estado;
  return {
    codigo_ticket: row.codigo_ticket,
    cliente_id: row.cliente_id,
    tienda_label: getCajaTienda(row.cliente_id)?.label ?? String(row.cliente_id),
    marca: row.marca,
    vendedor_id: row.vendedor_id,
    vendedor_nombre: row.vendedor_nombre,
    cedula_cliente: row.cedula_cliente,
    ruc_cliente: resolveRucCliente({
      cb_ruc: row.cb_ruc,
      st_snapshot_cliente: row.st_snapshot_cliente,
      snapshot_json: mergedSnap,
    }),
    grada: row.grada,
    estado: estadoUi,
    created_at: row.created_at.toISOString(),
    staging_id: row.staging_id,
    numero_fi_fa: row.numero_fi_fa != null ? Number(row.numero_fi_fa) : null,
    numero_factura_legal: row.numero_factura_legal?.trim() || null,
    linea_codigo: typeof mergedSnap.linea_codigo === "string" ? mergedSnap.linea_codigo : null,
    referencia_codigo: typeof mergedSnap.referencia_codigo === "string" ? mergedSnap.referencia_codigo : null,
    material_code: typeof mergedSnap.material_code === "string" ? mergedSnap.material_code : null,
    color_code: typeof mergedSnap.color_code === "string" ? mergedSnap.color_code : null,
    linea_id: row.linea_id,
    referencia_id: row.referencia_id,
    material_id: row.material_id,
    color_id: row.color_id,
    nombre_cliente: nombre || null,
    telefono_cliente: resolveTelefonoCliente({
      cb_telefono: row.cb_telefono,
      st_snapshot_cliente: row.st_snapshot_cliente,
      snapshot_json: mergedSnap,
    }),
    email_cliente: resolveEmailCliente({
      cb_email: row.cb_email,
      st_snapshot_cliente: row.st_snapshot_cliente,
      snapshot_json: mergedSnap,
    }),
    imagen_url: typeof mergedSnap.imagen_url === "string" ? mergedSnap.imagen_url : null,
    descp_material: typeof mergedSnap.descp_material === "string" ? mergedSnap.descp_material : null,
    descp_color: typeof mergedSnap.descp_color === "string" ? mergedSnap.descp_color : null,
    precio_unitario:
      row.precio_unitario != null && Number.isFinite(Number(row.precio_unitario))
        ? Number(row.precio_unitario)
        : typeof mergedSnap.precio_unitario === "number"
          ? mergedSnap.precio_unitario
          : null,
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

  const bandejaOk = await tablaBandejaExiste();
  const bobedaOk = await tablaBobedaExiste();

  if (bandejaOk) {
    const pend = await pool.query<{ cliente_id: number; n: string }>(
      `
        SELECT cliente_id, COUNT(*)::text AS n
        FROM public.${TABLA_BANDEJA}
        WHERE cliente_id = ANY($1::int[])
          AND upper(btrim(estado)) IN ('PENDIENTE_CAJA', 'CSV_DESCARGADO')
        GROUP BY cliente_id
      `,
      [clienteIds],
    );
    for (const row of pend.rows) {
      out[row.cliente_id].pendientes = Number(row.n);
    }
  }

  if (bobedaOk) {
    const bob = await pool.query<{
      cliente_id: number;
      pares: string;
      facturados: string;
    }>(
      `
        SELECT
          cliente_id,
          COALESCE(SUM(cantidad) FILTER (WHERE fecha_venta >= $2::date), 0)::text AS pares,
          COUNT(*) FILTER (WHERE upper(btrim(estado)) = 'PENDIENTE_ENTREGA')::text AS facturados
        FROM public.${TABLA_BOBINA}
        WHERE cliente_id = ANY($1::int[])
        GROUP BY cliente_id
      `,
      [clienteIds, desde.toISOString().slice(0, 10)],
    );
    for (const row of bob.rows) {
      out[row.cliente_id].pares_hoy = Number(row.pares);
      out[row.cliente_id].facturados = Number(row.facturados);
      out[row.cliente_id].emitidos = Number(row.pares);
    }
  } else if (bandejaOk) {
    const r = await pool.query<{
      cliente_id: number;
      pares: string;
      emitidos: string;
    }>(
      `
        SELECT
          cliente_id,
          COALESCE(SUM(cantidad) FILTER (WHERE created_at >= $2::timestamptz), 0)::text AS pares,
          COUNT(*) FILTER (WHERE created_at >= $2::timestamptz)::text AS emitidos
        FROM public.${TABLA_BANDEJA}
        WHERE cliente_id = ANY($1::int[])
        GROUP BY cliente_id
      `,
      [clienteIds, desde.toISOString()],
    );
    for (const row of r.rows) {
      out[row.cliente_id].pares_hoy = Number(row.pares);
      out[row.cliente_id].emitidos = Number(row.emitidos);
    }
  } else {
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
          COALESCE(SUM(cantidad) FILTER (WHERE created_at >= $2::timestamptz), 0)::text AS pares,
          COUNT(*) FILTER (WHERE created_at >= $2::timestamptz)::text AS emitidos,
          COUNT(*) FILTER (
            WHERE created_at >= $2::timestamptz AND upper(btrim(estado)) = 'FACTURADO'
          )::text AS facturados,
          COUNT(*) FILTER (WHERE upper(btrim(estado)) = 'EMITIDO')::text AS pendientes
        FROM public.${TABLA_LEGACY}
        WHERE cliente_id = ANY($1::int[])
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
  }

  return out;
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
    t.email_cliente ?? "",
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
    t.numero_fi_fa != null ? String(t.numero_fi_fa) : "",
    t.numero_factura_legal ?? "",
    t.precio_unitario != null ? String(Math.round(t.precio_unitario)) : "",
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
  "email_cliente",
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
  "numero_fi_fa",
  "numero_factura_legal",
  "precio_unitario",
  "created_at",
  "estado",
];

export function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
