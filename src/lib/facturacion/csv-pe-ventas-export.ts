/**
 * CSV ventas PE — formato Carlos stock pronta entrega.
 * Referencia canónica: csv's/stock's/ventas PE/7954_3114.csv
 * · TSV 14 cols · CRLF · sin BOM · fila 1 cabecera completa · resto solo cols 11–14
 */
import type { Pool } from "pg";
import { brutoDesdeNeto, listaPrecioLabel } from "@/app/aprobaciones/lib/aprobaciones-utils";
import { resolveCodOperCarlos } from "@/lib/carlos/plazo-carlos-resolver";
import { resolveCodigoVendedorReal, resolveCasoComercialCarlos } from "@/lib/carlos/vendedor-carlos-resolver";

const HEADER =
  "Cliente\tCod. Oper.\tF. Pedido\tLista precios\tcobrador\tvendedor\tDes. 1\tDes. 2\tDes. 3\tDes. 4\tCodigo Articulo\tCant. Pares\tPrecio sin descuento\tPrecio con descuento";

const COBRADOR = "90";

export type PeVentasCsvRow = {
  cliente_id: string;
  cod_oper: string;
  fecha_pedido: string;
  lista_precios: string;
  vendedor: string;
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

type FiDetRow = {
  cliente_id: string | null;
  plazo_id: string | null;
  pedido_id: string | null;
  lista_precio_id: string | null;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  vendedor_id: string | null;
  vendedor_nombre: string | null;
  fecha_pedido: Date | string | null;
  linea: string | null;
  referencia: string | null;
  material_code: string | null;
  color_code: string | null;
  grades_json: unknown;
  grada_text: string | null;
  linea_snapshot: unknown;
  precio_unit: string | null;
  precio_neto: string | null;
  precio_lista: string | null;
  precio_base_snap: string | null;
  unit_fob_ajustado: string | null;
  fid_id: number;
  payload_json: unknown;
  caso: string | null;
  cod_oper_carlos: string | null;
  codigo_barras: string | null;
  pares: string | null;
  cajas: string | null;
  proveedor_importacion_id: string | null;
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

/** Cod. Oper. — traductor Carlos (Condiciones Hector col A). Sin fallback cliente+plazo. */
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
  const casoCarlos = resolveCasoComercialCarlos(caso, payload);
  const cod = resolveCodigoVendedorReal({
    vendedor_nombre: vendedorNombre,
    caso: casoCarlos,
    codigo_vendedor_carlos: codigoPinned,
  });
  if (cod) return cod;
  throw new Error(
    `Código de vendedor real no resuelto · vendedor=${vendedorNombre ?? "—"} · caso=${casoCarlos}`,
  );
}

/** Col A Excel SDRM · fallback stock por snapshot si ppd huérfano. */
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

function fmtCantidad(n: string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "";
  return String(Math.trunc(v));
}

function fmtPrecioGs(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n));
}

function resolvePreciosLinea(r: FiDetRow): { bruto: string; neto: string } {
  const d1 = Number(r.descuento_1) || 0;
  const d2 = Number(r.descuento_2) || 0;
  const d3 = Number(r.descuento_3) || 0;
  const d4 = Number(r.descuento_4) || 0;
  const hayDesc = d1 + d2 + d3 + d4 > 0;

  const netoRaw = Number(r.precio_neto);
  const neto = Number.isFinite(netoRaw) && netoRaw > 0 ? netoRaw : Number(r.precio_unit);

  let bruto = Number(r.precio_base_snap);
  if (!Number.isFinite(bruto) || bruto <= 0) bruto = Number(r.precio_lista);
  if (!Number.isFinite(bruto) || bruto <= 0) bruto = Number(r.unit_fob_ajustado);
  if (!Number.isFinite(bruto) || bruto <= 0) bruto = Number(r.precio_unit);
  if ((!Number.isFinite(bruto) || bruto <= 0) && Number.isFinite(neto) && neto > 0 && hayDesc) {
    bruto = brutoDesdeNeto(neto, d1, d2, d3, d4);
  }
  if (!Number.isFinite(bruto) || bruto <= 0) bruto = neto;

  return {
    bruto: fmtPrecioGs(bruto),
    neto: fmtPrecioGs(Number.isFinite(neto) && neto > 0 ? neto : bruto),
  };
}

