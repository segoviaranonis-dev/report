import type { Pool } from "pg";
import type { EntidadAmLogistica, LogisticaEstadoFila, LogisticaTabId } from "./constants";
import { ENTIDAD_AM_META, FECHA_ENTREGA_CLIENTE_LABEL } from "./constants";
import { fetchObsFlagsPorFiIds } from "./observaciones-logistica";
import { etiquetaComprador } from "@/lib/clientes/etiqueta-comprador";
import { facturaRealDesdeRow } from "@/lib/logistica-ok/factura-real";
import {
  formatNumeroPreventaCarlos,
  formatQuincenaCorta,
} from "@/lib/pedido-proveedor/dato-duro-cabecera";

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
  /** Palabra reservada CHUSAR — número factura sistema Carlos */
  factura_real: string | null;
  factura_carlos: string | null;
  pv_global: number | null;
  /** Alias producto: fecha_entrega_cliente */
  fecha_entrega_cliente: string | null;
  /** @deprecated usar fecha_entrega_cliente */
  fecha_entrega_vendedor: string | null;
  estado: LogisticaEstadoFila | string;
  pendiente_impresion_legal: boolean;
  impresion_legal_ok: boolean;
  pendiente_entrega: boolean;
  entregado_ok: boolean;
  fecha_entrega_efectiva: string | null;
  chofer_nombre: string | null;
  cliente: string;
  cadena: string | null;
  vendedor: string;
  pp_numero: string;
  /** Nº preventa Carlos · pedido externo */
  nro_pedido_externo: string | null;
  marca: string;
  quincena_arribo_id: number | null;
  quincena_desc: string | null;
  etiqueta_cadena: string;
  /** Publicación PP → logística (COALESCE logistica_activada_at, created_at) */
  pp_publicado_at: string | null;
  /** Días calendario desde publicación PP (CP o Programado igual) */
  dias_atraso: number;
  /** MIG-179: cantidad mensajes Obs. Logística en FI */
  obs_count: number;
  /** MIG-179: hay mensajes no leídos en esta pestaña */
  obs_no_leida: boolean;
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

export type LogisticaGrupoDia = {
  key: string;
  fecha: string;
  filas: LogisticaPendienteRow[];
  cajas: number;
};

function tabToSqlFilter(tab: LogisticaTabId): { estado: string | null; extra: string } {
  switch (tab) {
    case "confirmadas":
      return { estado: "CONFIRMADA", extra: "" };
    case "entregas":
      return { estado: "EN_ENTREGA", extra: "" };
    case "exitosas":
    case "general_exitoso":
      return { estado: "EXITOSA", extra: "" };
    case "general":
    case "vendedor":
    default:
      return { estado: "PENDIENTE", extra: "" };
  }
}

