import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { gradesJsonToCompacto } from "./grades-csv-compact";
import { listaPrecioLabel } from "./aprobaciones-utils";

const CSV_HEADERS = [
  "Estado FI",
  "Fecha confirmación",
  "Fecha creación FI",
  "PV Global",
  "Nro Factura",
  "PP",
  "C. cliente",
  "C. Art. Prov",
  "Marca",
  "C. Mat",
  "Descrip Mat",
  "C. Cor",
  "Descrip Cor",
  "C. Grada",
  "GRUPO",
  "GRUPO2",
  "Tipo de IMG",
  "C. Prov",
  "Cantidad",
  "Plazo",
  "Lista",
  "Desc1",
  "Desc2",
  "Desc3",
  "Desc4",
  "Vendedor",
  "Cobrador",
] as const;

function escCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtTs(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function fmtPv(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return `PV${String(Math.trunc(n)).padStart(6, "0")}`;
}

/** CSV general — todas las FI con detalle, orden: fecha confirmación DESC (más nuevo arriba) */
export async function buildCsvGeneralAprobaciones(): Promise<string> {
  if (!isRimecDatabaseConfigured()) {
    throw new Error("DATABASE_URL no configurada");
  }

  const pool = getRimecPool();
  const { rows } = await pool.query(`
    SELECT
      fi.estado AS estado_fi,
      fi.fecha_confirmacion,
      fi.created_at AS fecha_creacion_fi,
      fi.pv_global,
      fi.nro_factura,
      pp.numero_registro AS pp_nro,
      fi.cliente_id,
      ppd.linea || '.' || ppd.referencia AS style,
      COALESCE(mv.descp_marca, fi.marca) AS marca,
      ppd.material_code,
      ppd.descp_material AS material_desc,
      ppd.color_code,
      ppd.descp_color AS color_desc,
      ppd.grades_json,
      COALESCE(lr.grupo_estilo_id, 0) AS grupo_estilo,
      fid.pares AS cantidad,
      COALESCE(plz.descp_plazo, 'N/A') AS plazo,
      fi.lista_precio_id,
      fi.descuento_1 AS desc1,
      fi.descuento_2 AS desc2,
      fi.descuento_3 AS desc3,
      fi.descuento_4 AS desc4,
      COALESCE(u.descp_usuario, 'N/A') AS vendedor,
      COALESCE(fi.caso, pl.nombre_caso_aplicado) AS caso,
      pl.nombre_caso_aplicado AS caso_lista
    FROM public.factura_interna fi
    JOIN public.factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN public.pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN public.marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN public.plazo_v2 plz ON plz.id_plazo = fi.plazo_id
    LEFT JOIN public.usuario_v2 u ON u.id_usuario = fi.vendedor_id
    LEFT JOIN public.pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN public.linea l ON l.codigo_proveedor::text = ppd.linea
    LEFT JOIN public.referencia ref ON ref.codigo_proveedor::text = ppd.referencia
      AND ref.linea_id = l.id
    LEFT JOIN public.linea_referencia lr ON lr.linea_id = l.id
      AND lr.referencia_id = ref.id
    LEFT JOIN public.material m ON m.codigo_proveedor::text = ppd.material_code
    LEFT JOIN LATERAL (
      SELECT icp2.precio_evento_id
      FROM public.intencion_compra_pedido icp2
      JOIN public.intencion_compra ic2 ON ic2.id = icp2.intencion_compra_id
      WHERE icp2.pedido_proveedor_id = fi.pp_id
        AND icp2.precio_evento_id IS NOT NULL
        AND (ppd.id_marca IS NULL OR ic2.id_marca = ppd.id_marca::bigint)
      ORDER BY (
        CASE
          WHEN ppd.id_marca IS NOT NULL AND ic2.id_marca = ppd.id_marca::bigint THEN 0
          ELSE 1
        END
      ), icp2.id
      LIMIT 1
    ) ev ON true
    LEFT JOIN LATERAL (
      SELECT pl2.nombre_caso_aplicado
      FROM public.precio_lista pl2
      WHERE pl2.evento_id = ev.precio_evento_id
        AND pl2.linea_id = COALESCE(l.id, ref.linea_id)
        AND pl2.referencia_id = ref.id
        AND pl2.material_id = m.id
      LIMIT 1
    ) pl ON true
    WHERE fi.estado IN ('RESERVADA', 'CONFIRMADA', 'ANULADA')
    ORDER BY
      COALESCE(fi.fecha_confirmacion, fi.created_at) DESC NULLS LAST,
      fi.id DESC,
      fid.id
  `);

  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const r of rows) {
    const caso = r.caso ?? r.caso_lista ?? "";
    const lista = listaPrecioLabel(
      r.lista_precio_id != null ? Number(r.lista_precio_id) : 1,
    );
    lines.push(
      [
        r.estado_fi,
        fmtTs(r.fecha_confirmacion),
        fmtTs(r.fecha_creacion_fi),
        fmtPv(r.pv_global),
        r.nro_factura,
        r.pp_nro,
        r.cliente_id,
        r.style,
        r.marca,
        r.material_code,
        r.material_desc,
        r.color_code,
        r.color_desc,
        gradesJsonToCompacto(r.grades_json),
        caso,
        r.grupo_estilo,
        "M",
        654,
        r.cantidad,
        r.plazo,
        lista,
        r.desc1,
        r.desc2,
        r.desc3,
        r.desc4,
        r.vendedor,
        90,
      ]
        .map(escCsv)
        .join(","),
    );
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function csvGeneralFilename(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15);
  return `aprobaciones_csv_general_${stamp}.csv`;
}