function mapDetalleRow(r: FiDetRow, cabecera: PeVentasCsvRow): PeVentasCsvRow {
  const { bruto, neto } = resolvePreciosLinea(r);
  return {
    ...cabecera,
    codigo_articulo: resolveCodigoArticuloCarlos(r),
    cant_pares: fmtCantidad(r.pares),
    precio_sin_descuento: bruto,
    precio_con_descuento: neto,
    fid_id: r.fid_id,
  };
}

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
      cab.descuento_1,
      cab.descuento_2,
      cab.descuento_3,
      cab.descuento_4,
      cab.codigo_articulo,
      cab.cant_pares,
      cab.precio_sin_descuento,
      cab.precio_con_descuento,
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
        "",
        "",
        "",
        "",
        r.codigo_articulo,
        r.cant_pares,
        r.precio_sin_descuento,
        r.precio_con_descuento,
      ]
        .map(tsvCell)
        .join("\t"),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export async function fetchPeVentasRowsByFiId(pool: Pool, fiId: number): Promise<PeVentasCsvRow[]> {
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
      COALESCE(NULLIF(TRIM(u.descp_usuario), ''), NULLIF(TRIM(pvr.payload_json->>'vendedor_nombre'), '')) AS vendedor_nombre,
      COALESCE(pp.fecha_arribo_real::timestamp, fi.fecha_confirmacion, fi.created_at) AS fecha_pedido,
      TRIM(COALESCE(ppd.linea, fid.linea_snapshot->>'linea_codigo', fid.linea_snapshot->>'linea')) AS linea,
      TRIM(COALESCE(ppd.referencia, fid.linea_snapshot->>'ref_codigo', fid.linea_snapshot->>'referencia')) AS referencia,
      COALESCE(ppd.material_code, fid.linea_snapshot->>'material_code', fid.linea_snapshot->>'material_codigo') AS material_code,
      COALESCE(ppd.color_code, fid.linea_snapshot->>'color_code', fid.linea_snapshot->>'color_codigo') AS color_code,
      COALESCE(ppd.grades_json, fid.linea_snapshot->'grades_json', fid.linea_snapshot->'gradas') AS grades_json,
      ppd.grada AS grada_text,
      fid.linea_snapshot,
      fid.precio_unit::text AS precio_unit,
      fid.precio_neto::text AS precio_neto,
      fid.precio_lista::text AS precio_lista,
      fid.linea_snapshot->>'precio_base' AS precio_base_snap,
      ppd.unit_fob_ajustado::text AS unit_fob_ajustado,
      fid.id AS fid_id,
      fid.pares::text AS pares,
      fid.cajas::text AS cajas,
      COALESCE(
        pe_stg.codigo_barras,
        snap_stock.codigo_barras,
        NULLIF(TRIM(fid.linea_snapshot->>'codigo_barras'), ''),
        NULLIF(TRIM(fid.linea_snapshot->>'codigo_articulo'), '')
      ) AS codigo_barras,
      pp.proveedor_importacion_id::text AS proveedor_importacion_id,
      NULLIF(TRIM(fi.caso), '') AS caso,
      pvr.payload_json
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(s.codigo_barras), '') AS codigo_barras
      FROM stock_pe_staging_migrated m
      JOIN stock_pronta_entrega_rimec s ON s.id = m.staging_id
      WHERE m.ppd_id = ppd.id
      ORDER BY s.id
      LIMIT 1
    ) pe_stg ON TRUE
    LEFT JOIN LATERAL (
      SELECT NULLIF(btrim(s.codigo_barras), '') AS codigo_barras
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
    WHERE fi.id = $1
      AND fi.estado = 'CONFIRMADA'
    ORDER BY fid.id
    `,
    [fiId],
  );

  if (!rows.length) return [];

  const head = rows[0];
  const cabeceraBase = {
    cliente_id: String(head.cliente_id ?? "").trim(),
    cod_oper: resolveCodOper(head.payload_json, head.cliente_id, head.plazo_id, head.cod_oper_carlos),
    fecha_pedido: fmtFechaPedido(head.fecha_pedido),
    lista_precios: listaPrecioLabel(
      head.lista_precio_id != null ? Number(head.lista_precio_id) : 1,
    ),
    vendedor: resolveVendedorCarlos(head.vendedor_nombre, head.caso, head.payload_json, null),
    descuento_1: fmtDescCsv(head.descuento_1),
    descuento_2: fmtDescCsv(head.descuento_2),
    descuento_3: fmtDescCsv(head.descuento_3),
    descuento_4: fmtDescCsv(head.descuento_4),
    codigo_articulo: "",
    cant_pares: "",
    precio_sin_descuento: "",
    precio_con_descuento: "",
    fid_id: head.fid_id,
  };

  return rows.map((r) => mapDetalleRow(r, cabeceraBase));
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
  const rows = await fetchPeVentasRowsByFiId(pool, fiId);
  if (!rows.length) {
    throw new Error("Sin líneas PE confirmadas para CSV ventas");
  }
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
