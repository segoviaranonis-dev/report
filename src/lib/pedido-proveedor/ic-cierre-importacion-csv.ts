import type { Pool } from "pg";
import {
  FACTURA_REAL_LABEL,
  FI_NEXUS_LABEL,
  facturaRealDesdeRow,
} from "@/lib/logistica-ok/factura-real";

export type IcCierreImportacionRow = {
  proveedor: string;
  pp_nro: string;
  nro_ic: string;
  id_cliente: number;
  cliente: string;
  marca: string;
  vendedor: string;
  categoria: string;
  pares: number;
  monto_bruto: number;
  monto_neto: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  plazo: string;
  evento: string;
  listado_lp: number | null;
  nro_pedido_fabrica: string | null;
  fi_nexus: string | null;
  fi_estado: string | null;
  pv_global: number | null;
  factura_carlos: string | null;
};

const HEADERS = [
  "Proveedor",
  "PP",
  "Nro IC",
  "Cód cliente",
  "Cliente",
  "Marca",
  "Vendedor",
  "Categoría",
  "Pares",
  "Monto bruto",
  "Monto neto",
  "D1",
  "D2",
  "D3",
  "D4",
  "Plazo",
  "Evento precio",
  "Listado LP",
  "Nro pedido fábrica",
  FI_NEXUS_LABEL,
  "Estado FI",
  FACTURA_REAL_LABEL,
] as const;

function escCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function cierreImportacionCsvFilename(ppNro: string): string {
  const safe = ppNro.replace(/[^\w-]+/g, "_");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15);
  return `cierre_importacion_${safe}_${stamp}.csv`;
}

/** IC vinculadas al PP + Factura Real (Carlos · pv_global) — cierre antes de Compras */
export async function listIcCierreImportacionRows(
  pool: Pool,
  ppId: number,
): Promise<IcCierreImportacionRow[]> {
  const { rows } = await pool.query<{
    proveedor: string;
    pp_nro: string;
    nro_ic: string;
    id_cliente: string;
    cliente: string;
    marca: string;
    vendedor: string;
    categoria: string;
    pares: string;
    monto_bruto: string;
    monto_neto: string;
    descuento_1: string;
    descuento_2: string;
    descuento_3: string;
    descuento_4: string;
    plazo: string;
    evento: string;
    listado_lp: string | null;
    nro_pedido_fabrica: string | null;
    fi_nexus: string | null;
    fi_estado: string | null;
    pv_global: string | null;
    factura_carlos: string | null;
  }>(
    `
    SELECT COALESCE(pi.nombre, '—') AS proveedor,
           pp.numero_registro AS pp_nro,
           ic.numero_registro AS nro_ic,
           ic.id_cliente::text AS id_cliente,
           COALESCE(cv.descp_cliente, '—') AS cliente,
           mv.descp_marca AS marca,
           COALESCE(vd.descp_vendedor, '—') AS vendedor,
           COALESCE(cat.descp_categoria, '—') AS categoria,
           ic.cantidad_total_pares::text AS pares,
           COALESCE(ic.monto_bruto, 0)::text AS monto_bruto,
           COALESCE(ic.monto_neto, 0)::text AS monto_neto,
           COALESCE(ic.descuento_1, 0)::text AS descuento_1,
           COALESCE(ic.descuento_2, 0)::text AS descuento_2,
           COALESCE(ic.descuento_3, 0)::text AS descuento_3,
           COALESCE(ic.descuento_4, 0)::text AS descuento_4,
           COALESCE(NULLIF(TRIM(pl.descp_plazo), ''), '—') AS plazo,
           COALESCE(pe.nombre_evento, '—') AS evento,
           ic.listado_precio_id::text AS listado_lp,
           icp.nro_pedido_fabrica,
           fi.nro_factura AS fi_nexus,
           fi.estado AS fi_estado,
           fi.pv_global::text AS pv_global,
           fi.factura_carlos
    FROM intencion_compra ic
    JOIN intencion_compra_pedido icp
      ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = $1
    JOIN pedido_proveedor pp ON pp.id = $1
    JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
    LEFT JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
    LEFT JOIN proveedor_importacion pi ON pi.id = ic.id_proveedor
    LEFT JOIN vendedor_v2 vd ON vd.id_vendedor = ic.id_vendedor
    LEFT JOIN categoria_v2 cat ON cat.id_categoria = ic.categoria_id
    LEFT JOIN plazo_v2 pl ON pl.id_plazo = ic.id_plazo
    LEFT JOIN precio_evento pe ON pe.id = icp.precio_evento_id
    LEFT JOIN LATERAL (
      SELECT f.nro_factura, f.estado, f.pv_global, f.factura_carlos
      FROM factura_interna f
      WHERE f.pp_id = $1
        AND (
          (f.cliente_id = ic.id_cliente AND f.marca_id = ic.id_marca)
          OR BTRIM(COALESCE(f.notas, '')) = ic.numero_registro
        )
      ORDER BY
        CASE WHEN BTRIM(COALESCE(f.notas, '')) = ic.numero_registro THEN 0 ELSE 1 END,
        f.id
      LIMIT 1
    ) fi ON true
    ORDER BY pi.nombre NULLS LAST, ic.numero_registro ASC
    `,
    [ppId],
  );

  return rows.map((r) => ({
    proveedor: r.proveedor,
    pp_nro: r.pp_nro,
    nro_ic: r.nro_ic,
    id_cliente: Number(r.id_cliente),
    cliente: r.cliente,
    marca: r.marca,
    vendedor: r.vendedor,
    categoria: r.categoria,
    pares: Number(r.pares ?? 0),
    monto_bruto: Number(r.monto_bruto ?? 0),
    monto_neto: Number(r.monto_neto ?? 0),
    descuento_1: Number(r.descuento_1 ?? 0),
    descuento_2: Number(r.descuento_2 ?? 0),
    descuento_3: Number(r.descuento_3 ?? 0),
    descuento_4: Number(r.descuento_4 ?? 0),
    plazo: r.plazo,
    evento: r.evento,
    listado_lp: r.listado_lp != null ? Number(r.listado_lp) : null,
    nro_pedido_fabrica: r.nro_pedido_fabrica,
    fi_nexus: r.fi_nexus,
    fi_estado: r.fi_estado,
    pv_global: r.pv_global != null ? Number(r.pv_global) : null,
    factura_carlos: r.factura_carlos?.trim() || null,
  }));
}