/** Días calendario desde fecha ISO/date hasta hoy (UTC date). */
export function diasAtrasoDesdePublicacion(publicado: string | null | undefined, hoy = new Date()): number {
  if (!publicado) return 0;
  const raw = String(publicado).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 0;
  const [y, m, d] = raw.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const end = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export async function listLogisticaPendientes(
  pool: Pool,
  opts?: {
    vendedorId?: number | null;
    estado?: LogisticaEstadoFila | "TODOS" | "PENDIENTE" | "CONFIRMADA";
    tab?: LogisticaTabId;
  },
): Promise<LogisticaPendienteRow[]> {
  const vendedorId = opts?.vendedorId ?? null;
  const tab = opts?.tab;
  const filter = tab ? tabToSqlFilter(tab) : { estado: opts?.estado ?? "PENDIENTE", extra: "" };
  const estadoParam = filter.estado ?? opts?.estado ?? "PENDIENTE";

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
    pv_global: string | null;
    factura_carlos: string | null;
    fecha_entrega_vendedor: string | null;
    estado: string;
    pendiente_impresion_legal: boolean | null;
    impresion_legal_ok: boolean | null;
    pendiente_entrega: boolean | null;
    entregado_ok: boolean | null;
    fecha_entrega_efectiva: string | null;
    chofer_nombre: string | null;
    cliente: string;
    cadena: string | null;
    vendedor: string;
    pp_numero: string;
    nro_pedido_externo: string | null;
    marca: string | null;
    quincena_arribo_id: string | null;
    quincena_desc: string | null;
    pp_publicado_at: string | null;
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
           l.monto_neto::text, l.nro_factura, fi.pv_global::text AS pv_global,
           fi.factura_carlos, l.fecha_entrega_vendedor::text,
           l.estado,
           COALESCE(l.pendiente_impresion_legal, true) AS pendiente_impresion_legal,
           COALESCE(l.impresion_legal_ok, false) AS impresion_legal_ok,
           COALESCE(l.pendiente_entrega, true) AS pendiente_entrega,
           COALESCE(l.entregado_ok, false) AS entregado_ok,
           l.fecha_entrega_efectiva::text,
           l.chofer_nombre,
           cv.descp_cliente AS cliente,
           cad.descp_cadena AS cadena,
           COALESCE(vd.descp_vendedor, '—') AS vendedor,
           pp.numero_registro AS pp_numero,
           NULLIF(BTRIM(pp.nro_pedido_externo), '') AS nro_pedido_externo,
           COALESCE(NULLIF(BTRIM(fi.marca), ''), 'Sin marca') AS marca,
           pp.quincena_arribo_id::text AS quincena_arribo_id,
           qa.descripcion AS quincena_desc,
           COALESCE(pp.logistica_activada_at, pp.created_at)::date::text AS pp_publicado_at
    FROM logistica_pendiente_confirmacion l
    JOIN cliente_v2 cv ON cv.id_cliente = l.id_cliente
    JOIN pedido_proveedor pp ON pp.id = l.pedido_proveedor_id
    JOIN factura_interna fi ON fi.id = l.factura_interna_id
    LEFT JOIN quincena_arribo qa ON qa.id = pp.quincena_arribo_id
    LEFT JOIN cadena_v2 cad ON cad.id_cadena = l.id_cadena
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = l.id_vendedor
    WHERE ($1 = 'TODOS' OR l.estado = $1)
      AND ($2::int IS NULL OR l.id_vendedor = $2)
    ORDER BY
      CASE l.entidad_am WHEN 'PE' THEN 0 WHEN 'CP' THEN 1 WHEN 'PROGRAMADO' THEN 2 ELSE 3 END,
      COALESCE(NULLIF(BTRIM(pp.nro_pedido_externo), ''), pp.numero_registro),
      COALESCE(NULLIF(BTRIM(fi.marca), ''), 'Sin marca'),
      COALESCE(l.fecha_entrega_vendedor, l.fecha_orden) ASC NULLS LAST,
      cv.descp_cliente,
      l.nro_factura
    `,
    [estadoParam, vendedorId],
  );

  return rows.map((r) => {
    const fec = r.fecha_entrega_vendedor?.slice(0, 10) ?? null;
    const ppPub = r.pp_publicado_at?.slice(0, 10) ?? null;
    return {
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
      pv_global: r.pv_global != null ? Number(r.pv_global) : null,
      factura_carlos: r.factura_carlos?.trim() || null,
      factura_real: facturaRealDesdeRow({
        pv_global: r.pv_global != null ? Number(r.pv_global) : null,
        factura_carlos: r.factura_carlos,
      }) || null,
      fecha_entrega_cliente: fec,
      fecha_entrega_vendedor: fec,
      estado: r.estado,
      pendiente_impresion_legal: Boolean(r.pendiente_impresion_legal ?? true),
      impresion_legal_ok: Boolean(r.impresion_legal_ok ?? false),
      pendiente_entrega: Boolean(r.pendiente_entrega ?? true),
      entregado_ok: Boolean(r.entregado_ok ?? false),
      fecha_entrega_efectiva: r.fecha_entrega_efectiva?.slice(0, 10) ?? null,
      chofer_nombre: r.chofer_nombre,
      cliente: r.cliente,
      cadena: r.cadena,
      vendedor: r.vendedor,
      pp_numero: r.pp_numero,
      nro_pedido_externo: r.nro_pedido_externo,
      marca: r.marca?.trim() || "Sin marca",
      quincena_arribo_id: r.quincena_arribo_id != null ? Number(r.quincena_arribo_id) : null,
      quincena_desc: r.quincena_desc,
      etiqueta_cadena: etiquetaComprador(r.cadena, r.cliente),
      pp_publicado_at: ppPub,
      dias_atraso: diasAtrasoDesdePublicacion(ppPub),
      obs_count: 0,
      obs_no_leida: false,
    };
  });
}

/** Enriquece filas con flags Obs. Logística (MIG-179). */
export async function enrichFilasConObsLogistica(
  pool: Pool,
  filas: LogisticaPendienteRow[],
  opts?: { usuarioId?: number | null; pestana?: LogisticaTabId | null },
): Promise<LogisticaPendienteRow[]> {
  if (!filas.length) return filas;
  const fiIds = [...new Set(filas.map((f) => f.factura_interna_id))];
  let flags: Map<number, { count: number; noLeida: boolean }>;
  try {
    flags = await fetchObsFlagsPorFiIds(
      pool,
      fiIds,
      opts?.usuarioId ?? null,
      opts?.pestana ?? null,
    );
  } catch {
    return filas;
  }
  return filas.map((f) => {
    const o = flags.get(f.factura_interna_id);
    if (!o) return f;
    return { ...f, obs_count: o.count, obs_no_leida: o.noLeida };
  });
}

export type LogisticaFiltrosCliente = {
  q?: string;
  vendedores?: string[];
  cadenas?: string[];
  clientes?: string[];
  marcas?: string[];
};

/** Filtros multi-select General / General exitoso (cliente). */
export function filtrarFilasLogistica(
  filas: LogisticaPendienteRow[],
  f: LogisticaFiltrosCliente,
): LogisticaPendienteRow[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const vendedores = new Set((f.vendedores ?? []).map((x) => x.trim()).filter(Boolean));
  const cadenas = new Set((f.cadenas ?? []).map((x) => x.trim()).filter(Boolean));
  const clientes = new Set((f.clientes ?? []).map((x) => x.trim()).filter(Boolean));
  const marcas = new Set((f.marcas ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean));

  return filas.filter((row) => {
    if (vendedores.size > 0) {
      const key = String(row.id_vendedor ?? "") || row.vendedor;
      if (!vendedores.has(key) && !vendedores.has(row.vendedor)) return false;
    }
    if (cadenas.size > 0) {
      // Sales Report: cadena = solo puente cliente_cadena_v2 → cadena_v2.
      // "0" / "__SIN_CADENA__" = clientes sin cadena (nunca el nombre del cliente).
      const sinCadena =
        cadenas.has("0") || cadenas.has("__SIN_CADENA__") || cadenas.has("Clientes sin cadenas");
      const idCad = row.id_cadena != null ? String(row.id_cadena) : null;
      const descpCad = (row.cadena ?? "").trim();
      if (idCad == null) {
        if (!sinCadena) return false;
      } else if (!cadenas.has(idCad) && !(descpCad && cadenas.has(descpCad))) {
        return false;
      }
    }
    if (clientes.size > 0 && !clientes.has(String(row.id_cliente))) return false;
    if (marcas.size > 0 && !marcas.has((row.marca ?? "").trim().toLowerCase())) return false;
    if (q) {
      const blob = `${row.id_cliente} ${row.cliente} ${row.marca} ${row.cadena ?? ""} ${row.nro_factura ?? ""} ${row.vendedor}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

/** Stats iniciales (todos los estados del universo) vs ejecución EXITOSA. */
export function statsEjecucionLogistica(todas: LogisticaPendienteRow[]) {
  const n_inicial = todas.length;
  const cajas_inicial = todas.reduce((s, r) => s + r.cajas, 0);
  const exitosas = todas.filter((r) => r.estado === "EXITOSA");
  const n_exitosas = exitosas.length;
  const cajas_exitosas = exitosas.reduce((s, r) => s + r.cajas, 0);
  const pct_ejecucion =
    n_inicial > 0 ? Math.round((1000 * n_exitosas) / n_inicial) / 10 : 0;
  const pct_cajas =
    cajas_inicial > 0 ? Math.round((1000 * cajas_exitosas) / cajas_inicial) / 10 : 0;
  return {
    n_inicial,
    cajas_inicial,
    n_exitosas,
    cajas_exitosas,
    pct_ejecucion,
    pct_cajas,
  };
}

export type LogisticaStatsPp = ReturnType<typeof statsEjecucionLogistica> & {
  pedido_proveedor_id: number;
  pares_inicial: number;
};

/** Mapa por PP: inicial + % ejecución (para cabecera cuando hay varios PP). */
export function statsEjecucionPorPp(todas: LogisticaPendienteRow[]): Record<number, LogisticaStatsPp> {
  const byPp = new Map<number, LogisticaPendienteRow[]>();
  for (const row of todas) {
    const bucket = byPp.get(row.pedido_proveedor_id) ?? [];
    bucket.push(row);
    byPp.set(row.pedido_proveedor_id, bucket);
  }
  const out: Record<number, LogisticaStatsPp> = {};
  for (const [ppId, rows] of byPp) {
    const base = statsEjecucionLogistica(rows);
    out[ppId] = {
      pedido_proveedor_id: ppId,
      ...base,
      pares_inicial: rows.reduce((s, r) => s + r.pares, 0),
    };
  }
  return out;
}

export function enriquecerGruposConStatsPp(
  grupos: LogisticaGrupoPedidoDuro[],
  porPp: Record<number, LogisticaStatsPp>,
): LogisticaGrupoPedidoDuro[] {
  return grupos.map((g) => {
    const s = porPp[g.pedido_proveedor_id];
    if (!s) {
      return {
        ...g,
        n_inicial: g.n_fi,
        cajas_inicial: g.cajas,
        pares_inicial: g.pares,
        n_exitosas: 0,
        cajas_exitosas: 0,
        pct_ejecucion: 0,
        pct_cajas: 0,
      };
    }
    return {
      ...g,
      n_inicial: s.n_inicial,
      cajas_inicial: s.cajas_inicial,
      pares_inicial: s.pares_inicial,
      n_exitosas: s.n_exitosas,
      cajas_exitosas: s.cajas_exitosas,
      pct_ejecucion: s.pct_ejecucion,
      pct_cajas: s.pct_cajas,
    };
  });
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

/** Nivel 2 General: resumen por marca (cajas / pares / monto) */
export type LogisticaGrupoMarcaResumen = {
  key: string;
  marca: string;
  filas: LogisticaPendienteRow[];
  cajas: number;
  pares: number;
  monto: number;
  n_fi: number;
  /** Vendedores distintos en esta marca (cabecera acordeón) */
  vendedores: string[];
};

/** Nivel 1 General: Nº preventa Carlos + dato duro (quincena) */
export type LogisticaGrupoPedidoDuro = {
  key: string;
  pedido_proveedor_id: number;
  entidad_am: EntidadAmLogistica;
  categoria_label: string;
  nro_pedido_externo: string;
  preventa_label: string;
  quincena_arribo_id: number | null;
  quincena_desc: string | null;
  quincena_corta: string;
  pp_numero: string;
  cajas: number;
  pares: number;
  monto: number;
  n_fi: number;
  n_clientes: number;
  /** @deprecated preferir stockBazzar / stockRimec / cadenas */
  marcas: LogisticaGrupoMarcaResumen[];
  /** Holding tiendas Bazzar — no mezclar con remanente */
  stockBazzar: LogisticaBloqueStock;
  /** Remanente no vendido → depósito RIMEC */
  stockRimec: LogisticaBloqueStock;
  /** Cadenas / clientes comerciales (resumen Ivan) */
  cadenas: LogisticaGrupoCadenaResumen[];
  pp_publicado_at: string | null;
  dias_atraso: number;
  /** Universo del PP (todos los estados) — cabecera multi-PP */
  n_inicial: number;
  cajas_inicial: number;
  pares_inicial: number;
  n_exitosas: number;
  cajas_exitosas: number;
  pct_ejecucion: number;
  pct_cajas: number;
};

export type LogisticaBloqueStock = {
  cajas: number;
  pares: number;
  monto: number;
  n_fi: number;
  n_clientes: number;
  marcas: LogisticaGrupoMarcaResumen[];
};

/** Remanente depósito solo aplica a CP con saldo; ocultar PE / Programado / vacío. */
export function bloqueStockRimecVisible(
  entidad_am: EntidadAmLogistica,
  bloque: LogisticaBloqueStock,
): boolean {
  if (entidad_am !== "CP") return false;
  return (
    bloque.cajas > 0 ||
    bloque.pares > 0 ||
    bloque.monto > 0 ||
    bloque.n_fi > 0 ||
    bloque.marcas.length > 0
  );
}

export type LogisticaGrupoCadenaResumen = {
  key: string;
  cadena_label: string;
  cajas: number;
  pares: number;
  monto: number;
  n_fi: number;
  n_clientes: number;
  marcas: LogisticaGrupoMarcaResumen[];
};

/** Ivan: STOCK/BAZZAR = holding · STOCK/RIMEC = remanente depósito · resto = cadena */
export type DestinoListadoLogistica = "BAZZAR" | "RIMEC" | "CADENA";

export function destinoListadoLogistica(f: Pick<LogisticaPendienteRow, "cliente" | "cadena" | "vendedor">): DestinoListadoLogistica {
  const cliente = (f.cliente ?? "").trim();
  const cadena = (f.cadena ?? "").trim();
  const vendedor = (f.vendedor ?? "").trim();
  const blob = `${cadena} ${cliente}`;

  if (/BAZZAR/i.test(blob)) return "BAZZAR";
  if (
    /^RIMEC$/i.test(vendedor) ||
    /^STOCK$/i.test(cliente) ||
    /\bSTOCK\b/i.test(cliente) ||
    /REMANENTE/i.test(blob) ||
    (/RIMEC/i.test(blob) && !/BAZZAR/i.test(blob))
  ) {
    return "RIMEC";
  }
  return "CADENA";
}

function resumenBloque(filas: LogisticaPendienteRow[]): LogisticaBloqueStock {
  return {
    cajas: filas.reduce((s, r) => s + r.cajas, 0),
    pares: filas.reduce((s, r) => s + r.pares, 0),
    monto: filas.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
    n_fi: filas.length,
    n_clientes: new Set(filas.map((r) => r.id_cliente)).size,
    marcas: groupLogisticaPorMarcaResumen(filas),
  };
}

function groupLogisticaPorCadenaResumen(filas: LogisticaPendienteRow[]): LogisticaGrupoCadenaResumen[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const label = (f.cadena?.trim() || f.etiqueta_cadena || f.cliente || "Sin cadena").trim();
    const key = f.id_cadena != null ? `c-${f.id_cadena}` : `z-${label}`;
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([key, rows]) => {
      const label = (rows[0].cadena?.trim() || rows[0].etiqueta_cadena || rows[0].cliente || "Sin cadena").trim();
      return {
        key,
        cadena_label: label,
        cajas: rows.reduce((s, r) => s + r.cajas, 0),
        pares: rows.reduce((s, r) => s + r.pares, 0),
        monto: rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
        n_fi: rows.length,
        n_clientes: new Set(rows.map((r) => r.id_cliente)).size,
        marcas: groupLogisticaPorMarcaResumen(rows),
      };
    })
    .sort((a, b) => a.cadena_label.localeCompare(b.cadena_label, "es"));
}

function pedidoExternoLabel(f: LogisticaPendienteRow): string {
  const ext = (f.nro_pedido_externo ?? "").trim();
  if (ext) return ext;
  return (f.pp_numero ?? "").trim() || "Sin pedido";
}

export function groupLogisticaPorMarcaResumen(filas: LogisticaPendienteRow[]): LogisticaGrupoMarcaResumen[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const marca = (f.marca ?? "").trim() || "Sin marca";
    const bucket = map.get(marca) ?? [];
    bucket.push(f);
    map.set(marca, bucket);
  }
  return [...map.entries()]
    .map(([marca, rows]) => {
      const vendedores = [
        ...new Set(
          rows
            .map((r) => (r.vendedor ?? "").trim())
            .filter((v) => v && v !== "—"),
        ),
      ].sort((a, b) => a.localeCompare(b, "es"));
      return {
        key: marca,
        marca,
        filas: rows,
        cajas: rows.reduce((s, r) => s + r.cajas, 0),
        pares: rows.reduce((s, r) => s + r.pares, 0),
        monto: rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
        n_fi: rows.length,
        vendedores,
      };
    })
    .sort((a, b) => a.marca.localeCompare(b.marca, "es"));
}

/** General: Pedido externo + dato duro → STOCK Bazzar | RIMEC | cadenas */
export function groupLogisticaPorPedidoDuro(filas: LogisticaPendienteRow[]): LogisticaGrupoPedidoDuro[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const preventa = formatNumeroPreventaCarlos(f.nro_pedido_externo) || pedidoExternoLabel(f);
    const q = f.quincena_arribo_id ?? 0;
    const key = `pp-${f.pedido_proveedor_id}__${preventa}__q${q}`;
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .map(([key, rows]) => {
      const head = rows[0];
      const entidad_am = (head.entidad_am || "CP") as EntidadAmLogistica;
      const preventaRaw = (head.nro_pedido_externo ?? "").trim() || pedidoExternoLabel(head);
      const preventa_label = formatNumeroPreventaCarlos(preventaRaw) || preventaRaw;
      const clientes = new Set(rows.map((r) => r.id_cliente));
      const bazzar = rows.filter((r) => destinoListadoLogistica(r) === "BAZZAR");
      const rimec = rows.filter((r) => destinoListadoLogistica(r) === "RIMEC");
      const cadena = rows.filter((r) => destinoListadoLogistica(r) === "CADENA");
      return {
        key,
        pedido_proveedor_id: head.pedido_proveedor_id,
        entidad_am,
        categoria_label: ENTIDAD_AM_META[entidad_am]?.label ?? entidad_am,
        nro_pedido_externo: preventaRaw,
        preventa_label,
        quincena_arribo_id: head.quincena_arribo_id,
        quincena_desc: head.quincena_desc,
        quincena_corta: formatQuincenaCorta(head.quincena_desc) || "Sin dato duro",
        pp_numero: head.pp_numero,
        cajas: rows.reduce((s, r) => s + r.cajas, 0),
        pares: rows.reduce((s, r) => s + r.pares, 0),
        monto: rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
        n_fi: rows.length,
        n_clientes: clientes.size,
        marcas: groupLogisticaPorMarcaResumen(rows),
        stockBazzar: resumenBloque(bazzar),
        stockRimec: resumenBloque(rimec),
        cadenas: groupLogisticaPorCadenaResumen(cadena),
        pp_publicado_at: head.pp_publicado_at,
        dias_atraso: head.dias_atraso,
        n_inicial: rows.length,
        cajas_inicial: rows.reduce((s, r) => s + r.cajas, 0),
        pares_inicial: rows.reduce((s, r) => s + r.pares, 0),
        n_exitosas: 0,
        cajas_exitosas: 0,
        pct_ejecucion: 0,
        pct_cajas: 0,
      };
    })
    .sort((a, b) => {
      const pa = ENTIDAD_AM_META[a.entidad_am]?.sortPriority ?? 99;
      const pb = ENTIDAD_AM_META[b.entidad_am]?.sortPriority ?? 99;
      if (pa !== pb) return pa - pb;
      return a.preventa_label.localeCompare(b.preventa_label, "es");
    });
}

/** Nivel 2 legacy: marca + nº pedido externo (preventa Carlos) */
export type LogisticaGrupoMarcaPp = {
  key: string;
  marca: string;
  nro_pedido_externo: string;
  label: string;
  filas: LogisticaPendienteRow[];
  cajas: number;
  pares: number;
  monto: number;
};

/** Nivel 1 legacy: Compra previa / Pronta entrega / Programado */
export type LogisticaGrupoTipo = {
  key: string;
  entidad_am: EntidadAmLogistica;
  label: string;
  marcasPp: LogisticaGrupoMarcaPp[];
  cajas: number;
  n_fi: number;
};

export function groupLogisticaPorMarcaPp(filas: LogisticaPendienteRow[]): LogisticaGrupoMarcaPp[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const marca = (f.marca ?? "").trim() || "Sin marca";
    const pedido = pedidoExternoLabel(f);
    const key = `${marca}__${pedido}`;
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([key, rows]) => {
      const head = rows[0];
      const marca = (head.marca ?? "").trim() || "Sin marca";
      const nro = pedidoExternoLabel(head);
      return {
        key,
        marca,
        nro_pedido_externo: nro,
        label: `${marca} · ${nro}`,
        filas: rows,
        cajas: rows.reduce((s, r) => s + r.cajas, 0),
        pares: rows.reduce((s, r) => s + r.pares, 0),
        monto: rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Confirmadas / Vendedor anidado: Tipo → Marca+Pedido → FI */
export function groupLogisticaPorTipoMarcaPp(filas: LogisticaPendienteRow[]): LogisticaGrupoTipo[] {
  const byTipo = new Map<EntidadAmLogistica, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const ent = (f.entidad_am || "CP") as EntidadAmLogistica;
    const bucket = byTipo.get(ent) ?? [];
    bucket.push(f);
    byTipo.set(ent, bucket);
  }
  return [...byTipo.entries()]
    .map(([entidad_am, rows]) => {
      const meta = ENTIDAD_AM_META[entidad_am] ?? ENTIDAD_AM_META.CP;
      return {
        key: entidad_am,
        entidad_am,
        label: meta.label,
        marcasPp: groupLogisticaPorMarcaPp(rows),
        cajas: rows.reduce((s, r) => s + r.cajas, 0),
        n_fi: rows.length,
      };
    })
    .sort(
      (a, b) =>
        (ENTIDAD_AM_META[a.entidad_am]?.sortPriority ?? 99) -
        (ENTIDAD_AM_META[b.entidad_am]?.sortPriority ?? 99),
    );
}

export type LogisticaGrupoVendedor = {
  key: string;
  id_vendedor: number | null;
  vendedor_label: string;
  tipos: LogisticaGrupoTipo[];
  cajas: number;
  n_fi: number;
};

/** Vendedor → Tipo → Marca+Pedido → FI */
export function groupLogisticaPorVendedorTipoMarcaPp(filas: LogisticaPendienteRow[]): LogisticaGrupoVendedor[] {
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
        tipos: groupLogisticaPorTipoMarcaPp(subset),
        cajas: subset.reduce((s, f) => s + f.cajas, 0),
        n_fi: subset.length,
      };
    })
    .sort((a, b) => a.vendedor_label.localeCompare(b.vendedor_label, "es"));
}

