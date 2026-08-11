/**
 * CSV precios Tito — formato simple FI (L+R+marca+cant+cliente+montos+D1..D4).
 * No reemplaza CSV ventas Carlos ni CSV inicial.
 */
import type { Pool } from "pg";
import { SQL_VENDEDOR_PP_FI_NOMBRE } from "@/lib/pedido-proveedor/vendedor-pp-integridad";

const HEADER =
  "LINEA;REFERENCIA;MARCA;C. Mat;C. Cor;CANT;FacturaInterna;CLIENTE;NOMBRE DEL CLIENTE;NOMBRE VENDEDOR;D1;D2;D3;D4;Precio Unitario;Monto Sin Desc;Monto Con Desc";

const VENDEDOR_JOINS_SQL = `
  LEFT JOIN vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
  LEFT JOIN vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor`;

type CsvPreciosRow = {
  linea: string | null;
  referencia: string | null;
  marca: string | null;
  material_code: string | null;
  color_code: string | null;
  cant: string;
  factura_interna: string | null;
  cliente: string | null;
  nombre_cliente: string | null;
  nombre_vendedor: string | null;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  precio_unitario: string;
  monto_sin_desc: string;
  monto_con_desc: string;
};

function esc(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDesc(n: string | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return Number.isInteger(v) ? String(v) : String(v);
}

function fmtMonto(n: string | number | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return String(Math.round(v));
}

export function csvPreciosFilename(numeroRegistro: string): string {
  return `${numeroRegistro.replace(/[^\w.-]+/g, "_")}_csv_precios.csv`;
}

async function fetchCsvPreciosRows(
  pool: Pool,
  ppId: number,
  programado: boolean,
): Promise<CsvPreciosRow[]> {
  const estados = programado ? ["RESERVADA", "CONFIRMADA"] : ["CONFIRMADA"];
  const { rows } = await pool.query<CsvPreciosRow>(
    `
    SELECT
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      COALESCE(NULLIF(TRIM(mv.descp_marca), ''), NULLIF(TRIM(fi.marca), ''), '') AS marca,
      NULLIF(TRIM(ppd.material_code), '') AS material_code,
      NULLIF(TRIM(ppd.color_code), '') AS color_code,
      COALESCE(fid.pares, 0)::text AS cant,
      COALESCE(
        NULLIF(TRIM(fi.factura_carlos), ''),
        NULLIF(TRIM(fi.pv_global::text), ''),
        NULLIF(regexp_replace(COALESCE(fi.nro_factura, ''), '[^0-9]', '', 'g'), ''),
        NULLIF(TRIM(fi.nro_factura), ''),
        fi.id::text
      ) AS factura_interna,
      COALESCE(c.id_cliente, fi.cliente_id)::text AS cliente,
      COALESCE(NULLIF(TRIM(c.descp_cliente), ''), '') AS nombre_cliente,
      ${SQL_VENDEDOR_PP_FI_NOMBRE} AS nombre_vendedor,
      COALESCE(fi.descuento_1, ic.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, ic.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, ic.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, ic.descuento_4, 0)::text AS descuento_4,
      ROUND(COALESCE(fid.precio_unit, 0))::text AS precio_unitario,
      ROUND(COALESCE(fid.precio_unit, 0) * COALESCE(fid.pares, 0))::text AS monto_sin_desc,
      ROUND(COALESCE(fid.subtotal, COALESCE(fid.precio_neto, 0) * COALESCE(fid.pares, 0)))::text AS monto_con_desc
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN cliente_v2 c ON c.id_cliente = fi.cliente_id
    LEFT JOIN LATERAL (
      SELECT ic.id_vendedor,
             ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND ic.id_cliente = fi.cliente_id
      ORDER BY ic.id
      LIMIT 1
    ) ic ON TRUE
    ${VENDEDOR_JOINS_SQL}
    WHERE fi.pp_id = $1
      AND fi.estado = ANY($2::text[])
    ORDER BY fi.id, fid.id
    `,
    [ppId, estados],
  );
  return rows;
}

export async function exportCsvPreciosPp(
  pool: Pool,
  ppId: number,
  opts: { numeroRegistro: string; categoriaId: number | null },
): Promise<{ content: string; filename: string }> {
  const programado = opts.categoriaId === 3;
  const rows = await fetchCsvPreciosRows(pool, ppId, programado);
  if (rows.length === 0) {
    throw new Error(
      programado
        ? "Sin filas FI — importá / ratificá primero"
        : "Sin FI confirmadas con detalle — CSV precios no disponible",
    );
  }

  const lines = [
    HEADER,
    ...rows.map((r) =>
      [
        esc(r.linea),
        esc(r.referencia),
        esc(r.marca),
        esc(r.material_code),
        esc(r.color_code),
        esc(r.cant),
        esc(r.factura_interna),
        esc(r.cliente),
        esc(r.nombre_cliente),
        esc(r.nombre_vendedor),
        fmtDesc(r.descuento_1),
        fmtDesc(r.descuento_2),
        fmtDesc(r.descuento_3),
        fmtDesc(r.descuento_4),
        fmtMonto(r.precio_unitario),
        fmtMonto(r.monto_sin_desc),
        fmtMonto(r.monto_con_desc),
      ].join(";"),
    ),
  ];

  return {
    content: `\uFEFF${lines.join("\r\n")}\r\n`,
    filename: csvPreciosFilename(opts.numeroRegistro),
  };
}
