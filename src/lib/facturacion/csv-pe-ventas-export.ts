/**
 * CSV ventas PE — formato Carlos stock pronta entrega.
 * Referencia canónica: csv's/stock's/ventas PE/7954_3114.csv
 * · TSV 15 cols · CRLF · sin BOM · fila 1 cabecera completa · resto solo cols 11–15
 */
import type { Pool } from "pg";
import {
  gradasDisplayFromSnapshot,
  gradasFmtFromJson,
  parseLineaSnapshotForDisplay,
} from "@/app/aprobaciones/lib/linea-snapshot-display";
import { brutoDesdeNeto, listaPrecioLabel } from "@/app/aprobaciones/lib/aprobaciones-utils";
import { parseGradesJson } from "@/lib/pedido-proveedor/ala-norte-grades";
import {
  carlosVendedorIdFrancis,
  loadFrancisTranslator,
} from "@/lib/pedido-proveedor/csv-vendedor-francis";

const HEADER =
  "Cliente\tCod. Oper.\tF. Pedido\tLista precios\tcobrador\tvendedor\tDes. 1\tDes. 2\tDes. 3\tDes. 4\tCod. Art. Proveedor\tCod. Mat\tCod. Color\tDescripcion de grada\tPrecio Venta";

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
  cod_art_proveedor: string;
  cod_mat: string;
  cod_color: string;
  descripcion_grada: string;
  precio_venta: string;
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
  precio_base_snap: string | null;
  unit_fob_ajustado: string | null;
  fid_id: number;
  payload_json: unknown;
  caso: string | null;
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

/** Cod. Oper. — payload legacy si existe; si no CR-{cliente}{plazo 3 díg}. */
function resolveCodOper(
  payload: unknown,
  clienteId: string | null,
  plazoId: string | null,
): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    const direct = p.cod_oper ?? p.cod_operacion ?? p.codigo_operacion;
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }
  const c = String(clienteId ?? "").trim();
  const pl = String(plazoId ?? "").trim();
  if (!c) return "CR-0";
  const plazoPad = pl ? pl.padStart(3, "0") : "000";
  return `CR-${c}${plazoPad}`;
}

function resolveVendedorCarlos(vendedorId: string | null, caso: string | null): string {
  const n = Number(vendedorId);
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
  return String(carlosVendedorIdFrancis(caso, loadFrancisTranslator()));
}

function normalizarEspaciosGrada(fmt: string): string {
  return fmt.replace(/\(([^)]+)\)/g, (_, inner) => {
    const normalized = String(inner).replace(/-/g, " ").replace(/\s+/g, " ").trim();
    return `(${normalized})`;
  });
}

function gradaPeDisplay(gradesJson: unknown, gradaText: string | null, snapshot: unknown): string {
  const snapObj =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};

  if (
    gradesJson != null &&
    typeof gradesJson === "object" &&
    !Array.isArray(gradesJson) &&
    !("linea_codigo" in (gradesJson as Record<string, unknown>))
  ) {
    const fromJson = gradasDisplayFromSnapshot({ grades_json: gradesJson }).trim();
    if (fromJson) return normalizarEspaciosGrada(fromJson);
  }

  const fromSnap = gradasDisplayFromSnapshot(snapObj).trim();
  if (fromSnap) return normalizarEspaciosGrada(fromSnap);

  const grades = parseGradesJson(snapObj.grades_json ?? snapObj.gradas);
  const built = gradasFmtFromJson(grades);
  if (built) return normalizarEspaciosGrada(built);

  const raw = (gradaText ?? "").trim();
  return raw ? normalizarEspaciosGrada(raw) : "";
}

function codArtProveedor(linea: string | null, referencia: string | null): string {
  const l = (linea ?? "").trim();
  const r = (referencia ?? "").trim();
  if (l && r) return `${l}.${r}`;
  return l || r || "";
}