/** @deprecated preferir groupLogisticaPorVendedorTipoMarcaPp */
export function groupLogisticaPorVendedorCadenaCliente(filas: LogisticaPendienteRow[]): LogisticaGrupoVendedor[] {
  return groupLogisticaPorVendedorTipoMarcaPp(filas);
}

/** Entregas del día · acordeón por fecha_entrega_cliente */
export function groupLogisticaPorFechaCliente(filas: LogisticaPendienteRow[]): LogisticaGrupoDia[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const key = f.fecha_entrega_cliente?.slice(0, 10) || "Sin fecha";
    const bucket = map.get(key) ?? [];
    bucket.push(f);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([fecha, rows]) => ({
      key: fecha,
      fecha,
      filas: rows,
      cajas: rows.reduce((s, r) => s + r.cajas, 0),
    }))
    .sort((a, b) => {
      if (a.fecha === "Sin fecha") return 1;
      if (b.fecha === "Sin fecha") return -1;
      return a.fecha.localeCompare(b.fecha);
    });
}

export type LogisticaGrupoChofer = {
  key: string;
  chofer: string;
  filas: LogisticaPendienteRow[];
  cajas: number;
};

export type LogisticaGrupoDiaConChofer = {
  key: string;
  fecha: string;
  cajas: number;
  choferes: LogisticaGrupoChofer[];
};

