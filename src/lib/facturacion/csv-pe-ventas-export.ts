/**
 * CSV ventas PE — veneno Carlos (stock pronta entrega).
 * Formato Director (inviolable — no alterar nombres/orden/cantidad de columnas):
 * Cliente · Cod. Oper. · F. Pedido · Lista precios · cobrador · vendedor · DEPOSITO ·
 * Des. 1–4 · Codigo Articulo · Cant. Pares · Precio con descuento · Precio sin descuento
 *
 * Orden precios (2026-08-07 hotfix Director): neto antes que bruto — Carlos aplica Des.1–4
 * de cabecera; si la col «sin descuento» va primero puede duplicar el descuento.
 *
 * DEPOSITO = dato de CABECERA (una sola vez en la 1ª fila de datos): S00_D1 | S00_DEP2 | S00_D3
 * Cant. Pares = cantidad por artículo (columna única — NO tres columnas de depósito).
 */
import type { Pool } from "pg";
import {
  brutoDesdeNeto,
  listaPrecioLabel,
  precioNetoCascada,
} from "@/app/aprobaciones/lib/aprobaciones-utils";
import { resolveCodOperCarlos } from "@/lib/carlos/plazo-carlos-resolver";
import { resolveVendedorCarlosParaCsv } from "@/lib/carlos/vendedor-carlos-resolver";
import {
  fiListaTier,
} from "@/lib/pedido-proveedor/aritmetica-programado";
import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import {
  type RimecCsvDepositoColumn,
  RIMEC_SDRM_DEPOSIT_MAP,
} from "@/lib/deposito-rimec/rimec-csv-sdrm";
import {
  assertPeCsvTierOrThrow,
  auditPeCsvTierIntegrity,
  type PeCsvFiDetAudit,
} from "@/lib/facturacion/csv-pe-tier-audit";

/** Valores legales permitidos en col DEPOSITO (cabecera FI). */
export const PE_CSV_DEPOSITO_VALORES: RimecCsvDepositoColumn[] = [
  "S00_D1",
  "S00_DEP2",
  "S00_D3",
];

/** Header canónico — 15 columnas · orden fijo (precios: con descuento → sin descuento · 2026-08-07). */
const HEADER =
  "Cliente\tCod. Oper.\tF. Pedido\tLista precios\tcobrador\tvendedor\tDEPOSITO\tDes. 1\tDes. 2\tDes. 3\tDes. 4\tCodigo Articulo\tCant. Pares\tPrecio con descuento\tPrecio sin descuento";

const COBRADOR = "90";

export type PeVentasCsvRow = {
  cliente_id: string;
  cod_oper: string;
  fecha_pedido: string;
  lista_precios: string;
  vendedor: string;
  /** Cabecera FI: S00_D1 | S00_DEP2 | S00_D3 — solo 1ª fila de datos. */
  deposito: RimecCsvDepositoColumn;
  descuento_1: string;
  descuento_2: string;
  descuento_3: string;
  descuento_4: string;
  codigo_articulo: string;
  cant_pares: string;
  precio_sin_descuento: string;
  precio_con_descuento: string;
  fid_id: number;
};

type FiDetRow = PeCsvFiDetAudit & {
  cliente_id: string | null;
  plazo_id: string | null;
  pedido_id: string | null;
  lista_precio_id: string | null;
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  fecha_pedido: Date | string | null;
  linea_snapshot: unknown;
  precio_lista: string | null;
  unit_fob_ajustado: string | null;
  payload_json: unknown;
  caso: string | null;
  cod_oper_carlos: string | null;
  pares: string | null;
  columna_stock_legal: string | null;
  deposito_codigo: string | null;
};

function isPeFi(meta: { nro_factura: string; pp_id: number | null }): boolean {
  if (meta.pp_id == null) return true;
  return String(meta.nro_factura ?? "").toUpperCase().startsWith("PE-");
}

function tsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s.replace(/[\t\r\n]/g, " ");
}

