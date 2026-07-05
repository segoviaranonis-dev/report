import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { getCajaTienda } from "@/lib/caja-bazzar/tiendas";
import { titularClientePos } from "@/lib/caja-bazzar/tickets-db";
import { tablaBobedaExiste } from "@/lib/caja-bazzar/handoff-bobeda";
import { TABLA_BOBINA } from "@/lib/caja-bazzar/pos-tables";
import { resolverTrazabilidadDeposito, trazabilidadDesdeSnapshot } from "./trazabilidad-import";
import type {
  BobedaFiltrosResponse,
  BobedaVentaRow,
  BobedaVentasQuery,
  BobedaVentasResponse,
} from "./types";

type DbRow = {
  codigo_oro: string;
  bandeja_codigo: string | null;
  cliente_id: number;
  estado: string;
  origen: string;
  fecha_venta: Date;
  created_at: Date;
  entregado_at: Date | null;
  staging_id: number | null;
  import_batch_id: string | null;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  marca: string;
  vendedor_nombre: string | null;
  vendedor_bazzar_id: number | null;
  cedula_cliente: string | null;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number;
  grada: string;
  precio_unitario: number | null;
  snapshot_json: Record<string, unknown> | null;
  cb_nombre: string | null;
  cb_apellido: string | null;
  cb_razon_social: string | null;
  st_snapshot_cliente: Record<string, unknown> | null;
};