/** Dentro de un día: acordeón por nombre de chofer */
export function groupLogisticaPorChofer(filas: LogisticaPendienteRow[]): LogisticaGrupoChofer[] {
  const map = new Map<string, LogisticaPendienteRow[]>();
  for (const f of filas) {
    const name = (f.chofer_nombre ?? "").trim() || "Sin chofer";
    const bucket = map.get(name) ?? [];
    bucket.push(f);
    map.set(name, bucket);
  }
  return [...map.entries()]
    .map(([chofer, rows]) => ({
      key: chofer,
      chofer,
      filas: rows,
      cajas: rows.reduce((s, r) => s + r.cajas, 0),
    }))
    .sort((a, b) => {
      if (a.chofer === "Sin chofer") return 1;
      if (b.chofer === "Sin chofer") return -1;
      return a.chofer.localeCompare(b.chofer, "es");
    });
}

/** Día → chofer → FI (Entregas / Exitosas) */
export function groupLogisticaPorFechaYChofer(filas: LogisticaPendienteRow[]): LogisticaGrupoDiaConChofer[] {
  return groupLogisticaPorFechaCliente(filas).map((d) => ({
    key: d.key,
    fecha: d.fecha,
    cajas: d.cajas,
    choferes: groupLogisticaPorChofer(d.filas),
  }));
}

