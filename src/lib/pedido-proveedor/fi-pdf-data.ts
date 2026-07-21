import { listaPrecioLabel } from "@/app/aprobaciones/lib/aprobaciones-utils";
import {
  enrichLineaSnapshotFromPpd,
  parseLineaSnapshotForDisplay,
  gradasDisplayFromSnapshot,
} from "@/app/aprobaciones/lib/linea-snapshot-display";
import { getRimecPool } from "@/lib/rimec/pool";
import type { PVData, PVItem } from "@/lib/pedido-proveedor/fi-pdf-generator";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fiNumeroDisplay(nroFactura: string, pvGlobal: number | null): string {
  if (pvGlobal != null && pvGlobal !== 0) {
    return `PV${String(Math.trunc(pvGlobal)).padStart(6, "0")}`;
  }
  return nroFactura?.trim() || "N/A";
}

const FI_HEADER_SQL = `
  SELECT
    fi.id,
    fi.nro_factura,
    fi.pv_global,
    fi.pp_id,
    pp.numero_registro AS pp_nro,
    pp.numero_proforma AS proforma,
    qa.descripcion AS quincena_llegada,
    COALESCE(NULLIF(TRIM(fi.marca), ''), NULLIF(TRIM(mv.descp_marca), ''), '—') AS marca,
    COALESCE(NULLIF(TRIM(fi.caso), ''), '—') AS caso,
    fi.total_pares,
    fi.total_monto,
    fi.estado,
    fi.cliente_id,
    c.descp_cliente AS cliente_nombre,
    c.id_cliente AS cliente_codigo,
    COALESCE(NULLIF(TRIM(vd_fi.descp_vendedor), ''), NULLIF(TRIM(vd_ic.descp_vendedor), ''), '—') AS vendedor_nombre,
    COALESCE(NULLIF(TRIM(pl.descp_plazo), ''), NULLIF(TRIM(pl_ic.descp_plazo), ''), '—') AS plazo_nombre,
    COALESCE(fi.lista_precio_id, ic.listado_precio_id) AS lista_precio_id,
    COALESCE(fi.descuento_1, ic.descuento_1, 0) AS descuento_1,
    COALESCE(fi.descuento_2, ic.descuento_2, 0) AS descuento_2,
    COALESCE(fi.descuento_3, ic.descuento_3, 0) AS descuento_3,
    COALESCE(fi.descuento_4, ic.descuento_4, 0) AS descuento_4,
    fi.created_at::text AS created_at
  FROM public.factura_interna fi
  LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
  LEFT JOIN public.quincena_arribo qa ON qa.id = pp.quincena_arribo_id
  LEFT JOIN public.cliente_v2 c ON c.id_cliente = fi.cliente_id
  LEFT JOIN public.plazo_v2 pl ON pl.id_plazo = fi.plazo_id
  LEFT JOIN LATERAL (
    SELECT ic.id_vendedor, ic.id_plazo, ic.id_marca, ic.listado_precio_id,
           ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
    FROM public.intencion_compra_pedido icp
    JOIN public.intencion_compra ic ON ic.id = icp.intencion_compra_id
    WHERE icp.pedido_proveedor_id = fi.pp_id
      AND ic.id_cliente = fi.cliente_id
    ORDER BY ABS(ic.cantidad_total_pares - COALESCE(fi.total_pares, 0)) ASC, ic.id ASC
    LIMIT 1
  ) ic ON true
  LEFT JOIN public.vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
  LEFT JOIN public.vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor
  LEFT JOIN public.plazo_v2 pl_ic ON pl_ic.id_plazo = COALESCE(fi.plazo_id, ic.id_plazo)
  LEFT JOIN public.marca_v2 mv ON mv.id_marca = ic.id_marca
  WHERE fi.id = $1
  LIMIT 1
`;

