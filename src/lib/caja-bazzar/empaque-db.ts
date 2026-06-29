import { getRimecPool } from "@/lib/rimec/pool";
import { formatFacturaInternaPos, titularParaFiFa } from "./fi-fa-display";
import { TABLA_BOBINA } from "./pos-tables";
import { tablaBobedaExiste } from "./handoff-bobeda";
import { ordenarLineasEmpaque } from "./empaque-sort";
import { queryHubStats, startOfTodayUtc, type TicketPosRow } from "./tickets-db";

export type EmpaqueLinea = {
  codigo_oro: string;
  marca: string | null;
  linea_codigo: string | null;
  referencia_codigo: string | null;
  material_code: string | null;
  color_code: string | null;
  descp_material: string | null;
  descp_color: string | null;
  grada: string;
  imagen_url: string | null;
  controlado: boolean;
  controlado_at: string | null;
};

export type EmpaqueFactura = {
  key: string;
  staging_id: number | null;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  marca: string | null;
  display_id: string;
  nombre_cliente: string;
  cedula_cliente: string | null;
  created_at: string;
  pares: number;
  controlados: number;
  lineas: EmpaqueLinea[];
};

function titularDesdeSnapshot(snap: Record<string, unknown>, cedula: string | null): string {
  const nombre = typeof snap.nombre_cliente === "string" ? snap.nombre_cliente.trim() : "";
  const apellido = typeof snap.apellido_cliente === "string" ? snap.apellido_cliente.trim() : "";
  const full = [nombre, apellido].filter(Boolean).join(" ");
  if (full) return full;
  return titularParaFiFa(null, cedula);
}

function mapLinea(row: {
  codigo_oro: string;
  grada: string;
  marca: string | null;
  snapshot_json: unknown;
}): EmpaqueLinea {
  const snap = (row.snapshot_json ?? {}) as Record<string, unknown>;
  const controlado = snap.controlado === true;
  const controladoAt =
    typeof snap.controlado_at === "string" && snap.controlado_at.trim() ? snap.controlado_at : null;
  const marcaRow = row.marca?.trim() || null;
  const marcaSnap = typeof snap.marca === "string" ? snap.marca.trim() : null;
  return {
    codigo_oro: row.codigo_oro,
    marca: marcaRow || marcaSnap,
    linea_codigo: typeof snap.linea_codigo === "string" ? snap.linea_codigo : null,
    referencia_codigo: typeof snap.referencia_codigo === "string" ? snap.referencia_codigo : null,
    material_code: typeof snap.material_code === "string" ? snap.material_code : null,
    color_code: typeof snap.color_code === "string" ? snap.color_code : null,
    descp_material: typeof snap.descp_material === "string" ? snap.descp_material : null,
    descp_color: typeof snap.descp_color === "string" ? snap.descp_color : null,
    grada: row.grada,
    imagen_url: typeof snap.imagen_url === "string" ? snap.imagen_url : null,
    controlado,
    controlado_at: controladoAt,
  };
}

function groupBobedaRows(
  rows: Array<{
    codigo_oro: string;
    staging_id: number | null;
    cedula_cliente: string | null;
    grada: string;
    marca: string | null;
    created_at: Date;
    snapshot_json: unknown;
    numero_fi_fa: number | null;
    numero_factura_legal: string | null;
  }>,
): EmpaqueFactura[] {
  const map = new Map<string, EmpaqueFactura>();

  for (const row of rows) {
    const snap = (row.snapshot_json ?? {}) as Record<string, unknown>;
    const key =
      row.staging_id != null
        ? `stg:${row.staging_id}`
        : `fi:${row.numero_fi_fa ?? "?"}:${row.cedula_cliente ?? "?"}`;

    let f = map.get(key);
    if (!f) {
      const nombre = titularDesdeSnapshot(snap, row.cedula_cliente);
      const marcaFactura = row.marca?.trim() || (typeof snap.marca === "string" ? snap.marca.trim() : null);
      f = {
        key,
        staging_id: row.staging_id,
        numero_fi_fa: row.numero_fi_fa != null ? Number(row.numero_fi_fa) : null,
        numero_factura_legal: row.numero_factura_legal?.trim() || null,
        marca: marcaFactura,
        display_id: formatFacturaInternaPos({
          nombre_cliente: nombre,
          cedula_cliente: row.cedula_cliente,
          numero_fi_fa: row.numero_fi_fa != null ? Number(row.numero_fi_fa) : null,
          staging_id: row.staging_id,
        }),
        nombre_cliente: nombre,
        cedula_cliente: row.cedula_cliente,
        created_at: row.created_at.toISOString(),
        pares: 0,
        controlados: 0,
        lineas: [],
      };
      map.set(key, f);
    }

    const linea = mapLinea(row);
    f.lineas.push(linea);
    f.pares += 1;
    if (linea.controlado) f.controlados += 1;
    if (row.created_at.toISOString() < f.created_at) f.created_at = row.created_at.toISOString();
    if (!f.numero_factura_legal && row.numero_factura_legal?.trim()) {
      f.numero_factura_legal = row.numero_factura_legal.trim();
    }
    if (!f.marca && row.marca?.trim()) f.marca = row.marca.trim();
  }

  for (const f of map.values()) {
    f.lineas = ordenarLineasEmpaque(f.lineas);
  }

  return [...map.values()].sort((a, b) => a.nombre_cliente.localeCompare(b.nombre_cliente, "es"));
}