function resolvePrecioVenta(r: FiDetRow): string {
  const d1 = Number(r.descuento_1) || 0;
  const d2 = Number(r.descuento_2) || 0;
  const d3 = Number(r.descuento_3) || 0;
  const d4 = Number(r.descuento_4) || 0;

  const baseSnap = Number(r.precio_base_snap);
  if (Number.isFinite(baseSnap) && baseSnap > 0) return String(Math.round(baseSnap));

  const unitFob = Number(r.unit_fob_ajustado);
  if (Number.isFinite(unitFob) && unitFob > 0) return String(Math.round(unitFob));

  const unit = Number(r.precio_unit);
  if (Number.isFinite(unit) && unit > 0) return String(Math.round(unit));

  const neto = Number(r.precio_neto);
  if (Number.isFinite(neto) && neto > 0) {
    if (d1 + d2 + d3 + d4 > 0) {
      return String(Math.round(brutoDesdeNeto(neto, d1, d2, d3, d4)));
    }
    return String(Math.round(neto));
  }

  return "0";
}

function mapDetalleRow(r: FiDetRow, cabecera: PeVentasCsvRow): PeVentasCsvRow {
  const snap = parseLineaSnapshotForDisplay(r.linea_snapshot);
  const linea = (r.linea ?? snap.linea_codigo).replace(/^\?+$/, "") || snap.linea_codigo;
  const referencia = (r.referencia ?? snap.ref_codigo).replace(/^\?+$/, "") || snap.ref_codigo;

  return {
    ...cabecera,
    cod_art_proveedor: codArtProveedor(linea, referencia),
    cod_mat: (r.material_code ?? snap.material_code ?? "").trim(),
    cod_color: (r.color_code ?? snap.color_code ?? "").trim(),
    descripcion_grada: gradaPeDisplay(r.grades_json, r.grada_text, r.linea_snapshot),
    precio_venta: resolvePrecioVenta(r),
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
      cab.cod_art_proveedor,
      cab.cod_mat,
      cab.cod_color,
      cab.descripcion_grada,
      cab.precio_venta,
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
        r.cod_art_proveedor,
        r.cod_mat,
        r.cod_color,
        r.descripcion_grada,
        r.precio_venta,
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
      fi.pedido_id::text AS pedido_id,
      fi.lista_precio_id::text AS lista_precio_id,
      COALESCE(fi.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, 0)::text AS descuento_4,
      fi.vendedor_id::text AS vendedor_id,
      COALESCE(fi.fecha_confirmacion, fi.created_at) AS fecha_pedido,
      TRIM(COALESCE(ppd.linea, fid.linea_snapshot->>'linea_codigo', fid.linea_snapshot->>'linea')) AS linea,
      TRIM(COALESCE(ppd.referencia, fid.linea_snapshot->>'ref_codigo', fid.linea_snapshot->>'referencia')) AS referencia,
      COALESCE(ppd.material_code, fid.linea_snapshot->>'material_code', fid.linea_snapshot->>'material_codigo') AS material_code,
      COALESCE(ppd.color_code, fid.linea_snapshot->>'color_code', fid.linea_snapshot->>'color_codigo') AS color_code,
      COALESCE(ppd.grades_json, fid.linea_snapshot->'grades_json', fid.linea_snapshot->'gradas') AS grades_json,
      ppd.grada AS grada_text,
      fid.linea_snapshot,
      fid.precio_unit::text AS precio_unit,
      fid.precio_neto::text AS precio_neto,
      fid.linea_snapshot->>'precio_base' AS precio_base_snap,
      ppd.unit_fob_ajustado::text AS unit_fob_ajustado,
      fid.id AS fid_id,
      NULLIF(TRIM(fi.caso), '') AS caso,
      pvr.payload_json
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN pedido_venta_rimec pvr ON pvr.id = fi.pedido_id
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
    cod_oper: resolveCodOper(head.payload_json, head.cliente_id, head.plazo_id),
    fecha_pedido: fmtFechaPedido(head.fecha_pedido),
    lista_precios: listaPrecioLabel(
      head.lista_precio_id != null ? Number(head.lista_precio_id) : 1,
    ),
    vendedor: resolveVendedorCarlos(head.vendedor_id, head.caso),
    descuento_1: fmtDescCsv(head.descuento_1),
    descuento_2: fmtDescCsv(head.descuento_2),
    descuento_3: fmtDescCsv(head.descuento_3),
    descuento_4: fmtDescCsv(head.descuento_4),
    cod_art_proveedor: "",
    cod_mat: "",
    cod_color: "",
    descripcion_grada: "",
    precio_venta: "",
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