const FI_ITEMS_SQL = `
  SELECT
    fid.id,
    fid.cajas,
    fid.pares,
    fid.precio_unit,
    fid.subtotal,
    fid.precio_neto,
    fid.linea_snapshot,
    ppd.linea AS ppd_linea,
    ppd.referencia AS ppd_referencia,
    ppd.material_code AS ppd_material_code,
    ppd.color_code AS ppd_color_code,
    ppd.grades_json,
    ppd.descp_material AS ppd_descp_material
  FROM public.factura_interna_detalle fid
  LEFT JOIN public.pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
  WHERE fid.factura_id = $1
  ORDER BY fid.id
`;

export type FiPdfPayload = {
  pvData: PVData;
  items: PVItem[];
};

export async function fetchFiPdfPayload(fiId: number): Promise<FiPdfPayload | null> {
  const pool = getRimecPool();
  const { rows: fiRows } = await pool.query(FI_HEADER_SQL, [fiId]);
  const fi = fiRows[0] as Record<string, unknown> | undefined;
  if (!fi) return null;

  const { rows: itemRows } = await pool.query(FI_ITEMS_SQL, [fiId]);
  if (itemRows.length === 0) return null;

  const pvGlobal = fi.pv_global != null ? num(fi.pv_global) : null;
  const listaId = fi.lista_precio_id != null ? num(fi.lista_precio_id) : 1;

  const pvData: PVData = {
    pv_numero: fiNumeroDisplay(String(fi.nro_factura ?? ""), pvGlobal),
    cliente_codigo: num(fi.cliente_codigo),
    cliente_nombre: String(fi.cliente_nombre ?? "Sin cliente"),
    vendedor_nombre: String(fi.vendedor_nombre ?? "—"),
    quincena_llegada: String(fi.quincena_llegada ?? "A confirmar"),
    pp_nro: String(fi.pp_nro ?? "N/A"),
    proforma: fi.proforma ? String(fi.proforma) : undefined,
    created_at: String(fi.created_at ?? new Date().toISOString()),
    lista_precio: listaPrecioLabel(listaId),
    plazo: String(fi.plazo_nombre ?? "N/A"),
    descuento_1: num(fi.descuento_1),
    descuento_2: num(fi.descuento_2),
    descuento_3: num(fi.descuento_3),
    descuento_4: num(fi.descuento_4),
    marca: String(fi.marca ?? "N/A"),
    caso: String(fi.caso ?? ""),
    total_pares: num(fi.total_pares),
    total_monto: num(fi.total_monto),
  };

  const items: PVItem[] = itemRows.map((row) => {
    const r = row as Record<string, unknown>;
    const snapRaw = enrichLineaSnapshotFromPpd(r.linea_snapshot, {
      linea: r.ppd_linea != null ? String(r.ppd_linea) : null,
      referencia: r.ppd_referencia != null ? String(r.ppd_referencia) : null,
      material_code: r.ppd_material_code != null ? String(r.ppd_material_code) : null,
      color_code: r.ppd_color_code != null ? String(r.ppd_color_code) : null,
      grades_json: r.grades_json,
    });
    const snap = parseLineaSnapshotForDisplay(snapRaw);
    let gradasFmt = snap.gradas_display;
    if (!gradasFmt.trim()) {
      gradasFmt =
        gradasDisplayFromSnapshot({ grades_json: r.grades_json }) ||
        gradasDisplayFromSnapshot({ gradas: r.grades_json });
    }

    const materialNombre =
      snap.material_nombre ||
      (r.ppd_descp_material != null ? String(r.ppd_descp_material) : "");

    return {
      linea_codigo: snap.linea_codigo,
      ref_codigo: snap.ref_codigo,
      color_nombre: snap.color_nombre,
      material_nombre: materialNombre,
      imagen_url: snap.imageCandidates[0] ?? "",
      gradas_fmt: gradasFmt,
      cajas: num(r.cajas),
      pares: num(r.pares),
      precio_unit: num(r.precio_unit),
      precio_neto: num(r.precio_neto),
      subtotal: num(r.subtotal),
    };
  });

  return { pvData, items };
}