/** Confirmación = asignar fecha_entrega_cliente */
export async function confirmarEntregaVendedor(
  pool: Pool,
  pendienteId: number,
  fechaEntrega: string,
  usuarioId: number | null,
  idVendedor?: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const fecha = fechaEntrega?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: `${FECHA_ENTREGA_CLIENTE_LABEL} inválida.` };
  }

  const { rowCount } = await pool.query(
    `
    UPDATE logistica_pendiente_confirmacion SET
      fecha_entrega_vendedor = $2::date,
      estado = 'CONFIRMADA',
      pendiente_impresion_legal = true,
      impresion_legal_ok = false,
      pendiente_entrega = true,
      entregado_ok = false,
      id_vendedor = COALESCE($4, id_vendedor),
      confirmado_at = now(),
      confirmado_por = $3,
      updated_at = now()
    WHERE id = $1 AND estado = 'PENDIENTE'
    `,
    [pendienteId, fecha, usuarioId, idVendedor ?? null],
  );
  if (!rowCount) return { ok: false, error: "Pendiente no encontrado o ya confirmado." };
  return { ok: true };
}

/**
 * Multi-selección atómica: misma fecha (+ vendedor opcional) a N pendientes.
 * Evita 1 OK + N fallos silenciosos del loop fila a fila.
 */