export async function listEmpaqueFacturas(clienteId: number): Promise<EmpaqueFactura[]> {
  if (!(await tablaBobedaExiste())) return [];
  const pool = getRimecPool();
  const r = await pool.query<{
    codigo_oro: string;
    staging_id: number | null;
    cedula_cliente: string | null;
    grada: string;
    marca: string | null;
    created_at: Date;
    snapshot_json: unknown;
    numero_fi_fa: number | null;
    numero_factura_legal: string | null;
  }>(
    `
      SELECT codigo_oro, staging_id, cedula_cliente, grada, marca, created_at, snapshot_json,
             numero_fi_fa, numero_factura_legal
      FROM public.${TABLA_BOBINA}
      WHERE cliente_id = $1
        AND upper(btrim(estado)) = 'PENDIENTE_ENTREGA'
      ORDER BY created_at ASC
      LIMIT 500
    `,
    [clienteId],
  );
  return groupBobedaRows(r.rows);
}

export async function marcarLineaControlada(
  clienteId: number,
  codigoOro: string,
  operador?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await tablaBobedaExiste())) return { ok: false, error: "Bobeda no existe" };
  const pool = getRimecPool();
  const r = await pool.query(
    `
      UPDATE public.${TABLA_BOBINA}
      SET snapshot_json = COALESCE(snapshot_json, '{}'::jsonb) || jsonb_build_object(
        'controlado', true,
        'controlado_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'controlado_por', $3
      )
      WHERE cliente_id = $1
        AND codigo_oro = $2
        AND upper(btrim(estado)) = 'PENDIENTE_ENTREGA'
    `,
    [clienteId, codigoOro, operador?.trim() || null],
  );
  if (!r.rowCount) return { ok: false, error: "Par no encontrado o ya entregado" };
  return { ok: true };
}

export async function sellarFacturaEmpaque(input: {
  clienteId: number;
  stagingId?: number | null;
  codigos?: string[];
  nombreConfirmado: string;
}): Promise<{ ok: true; entregados: number } | { ok: false; error: string }> {
  const facturas = await listEmpaqueFacturas(input.clienteId);
  const f = input.stagingId != null
    ? facturas.find((x) => x.staging_id === input.stagingId)
    : input.codigos?.length
      ? facturas.find((x) => input.codigos!.every((c) => x.lineas.some((l) => l.codigo_oro === c)))
      : null;

  if (!f) return { ok: false, error: "Factura no encontrada en Empaque" };

  const confirm = input.nombreConfirmado.trim().toLowerCase();
  const esperado = f.nombre_cliente.trim().toLowerCase();
  if (!confirm || (confirm !== esperado && !esperado.includes(confirm) && !confirm.includes(esperado))) {
    return { ok: false, error: "Nombre de factura no coincide — verificá titular antes de sellar" };
  }

  if (f.controlados < f.pares) {
    return { ok: false, error: `Faltan ${f.pares - f.controlados} artículo(s) por controlar` };
  }

  const pool = getRimecPool();
  const codigos = f.lineas.map((l) => l.codigo_oro);
  const r = await pool.query(
    `
      UPDATE public.${TABLA_BOBINA}
      SET estado = 'ENTREGADO', entregado_at = now()
      WHERE cliente_id = $1
        AND codigo_oro = ANY($2::text[])
        AND upper(btrim(estado)) = 'PENDIENTE_ENTREGA'
    `,
    [input.clienteId, codigos],
  );
  const entregados = r.rowCount ?? 0;
  if (!entregados) return { ok: false, error: "No se pudo completar entrega" };
  return { ok: true, entregados };
}

export type MetricasTienda = {
  pares_hoy: number;
  pendientes_caja: number;
  en_bobeda: number;
  en_empaque: number;
  movimientos: TicketPosRow[];
};

export async function queryMetricasTienda(clienteId: number): Promise<MetricasTienda> {
  const stats = await queryHubStats([clienteId]);
  const s = stats[clienteId] ?? { pares_hoy: 0, pendientes: 0, facturados: 0, emitidos: 0 };

  const pool = getRimecPool();
  let movimientos: TicketPosRow[] = [];
  if (await tablaBobedaExiste()) {
    const desde = startOfTodayUtc();
    const bob = await pool.query<{
      codigo_oro: string;
      created_at: Date;
      estado: string;
      grada: string;
      snapshot_json: unknown;
    }>(
      `
        SELECT codigo_oro, created_at, estado, grada, snapshot_json
        FROM public.${TABLA_BOBINA}
        WHERE cliente_id = $1 AND created_at >= $2::timestamptz
        ORDER BY created_at DESC
        LIMIT 15
      `,
      [clienteId, desde.toISOString()],
    );
    movimientos = bob.rows.map((row) => {
      const snap = (row.snapshot_json ?? {}) as Record<string, unknown>;
      return {
        codigo_ticket: row.codigo_oro,
        cliente_id: clienteId,
        tienda_label: String(clienteId),
        marca: typeof snap.marca === "string" ? snap.marca : "",
        vendedor_id: null,
        vendedor_nombre: null,
        cedula_cliente: null,
        ruc_cliente: null,
        grada: row.grada,
        estado: row.estado,
        created_at: row.created_at.toISOString(),
        staging_id: null,
        numero_fi_fa: null,
        numero_factura_legal: null,
        linea_codigo: typeof snap.linea_codigo === "string" ? snap.linea_codigo : null,
        referencia_codigo: typeof snap.referencia_codigo === "string" ? snap.referencia_codigo : null,
        material_code: null,
        color_code: null,
        linea_id: null,
        referencia_id: null,
        material_id: null,
        color_id: null,
        nombre_cliente: null,
        telefono_cliente: null,
        email_cliente: null,
        imagen_url: null,
        descp_material: null,
        descp_color: null,
        precio_unitario: null,
      };
    });
  }

  return {
    pares_hoy: s.pares_hoy,
    pendientes_caja: s.pendientes,
    en_bobeda: s.facturados,
    en_empaque: s.facturados,
    movimientos,
  };
}