export function buildIcCierreImportacionCsv(rows: IcCierreImportacionRow[]): string {
  const byProveedor = new Map<string, IcCierreImportacionRow[]>();
  for (const row of rows) {
    const key = row.proveedor.trim() || "—";
    const list = byProveedor.get(key) ?? [];
    list.push(row);
    byProveedor.set(key, list);
  }

  const proveedores = [...byProveedor.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const lines: string[] = [];

  lines.push(
    escCsv(
      `# Cierre importación · ${rows.length} IC · columna "${FACTURA_REAL_LABEL}" = sistema Carlos (factura_carlos)`,
    ),
  );
  lines.push(HEADERS.join(","));

  for (const prov of proveedores) {
    const group = byProveedor.get(prov) ?? [];
    const conFactura = group.filter((g) =>
      facturaRealDesdeRow({ pv_global: g.pv_global, factura_carlos: g.factura_carlos }),
    ).length;
    lines.push(
      escCsv(`# PROVEEDOR: ${prov} (${group.length} IC · ${conFactura} con ${FACTURA_REAL_LABEL})`),
    );
    for (const r of group) {
      lines.push(
        [
          r.proveedor,
          r.pp_nro,
          r.nro_ic,
          String(r.id_cliente),
          r.cliente,
          r.marca,
          r.vendedor,
          r.categoria,
          String(r.pares),
          String(r.monto_bruto),
          String(r.monto_neto),
          String(r.descuento_1),
          String(r.descuento_2),
          String(r.descuento_3),
          String(r.descuento_4),
          r.plazo,
          r.evento,
          r.listado_lp != null ? String(r.listado_lp) : "",
          r.nro_pedido_fabrica ?? "",
          r.fi_nexus ?? "",
          r.fi_estado ?? "",
          facturaRealDesdeRow({ pv_global: r.pv_global, factura_carlos: r.factura_carlos }),
        ]
          .map(escCsv)
          .join(","),
      );
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}
