import type { Pool } from "pg";
import { fiListaTier } from "@/lib/pedido-proveedor/aritmetica-programado";
import type { PpIcVinculada } from "@/lib/pedido-proveedor/detail-query";
import { listIcsVinculadasPp } from "@/lib/pedido-proveedor/detail-query";
import { labelListadoPrecio, type ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import { normAdminEtiqueta, subtotalSinDescuento } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { loadMapaCasoPorLineaEvento } from "@/lib/motor-precios/caso-linea-evento";

export type PfArticuloRow = {
  ppd_id: number;
  linea: string;
  referencia: string;
  material_code: string;
  material: string;
  color_code: string;
  color: string;
  grada: string | null;
  pares: number;
  lpn: number;
  lpc02: number;
  lpc03: number;
  lpc04: number;
  precio_unit: number;
  subtotal: number;
};

export type PreFacturaInterna = {
  pf_key: string;
  id_cliente: number;
  marca: string;
  id_marca: number;
  caso: string;
  listado_tier: ListadoPrecioTierId;
  listado_label: string;
  total_pares: number;
  total_monto: number;
  articulos: PfArticuloRow[];
};

export type IcAdminRow = PpIcVinculada & {
  /** Monto registrado en IC (bruto · referencia comercial). */
  monto_ic: number;
  /** Monto calculado proforma × listado IC · sin descuentos (fase parejas). */
  monto_proforma: number;
  listado_tier: ListadoPrecioTierId;
  listado_label: string;
};

export type AdministradorIcPayload = {
  ics: IcAdminRow[];
  prefacturas: PreFacturaInterna[];
};

type PpdPfRow = {
  ppd_id: number;
  shop: string;
  id_marca: number;
  marca: string;
  caso: string;
  linea: string;
  referencia: string;
  material_code: string;
  material: string;
  color_code: string;
  color: string;
  grada: string | null;
  pares: number;
  lpn: number;
  lpc02: number;
  lpc03: number;
  lpc04: number;
};

function buildArticulo(r: PpdPfRow, tier: ListadoPrecioTierId): PfArticuloRow {
  const { precio_unit, subtotal } = subtotalSinDescuento(
    { lpn: r.lpn, lpc02: r.lpc02, lpc03: r.lpc03, lpc04: r.lpc04 },
    tier,
    r.pares,
  );
  return {
    ppd_id: r.ppd_id,
    linea: r.linea,
    referencia: r.referencia,
    material_code: r.material_code ?? "",
    material: r.material,
    color_code: r.color_code ?? "",
    color: r.color,
    grada: r.grada,
    pares: r.pares,
    lpn: r.lpn,
    lpc02: r.lpc02,
    lpc03: r.lpc03,
    lpc04: r.lpc04,
    precio_unit,
    subtotal,
  };
}

function resolveCasoNorm(r: PpdPfRow, mapaCasoLinea: Map<string, string>): string {
  const lineaNorm = String(Math.trunc(Number(r.linea)));
  const casoPl = r.caso.trim();
  const casoMatriz = mapaCasoLinea.get(lineaNorm) ?? "";
  return (casoPl && casoPl !== "—" ? casoPl : casoMatriz).trim() || "—";
}

function ppdRowParIc(
  ic: PpIcVinculada,
  r: PpdPfRow,
  mapaCasoLinea: Map<string, string>,
): boolean {
  if (Number(r.shop) !== ic.id_cliente) return false;
  if (r.id_marca === ic.id_marca) return true;
  const casoNorm = resolveCasoNorm(r, mapaCasoLinea);
  if (!casoNorm || casoNorm === "—") return false;
  return normAdminEtiqueta(ic.marca) === normAdminEtiqueta(casoNorm);
}

function estimateIcMontoProforma(
  ic: PpIcVinculada,
  ppdRows: PpdPfRow[],
  mapaCasoLinea: Map<string, string>,
): number {
  const tier = fiListaTier(ic.listado_precio_id ?? 1);
  let sum = 0;
  for (const r of ppdRows) {
    if (!ppdRowParIc(ic, r, mapaCasoLinea)) continue;
    const { subtotal } = subtotalSinDescuento(
      { lpn: r.lpn, lpc02: r.lpc02, lpc03: r.lpc03, lpc04: r.lpc04 },
      tier,
      r.pares,
    );
    sum += subtotal;
  }
  return Math.round(sum * 100) / 100;
}

export async function loadAdministradorIcPp(pool: Pool, ppId: number): Promise<AdministradorIcPayload> {
  const [icsRaw, ppMeta] = await Promise.all([
    listIcsVinculadasPp(pool, ppId),
    pool.query<{ evento_id: number | null }>(
      `SELECT icp.precio_evento_id::int AS evento_id
       FROM intencion_compra_pedido icp
       WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
       ORDER BY icp.id LIMIT 1`,
      [ppId],
    ),
  ]);

  const eventoId = ppMeta.rows[0]?.evento_id ?? null;
  const mapaCasoLinea = eventoId ? await loadMapaCasoPorLineaEvento(pool, eventoId) : new Map<string, string>();

  const { rows: ppdRows } = await pool.query<PpdPfRow>(
    `
    SELECT
      ppd.id AS ppd_id,
      COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '0') AS shop,
      ppd.id_marca,
      mv.descp_marca AS marca,
      COALESCE(NULLIF(TRIM(pl.nombre_caso_aplicado), ''), '—') AS caso,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      ppd.material_code,
      COALESCE(ppd.descp_material, '') AS material,
      ppd.color_code,
      COALESCE(ppd.descp_color, '') AS color,
      ppd.grada,
      COALESCE(ppd.cantidad_pares, 0)::int AS pares,
      COALESCE(pl.lpn, 0)::float AS lpn,
      COALESCE(pl.lpc02, 0)::float AS lpc02,
      COALESCE(pl.lpc03, 0)::float AS lpc03,
      COALESCE(pl.lpc04, 0)::float AS lpc04
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
    LEFT JOIN material m
      ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
    LEFT JOIN precio_lista pl
      ON pl.evento_id = $2
     AND pl.linea_id = l.id
     AND pl.referencia_id = ref.id
     AND pl.material_id = m.id
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.linea IS NOT NULL
      AND TRIM(ppd.linea) <> ''
    ORDER BY shop, mv.descp_marca, caso, ppd.id
    `,
    [ppId, eventoId],
  );

  const pfMap = new Map<string, PreFacturaInterna>();
  const defaultPfTier: ListadoPrecioTierId = 1;

  for (const r of ppdRows) {
    const idCliente = Number(r.shop) || 0;
    const casoNorm = resolveCasoNorm(r, mapaCasoLinea);
    const pfKey = `${idCliente}|${r.id_marca}|${casoNorm}`;
    const art = buildArticulo(r, defaultPfTier);

    const existing = pfMap.get(pfKey);
    if (existing) {
      existing.articulos.push(art);
      existing.total_pares += art.pares;
      existing.total_monto = Math.round((existing.total_monto + art.subtotal) * 100) / 100;
    } else {
      pfMap.set(pfKey, {
        pf_key: pfKey,
        id_cliente: idCliente,
        marca: r.marca,
        id_marca: r.id_marca,
        caso: casoNorm,
        listado_tier: defaultPfTier,
        listado_label: labelListadoPrecio(defaultPfTier),
        total_pares: art.pares,
        total_monto: art.subtotal,
        articulos: [art],
      });
    }
  }

  const ics: IcAdminRow[] = icsRaw.map((ic) => {
    const tier = fiListaTier(ic.listado_precio_id ?? 1);
    return {
      ...ic,
      monto_ic: Math.round(Number(ic.monto_bruto ?? 0)),
      monto_proforma: estimateIcMontoProforma(ic, ppdRows, mapaCasoLinea),
      listado_tier: tier,
      listado_label: labelListadoPrecio(tier),
    };
  });

  const prefacturas = [...pfMap.values()].sort(
    (a, b) =>
      a.id_cliente - b.id_cliente ||
      a.marca.localeCompare(b.marca) ||
      a.caso.localeCompare(b.caso),
  );

  return { ics, prefacturas };
}