export async function confirmarEntregaLote(
  pool: Pool,
  ids: number[],
  fechaEntrega: string,
  usuarioId: number | null,
  idVendedor?: number | null,
): Promise<{ ok: boolean; done: number; okIds: number[]; skipped: number; error?: string }> {
  const fecha = fechaEntrega?.trim().slice(0, 10);
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, done: 0, okIds: [], skipped: 0, error: `${FECHA_ENTREGA_CLIENTE_LABEL} inválida.` };
  }
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) {
    return { ok: false, done: 0, okIds: [], skipped: 0, error: "Seleccioná al menos una FI." };
  }

  const { rows } = await pool.query<{ id: string }>(
    `
    UPDATE logistica_pendiente_confirmacion SET
      fecha_entrega_vendedor = $2::date,
      estado = 'CONFIRMADA',
      pendiente_impresion_legal = true,
      impresion_legal_ok = false,
      pendiente_entrega = true,
      entregado_ok = false,
      id_vendedor = COALESCE($4, id_vendedor),
      confirmado_at = now(),
      confirmado_por = $3,
      updated_at = now()
    WHERE id = ANY($1::bigint[])
      AND estado = 'PENDIENTE'
    RETURNING id
    `,
    [uniq, fecha, usuarioId, idVendedor ?? null],
  );

  const okIds = rows.map((r) => Number(r.id));
  const skipped = uniq.length - okIds.length;
  return {
    ok: okIds.length > 0 && skipped === 0,
    done: okIds.length,
    okIds,
    skipped,
    error:
      skipped > 0
        ? `${skipped} FI no actualizadas (ya confirmadas u otro estado). ${okIds.length} OK.`
        : undefined,
  };
}