function fmtFechaPedido(raw: Date | string | null): string {
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDescCsv(n: string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return String(Math.trunc(v));
}

function resolveCodOper(
  payload: unknown,
  clienteId: string | null,
  plazoId: string | null,
  codOperFi?: string | null,
): string {
  const canon = resolveCodOperCarlos({
    cod_oper_carlos: codOperFi,
    plazo_id: plazoId,
    payload,
  });
  if (canon) return canon;
  const c = String(clienteId ?? "").trim();
  const pl = String(plazoId ?? "").trim();
  if (!c) return "CR-0";
  return `CR-${c}${pl ? pl.padStart(3, "0") : "000"}`;
}

function resolveVendedorCarlos(
  vendedorNombre: string | null,
  caso: string | null,
  payload: unknown,
  codigoPinned?: string | null,
): string {
  return resolveVendedorCarlosParaCsv({
    vendedor_nombre: vendedorNombre,
    caso,
    payload,
    codigo_vendedor_carlos: codigoPinned,
  });
}

function resolveCodigoArticuloCarlos(r: FiDetRow): string {
  const barra = String(r.codigo_barras ?? "").trim();
  if (barra) return barra;

  const snap =
    r.linea_snapshot && typeof r.linea_snapshot === "object" && !Array.isArray(r.linea_snapshot)
      ? (r.linea_snapshot as Record<string, unknown>)
      : {};
  const fromSnap = String(snap.codigo_barras ?? snap.codigo_articulo ?? "").trim();
  if (fromSnap) return fromSnap;

  throw new Error(
    `CODIGO ARTICULO Carlos faltante · fid=${r.fid_id} · sin barra SDRM (654./638.)`,
  );
}

/** Resuelve valor cabecera DEPOSITO ∈ {S00_D1, S00_DEP2, S00_D3}. */
export function resolveColumnaDepositoCarlos(
  columnaLegal: string | null | undefined,
  depositoCodigo: string | null | undefined,
): RimecCsvDepositoColumn {
  const raw = String(columnaLegal ?? "").trim().toUpperCase();
  for (const col of PE_CSV_DEPOSITO_VALORES) {
    if (raw === col) return col;
  }
  const dep = String(depositoCodigo ?? "").trim().toUpperCase();
  const hit = RIMEC_SDRM_DEPOSIT_MAP.find(
    (x) => x.deposito_codigo === dep || x.csvColumn === dep,
  );
  if (hit) return hit.csvColumn;
  return "S00_D3";
}

function fmtCantidad(n: string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return String(Math.trunc(v));
}

function fmtPrecioGs(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

function brutoDesdePpdTier(r: FiDetRow, tier: ListadoPrecioTierId): number {
  const pick = (raw: string | null | undefined): number => {
    const v = Number(raw);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const byTier: Record<ListadoPrecioTierId, number> = {
    1: pick(r.ppd_precio_lpn),
    2: pick(r.ppd_precio_lpc02),
    3: pick(r.ppd_precio_lpc03),
    4: pick(r.ppd_precio_lpc04),
  };
  const direct = byTier[tier];
  if (direct > 0) return direct;
  return pick(r.ppd_precio_lpn);
}

/**
 * Precios CSV = los de la FI (precio_unit / precio_neto) respetando lista_precio_id.
 * Prohibido priorizar linea_snapshot.precio_base o fid.precio_lista — suelen ser LPN.
 */
export function resolvePreciosLineaPeCsv(r: FiDetRow, listaPrecioId: number): { bruto: string; neto: string } {
  const d1 = Number(r.descuento_1) || 0;
  const d2 = Number(r.descuento_2) || 0;
  const d3 = Number(r.descuento_3) || 0;
  const d4 = Number(r.descuento_4) || 0;
  const hayDesc = d1 + d2 + d3 + d4 > 0;
  const tier = fiListaTier(listaPrecioId);

  const unitBd = Number(r.precio_unit);
  const netoBd = Number(r.precio_neto);

  if (Number.isFinite(unitBd) && unitBd > 0 && Number.isFinite(netoBd) && netoBd > 0) {
    return { bruto: fmtPrecioGs(unitBd), neto: fmtPrecioGs(netoBd) };
  }

  let bruto = Number.isFinite(unitBd) && unitBd > 0 ? unitBd : brutoDesdePpdTier(r, tier);
  if (bruto <= 0) bruto = Number(r.precio_base_snap);
  if (bruto <= 0) bruto = Number(r.unit_fob_ajustado);

  let neto = Number.isFinite(netoBd) && netoBd > 0 ? netoBd : 0;
  if (neto <= 0 && bruto > 0 && hayDesc) {
    neto = precioNetoCascada(bruto, d1, d2, d3, d4);
  }
  if (neto <= 0 && bruto > 0 && hayDesc && Number.isFinite(netoBd) && netoBd > 0) {
    bruto = brutoDesdeNeto(netoBd, d1, d2, d3, d4);
    neto = netoBd;
  }
  if (neto <= 0) neto = bruto;

  return {
    bruto: fmtPrecioGs(bruto),
    neto: fmtPrecioGs(Number.isFinite(neto) && neto > 0 ? neto : bruto),
  };
}

type CabeceraCsv = {
  cliente_id: string;
  cod_oper: string;
  fecha_pedido: string;
  lista_precios: string;
  vendedor: string;
  deposito: RimecCsvDepositoColumn;
  descuento_1: string;
  descuento_2: string;
  descuento_3: string;
  descuento_4: string;
};

function mapDetalleRow(r: FiDetRow, cab: CabeceraCsv, listaPrecioId: number): PeVentasCsvRow {
  const { bruto, neto } = resolvePreciosLineaPeCsv(r, listaPrecioId);
  return {
    ...cab,
    codigo_articulo: resolveCodigoArticuloCarlos(r),
    cant_pares: fmtCantidad(r.pares),
    precio_sin_descuento: bruto,
    precio_con_descuento: neto,
    fid_id: r.fid_id,
  };
}

/**
 * Fila 1 datos = cabecera FI completa (incl. DEPOSITO una vez) + 1er artículo.
 * Filas siguientes = solo cols artículo (Codigo · Cant. Pares · precios).
 */
export function buildPeVentasCsvContent(rows: PeVentasCsvRow[]): string {
  if (!rows.length) return "";
  const lines: string[] = [HEADER];
  const cab = rows[0];

  lines.push(
    [
      cab.cliente_id,
      cab.cod_oper,
      cab.fecha_pedido,
      cab.lista_precios,
      COBRADOR,
      cab.vendedor,
      cab.deposito,
      cab.descuento_1,
      cab.descuento_2,
      cab.descuento_3,
      cab.descuento_4,
      cab.codigo_articulo,
      cab.cant_pares,
      cab.precio_con_descuento,
      cab.precio_sin_descuento,
    ]
      .map(tsvCell)
      .join("\t"),
  );

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    lines.push(
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "", // DEPOSITO vacío — solo cabecera
        "",
        "",
        "",
        "",
        r.codigo_articulo,
        r.cant_pares,
        r.precio_con_descuento,
        r.precio_sin_descuento,
      ]
        .map(tsvCell)
        .join("\t"),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export async function fetchPeVentasDetRowsByFiId(pool: Pool, fiId: number): Promise<FiDetRow[]> {
  const { rows } = await pool.query<FiDetRow>(
    `
    SELECT
      fi.cliente_id::text AS cliente_id,
      fi.plazo_id::text AS plazo_id,
      fi.cod_oper_carlos,
      fi.pedido_id::text AS pedido_id,
      fi.lista_precio_id::text AS lista_precio_id,
      COALESCE(fi.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, 0)::text AS descuento_4,
      fi.vendedor_id::text AS vendedor_id,
      COALESCE(
        NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), ''),
        NULLIF(TRIM(u.descp_usuario), ''),
        NULLIF(TRIM(vd.descp_vendedor), ''),
        '—'
      ) AS vendedor_nombre,
      COALESCE(pp.fecha_arribo_real::timestamp, fi.fecha_confirmacion, fi.created_at) AS fecha_pedido,
      fid.linea_snapshot,
      fid.precio_unit::text AS precio_unit,
      fid.precio_neto::text AS precio_neto,
      fid.precio_lista::text AS precio_lista,
      fid.linea_snapshot->>'precio_base' AS precio_base_snap,
      ppd.unit_fob_ajustado::text AS unit_fob_ajustado,
      ppd.precio_lpn::text AS ppd_precio_lpn,
      ppd.precio_lpc02::text AS ppd_precio_lpc02,
      ppd.precio_lpc03::text AS ppd_precio_lpc03,
      ppd.precio_lpc04::text AS ppd_precio_lpc04,
      fid.id AS fid_id,
      fid.pares::text AS pares,
      COALESCE(
        pe_stg.codigo_barras,
        snap_stock.codigo_barras,
        NULLIF(TRIM(fid.linea_snapshot->>'codigo_barras'), ''),
        NULLIF(TRIM(fid.linea_snapshot->>'codigo_articulo'), '')
      ) AS codigo_barras,
      COALESCE(
        pe_stg.columna_stock_legal,
        CASE UPPER(TRIM(COALESCE(pp.deposito_codigo, pe_stg.deposito_codigo, '')))
          WHEN 'D1' THEN 'S00_D1'
          WHEN 'DEP2' THEN 'S00_DEP2'
          WHEN 'D3' THEN 'S00_D3'
          ELSE NULL
        END
      ) AS columna_stock_legal,
      COALESCE(pp.deposito_codigo, pe_stg.deposito_codigo) AS deposito_codigo,
      NULLIF(TRIM(fi.caso), '') AS caso,
      pvr.payload_json
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN pedido_proveedor pp ON pp.id = COALESCE(ppd.pedido_proveedor_id, fi.pp_id)
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(btrim(s.codigo_barras), '') AS codigo_barras,
        NULLIF(btrim(s.columna_stock_legal), '') AS columna_stock_legal,
        NULLIF(btrim(s.deposito_codigo), '') AS deposito_codigo
      FROM stock_pe_staging_migrated m
      JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
      WHERE m.ppd_id = ppd.id
      ORDER BY s.id
      LIMIT 1
    ) pe_stg ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(btrim(s.codigo_barras), '') AS codigo_barras,
        NULLIF(btrim(s.columna_stock_legal), '') AS columna_stock_legal,
        NULLIF(btrim(s.deposito_codigo), '') AS deposito_codigo
      FROM stock_pronta_entrega_rimec s
      JOIN linea l ON l.id = s.linea_id
      JOIN referencia r ON r.id = s.referencia_id
      WHERE NULLIF(TRIM(fid.linea_snapshot->>'linea_codigo'), '') IS NOT NULL
        AND l.codigo_proveedor::text = NULLIF(TRIM(fid.linea_snapshot->>'linea_codigo'), '')
        AND r.codigo_proveedor::text = COALESCE(
          NULLIF(TRIM(fid.linea_snapshot->>'ref_codigo'), ''),
          '0'
        )
      ORDER BY s.id
      LIMIT 1
    ) snap_stock ON TRUE
    LEFT JOIN pedido_venta_rimec pvr ON pvr.id = fi.pedido_id
    LEFT JOIN usuario_v2 u ON u.id_usuario = fi.vendedor_id
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = fi.vendedor_id
    WHERE fi.id = $1
      AND fi.estado = 'CONFIRMADA'
    ORDER BY fid.id
    `,
    [fiId],
  );
  return rows;
}

/** Expuesto para auditoría masiva — una sola query FI. */
export function buildCsvRowsFromFiDet(detRows: FiDetRow[]): PeVentasCsvRow[] {
  if (!detRows.length) return [];
  const head = detRows[0];
  const deposito = resolveColumnaDepositoCarlos(head.columna_stock_legal, head.deposito_codigo);
  const listaPrecioId = head.lista_precio_id != null ? Number(head.lista_precio_id) : 1;
  const cabeceraBase: CabeceraCsv = {
    cliente_id: String(head.cliente_id ?? "").trim(),
    cod_oper: resolveCodOper(head.payload_json, head.cliente_id, head.plazo_id, head.cod_oper_carlos),
    fecha_pedido: fmtFechaPedido(head.fecha_pedido),
    lista_precios: listaPrecioLabel(listaPrecioId),
    vendedor: resolveVendedorCarlos(head.vendedor_nombre, head.caso, head.payload_json, null),
    deposito,
    descuento_1: fmtDescCsv(head.descuento_1),
    descuento_2: fmtDescCsv(head.descuento_2),
    descuento_3: fmtDescCsv(head.descuento_3),
    descuento_4: fmtDescCsv(head.descuento_4),
  };
  return detRows.map((r) => mapDetalleRow(r, cabeceraBase, listaPrecioId));
}

export async function fetchPeVentasRowsByFiId(pool: Pool, fiId: number): Promise<PeVentasCsvRow[]> {
  const rows = await fetchPeVentasDetRowsByFiId(pool, fiId);
  return buildCsvRowsFromFiDet(rows);
}

export function peVentasFilename(
  meta: {
    pedido_id: number | null;
    cliente_id: number | null;
    first_fid_id: number;
  },
): string {
  const prefix = meta.pedido_id ?? meta.cliente_id ?? 0;
  return `${prefix}_${meta.first_fid_id}.csv`;
}

export async function exportCsvPeVentasFi(
  pool: Pool,
  fiId: number,
  meta: {
    nro_factura: string;
    pp_id: number | null;
    pedido_id: number | null;
    cliente_id: number | null;
  },
): Promise<{ content: string; filename: string; rowCount: number }> {
  if (!isPeFi({ nro_factura: meta.nro_factura, pp_id: meta.pp_id })) {
    throw new Error("No es Factura interna Pronta entrega");
  }
  const detRows = await fetchPeVentasDetRowsByFiId(pool, fiId);
  if (!detRows.length) {
    throw new Error("Sin líneas PE confirmadas para CSV ventas");
  }
  const listaPrecioId = detRows[0].lista_precio_id != null ? Number(detRows[0].lista_precio_id) : 1;
  const rows = buildCsvRowsFromFiDet(detRows);
  const violations = auditPeCsvTierIntegrity(detRows, rows, listaPrecioId);
  assertPeCsvTierOrThrow(violations, { fiId, nroFactura: meta.nro_factura });

  return {
    content: buildPeVentasCsvContent(rows),
    filename: peVentasFilename({
      pedido_id: meta.pedido_id,
      cliente_id: meta.cliente_id,
      first_fid_id: rows[0].fid_id,
    }),
    rowCount: rows.length,
  };
}

export { isPeFi };