function snapStr(snap: Record<string, unknown>, key: string): string | null {
  const v = snap[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function trazabilidadExcel(snap: Record<string, unknown>): string | null {
  return (
    snapStr(snap, "archivo_origen") ??
    snapStr(snap, "excel_archivo") ??
    snapStr(snap, "excel_nombre") ??
    snapStr(snap, "retail_archivo_origen") ??
    null
  );
}

function trazabilidadBatch(snap: Record<string, unknown>): string | null {
  return (
    snapStr(snap, "import_batch_label") ??
    snapStr(snap, "batch_label") ??
    snapStr(snap, "retail_batch_label") ??
    (typeof snap.retail_batch_id === "string" ? snap.retail_batch_id : null) ??
    (typeof snap.batch_id === "string" ? snap.batch_id : null) ??
    null
  );
}

function mapRow(row: DbRow): BobedaVentaRow {
  const snap = row.snapshot_json ?? {};
  const clienteId = Number(row.cliente_id);
  const tienda = getCajaTienda(clienteId);
  const trSnap = trazabilidadDesdeSnapshot(snap);
  const nombreSnap =
    snapStr(snap, "nombre_cliente") ??
    (typeof snap.snapshot_cliente === "object" && snap.snapshot_cliente
      ? snapStr(snap.snapshot_cliente as Record<string, unknown>, "nombre")
      : null);

  return {
    codigo_oro: row.codigo_oro,
    bandeja_codigo: row.bandeja_codigo,
    cliente_id: clienteId,
    tienda_label: tienda?.label ?? `Tienda ${clienteId}`,
    deposito_tabla: trSnap.deposito_tabla ?? tienda?.tabla_tienda ?? "—",
    estado: row.estado,
    origen: row.origen,
    fecha_venta: row.fecha_venta.toISOString().slice(0, 10),
    created_at: row.created_at.toISOString(),
    entregado_at: row.entregado_at?.toISOString() ?? null,
    staging_id: row.staging_id,
    import_batch_id: row.import_batch_id,
    numero_fi_fa: row.numero_fi_fa != null ? Number(row.numero_fi_fa) : null,
    numero_factura_legal: row.numero_factura_legal?.trim() || null,
    marca: row.marca,
    vendedor_nombre:
      row.vendedor_nombre?.trim() || snapStr(snap, "vendedor_nombre") || null,
    vendedor_bazzar_id:
      row.vendedor_bazzar_id != null
        ? Number(row.vendedor_bazzar_id)
        : typeof snap.vendedor_bazzar_id === "number"
          ? snap.vendedor_bazzar_id
          : typeof snap.vendedor_bazzar_id === "string" && snap.vendedor_bazzar_id.trim()
            ? Number(snap.vendedor_bazzar_id)
            : null,
    cedula_cliente: row.cedula_cliente,
    nombre_cliente: titularClientePos({
      nombre_cliente: nombreSnap,
      cb_nombre: row.cb_nombre,
      cb_apellido: row.cb_apellido,
      cb_razon_social: row.cb_razon_social,
      st_snapshot_cliente: row.st_snapshot_cliente,
      cedula_cliente: row.cedula_cliente,
    }),
    linea_id: row.linea_id,
    referencia_id: row.referencia_id,
    material_id: row.material_id,
    color_id: row.color_id,
    linea_codigo: snapStr(snap, "linea_codigo"),
    referencia_codigo: snapStr(snap, "referencia_codigo"),
    material_code: snapStr(snap, "material_code"),
    color_code: snapStr(snap, "color_code"),
    descp_material: snapStr(snap, "descp_material"),
    descp_color: snapStr(snap, "descp_color"),
    grada: row.grada,
    precio_unitario:
      row.precio_unitario != null && Number.isFinite(Number(row.precio_unitario))
        ? Number(row.precio_unitario)
        : typeof snap.precio_unitario === "number"
          ? snap.precio_unitario
          : null,
    trazabilidad_excel: trazabilidadExcel(snap),
    trazabilidad_batch: trazabilidadBatch(snap),
    import_fecha: trSnap.import_fecha ?? snapStr(snap, "import_fecha"),
    controlado: snap.controlado === true ? true : snap.controlado === false ? false : null,
  };
}

async function enrichTrazabilidadFaltante(rows: BobedaVentaRow[]): Promise<BobedaVentaRow[]> {
  if (!rows.length) return rows;
  const pool = getRimecPool();
  const out: BobedaVentaRow[] = [];
  for (const row of rows) {
    if (row.trazabilidad_batch && row.deposito_tabla !== "—") {
      out.push(row);
      continue;
    }
    const tr = await resolverTrazabilidadDeposito(pool, row.cliente_id, {
      linea_id: row.linea_id,
      referencia_id: row.referencia_id,
      material_id: row.material_id,
      color_id: row.color_id,
      grada: row.grada,
    });
    if (!tr) {
      out.push(row);
      continue;
    }
    out.push({
      ...row,
      deposito_tabla: tr.deposito_tabla,
      trazabilidad_batch: row.trazabilidad_batch ?? tr.import_batch_label ?? tr.retail_batch_label,
      trazabilidad_excel: row.trazabilidad_excel ?? tr.archivo_origen,
      import_fecha: row.import_fecha ?? tr.import_fecha,
    });
  }
  return out;
}

function buildWhere(q: BobedaVentasQuery): { whereSql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [];

  if (q.allowedClienteIds?.length) {
    params.push(q.allowedClienteIds);
    where.push(`b.cliente_id = ANY($${params.length}::int[])`);
  }
  if (q.clienteId != null) {
    params.push(q.clienteId);
    where.push(`b.cliente_id = $${params.length}`);
  }
  if (q.estado?.trim()) {
    params.push(q.estado.trim().toUpperCase());
    where.push(`upper(btrim(b.estado)) = $${params.length}`);
  }
  if (q.origen?.trim()) {
    params.push(q.origen.trim().toUpperCase());
    where.push(`upper(btrim(b.origen)) = $${params.length}`);
  }
  if (q.desde?.trim()) {
    params.push(q.desde.trim());
    where.push(`b.fecha_venta >= $${params.length}::date`);
  }
  if (q.hasta?.trim()) {
    params.push(q.hasta.trim());
    where.push(`b.fecha_venta <= $${params.length}::date`);
  }
  if (q.marca?.trim()) {
    params.push(`%${q.marca.trim()}%`);
    where.push(`b.marca ILIKE $${params.length}`);
  }
  if (q.vendedor?.trim()) {
    params.push(`%${q.vendedor.trim()}%`);
    where.push(`b.vendedor_nombre ILIKE $${params.length}`);
  }
  if (q.cedula?.replace(/\D/g, "").trim()) {
    params.push(q.cedula.replace(/\D/g, "").trim());
    where.push(`b.cedula_cliente = $${params.length}`);
  }
  if (q.facturaLegal?.trim()) {
    params.push(`%${q.facturaLegal.trim()}%`);
    where.push(`b.numero_factura_legal ILIKE $${params.length}`);
  }
  if (q.fiFa != null && Number.isFinite(q.fiFa)) {
    params.push(q.fiFa);
    where.push(`b.numero_fi_fa = $${params.length}`);
  }
  if (q.stagingId != null && Number.isFinite(q.stagingId)) {
    params.push(q.stagingId);
    where.push(`b.staging_id = $${params.length}`);
  }
  if (q.q?.trim()) {
    params.push(`%${q.q.trim()}%`);
    const p = `$${params.length}`;
    where.push(`(
      b.codigo_oro ILIKE ${p}
      OR COALESCE(b.bandeja_codigo, '') ILIKE ${p}
      OR COALESCE(b.numero_factura_legal, '') ILIKE ${p}
      OR COALESCE(b.snapshot_json->>'linea_codigo', '') ILIKE ${p}
      OR COALESCE(b.snapshot_json->>'referencia_codigo', '') ILIKE ${p}
      OR COALESCE(b.snapshot_json->>'material_code', '') ILIKE ${p}
      OR COALESCE(b.snapshot_json->>'color_code', '') ILIKE ${p}
    )`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const FROM_SQL = `
  FROM public.${TABLA_BOBINA} b
  LEFT JOIN public.clients_bazaar cb ON cb.cedula = b.cedula_cliente
`;

export async function listBobedaVentas(q: BobedaVentasQuery): Promise<BobedaVentasResponse> {
  if (!isRimecDatabaseConfigured()) {
    return { configured: false, rows: [], total: 0, pares: 0, monto_total: 0 };
  }
  if (!(await tablaBobedaExiste())) {
    return { configured: false, rows: [], total: 0, pares: 0, monto_total: 0 };
  }

  const pool = getRimecPool();
  const { whereSql, params } = buildWhere(q);

  const countR = await pool.query<{ total: string; pares: string; monto: string }>(
    `
      SELECT COUNT(*)::text AS total,
             COALESCE(SUM(b.cantidad), 0)::text AS pares,
             COALESCE(SUM(COALESCE(b.precio_unitario, (b.snapshot_json->>'precio_unitario')::numeric, 0)), 0)::text AS monto
      ${FROM_SQL}
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
        b.codigo_oro, b.bandeja_codigo, b.cliente_id, b.estado, b.origen,
        b.fecha_venta, b.created_at, b.entregado_at, b.staging_id, b.import_batch_id,
        b.numero_fi_fa, b.numero_factura_legal, b.marca, b.vendedor_nombre, b.vendedor_bazzar_id,
        b.cedula_cliente, b.linea_id, b.referencia_id, b.material_id, b.color_id, b.grada,
        b.precio_unitario, b.snapshot_json,
        cb.nombre AS cb_nombre, cb.apellido AS cb_apellido, cb.razon_social AS cb_razon_social,
        b.snapshot_json->'snapshot_cliente' AS st_snapshot_cliente
      ${FROM_SQL}
      ${whereSql}
      ORDER BY b.created_at DESC, b.codigo_oro DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    listParams,
  );

  const mapped = listR.rows.map(mapRow);
  const rows = await enrichTrazabilidadFaltante(mapped);

  return {
    configured: true,
    rows,
    total: Number(countR.rows[0]?.total ?? 0),
    pares: Number(countR.rows[0]?.pares ?? 0),
    monto_total: Number(countR.rows[0]?.monto ?? 0),
  };
}

export async function loadBobedaFiltros(allowedClienteIds: number[]): Promise<BobedaFiltrosResponse> {
  if (!isRimecDatabaseConfigured() || !(await tablaBobedaExiste()) || !allowedClienteIds.length) {
    return { configured: false, tiendas: [], estados: [], origenes: [], marcas: [], vendedores: [] };
  }

  const pool = getRimecPool();
  const params = [allowedClienteIds];

  const [estadosR, origenesR, marcasR, vendedoresR] = await Promise.all([
    pool.query<{ v: string }>(
      `SELECT DISTINCT upper(btrim(estado)) AS v FROM public.${TABLA_BOBINA}
       WHERE cliente_id = ANY($1::int[]) ORDER BY 1`,
      params,
    ),
    pool.query<{ v: string }>(
      `SELECT DISTINCT upper(btrim(origen)) AS v FROM public.${TABLA_BOBINA}
       WHERE cliente_id = ANY($1::int[]) ORDER BY 1`,
      params,
    ),
    pool.query<{ v: string }>(
      `SELECT DISTINCT btrim(marca) AS v FROM public.${TABLA_BOBINA}
       WHERE cliente_id = ANY($1::int[]) AND btrim(marca) <> '' ORDER BY 1`,
      params,
    ),
    pool.query<{ v: string }>(
      `SELECT DISTINCT btrim(vendedor_nombre) AS v FROM public.${TABLA_BOBINA}
       WHERE cliente_id = ANY($1::int[]) AND btrim(COALESCE(vendedor_nombre, '')) <> '' ORDER BY 1 LIMIT 200`,
      params,
    ),
  ]);

  const tiendas = allowedClienteIds
    .map((id) => {
      const t = getCajaTienda(id);
      if (!t) return null;
      return { cliente_id: id, label: t.label, deposito_tabla: t.tabla_tienda };
    })
    .filter(Boolean) as BobedaFiltrosResponse["tiendas"];

  return {
    configured: true,
    tiendas,
    estados: estadosR.rows.map((r) => r.v),
    origenes: origenesR.rows.map((r) => r.v),
    marcas: marcasR.rows.map((r) => r.v),
    vendedores: vendedoresR.rows.map((r) => r.v),
  };
}