/** Impresión legal en lote */
export async function confirmarImpresionLegalLote(
  pool: Pool,
  ids: number[],
  usuarioId: number | null,
): Promise<{ ok: boolean; done: number; okIds: number[]; skipped: number; error?: string }> {
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) {
    return { ok: false, done: 0, okIds: [], skipped: 0, error: "Seleccioná al menos una FI." };
  }

  const { rows } = await pool.query<{ id: string }>(
    `
    UPDATE logistica_pendiente_confirmacion SET
      pendiente_impresion_legal = false,
      impresion_legal_ok = true,
      estado = 'EN_ENTREGA',
      updated_at = now(),
      confirmado_por = COALESCE($2, confirmado_por)
    WHERE id = ANY($1::bigint[])
      AND estado = 'CONFIRMADA'
      AND fecha_entrega_vendedor IS NOT NULL
    RETURNING id
    `,
    [uniq, usuarioId],
  );

  const okIds = rows.map((r) => Number(r.id));
  const skipped = uniq.length - okIds.length;
  return {
    ok: okIds.length > 0 && skipped === 0,
    done: okIds.length,
    okIds,
    skipped,
    error:
      skipped > 0
        ? `${skipped} FI no estaban en Confirmadas. ${okIds.length} OK.`
        : undefined,
  };
}

/** Facturación confirma impresión legal → habilita depósito */
export async function confirmarImpresionLegal(
  pool: Pool,
  pendienteId: number,
  usuarioId: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const { rowCount } = await pool.query(
    `
    UPDATE logistica_pendiente_confirmacion SET
      pendiente_impresion_legal = false,
      impresion_legal_ok = true,
      estado = 'EN_ENTREGA',
      updated_at = now(),
      confirmado_por = COALESCE($2, confirmado_por)
    WHERE id = $1
      AND estado = 'CONFIRMADA'
      AND fecha_entrega_vendedor IS NOT NULL
    `,
    [pendienteId, usuarioId],
  );
  if (!rowCount) {
    return { ok: false, error: "FI no está en Confirmadas o falta fecha_entrega_cliente." };
  }
  return { ok: true };
}

/** Cierre depósito: todas las banderas + chofer → EXITOSA */
export async function cerrarEntregaExitosa(
  pool: Pool,
  pendienteId: number,
  input: { fecha_entrega_efectiva: string; chofer_nombre: string; usuarioId: number | null },
): Promise<{ ok: boolean; error?: string }> {
  const fecha = input.fecha_entrega_efectiva?.trim().slice(0, 10);
  const chofer = input.chofer_nombre?.trim();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "Fecha de la entrega inválida." };
  }
  if (!chofer || chofer.length < 3) return { ok: false, error: "Chofer obligatorio." };

  const { rowCount } = await pool.query(
    `
    UPDATE logistica_pendiente_confirmacion SET
      entregado_ok = true,
      pendiente_entrega = false,
      fecha_entrega_efectiva = $2::date,
      chofer_nombre = $3,
      estado = 'EXITOSA',
      updated_at = now(),
      confirmado_por = COALESCE($4, confirmado_por)
    WHERE id = $1
      AND estado = 'EN_ENTREGA'
      AND impresion_legal_ok = true
      AND fecha_entrega_vendedor IS NOT NULL
    `,
    [pendienteId, fecha, chofer, input.usuarioId],
  );
  if (!rowCount) {
    return {
      ok: false,
      error: "Faltan impresión legal o no está en Entregas del día.",
    };
  }
  return { ok: true };
}
