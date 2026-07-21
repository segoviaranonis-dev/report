import type { Pool } from "pg";
import { fiListaTier } from "@/lib/pedido-proveedor/aritmetica-programado";
import type { PpIcVinculada } from "@/lib/pedido-proveedor/detail-query";
import { listIcsVinculadasPp } from "@/lib/pedido-proveedor/detail-query";
import { labelListadoPrecio, type ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import { normAdminEtiqueta, subtotalSinDescuento } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { loadPpCasoContext } from "@/lib/pedido-proveedor/pp-caso-context";
import {
  casoLineaFromMapa,
  resolveCasoMotorPrecios,
  resolveMarcaRealPf,
} from "@/lib/pedido-proveedor/resolve-caso-comercial";
import { productImageCandidatesForRow } from "@/lib/retail/product-image";
import {
  applyPfSplitsToPrefacturas,
  loadPfSplits,
  type PfSplitRecord,
} from "@/lib/pedido-proveedor/admin-ic-pf-splits";

export type PfArticuloRow = {
  ppd_id: number;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
  /** Caso comercial motor de precios / biblioteca (precio_lista · PELE). */
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
  precio_unit: number;
  subtotal: number;
  /** URLs Storage sm/md/lg — resueltas server-side (protocolo imagen). */
  imageCandidates: string[];
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
  monto_ic: number;
  monto_proforma: number;
  listado_tier: ListadoPrecioTierId;
  listado_label: string;
};

export type AdministradorIcPayload = {
  ics: IcAdminRow[];
  prefacturas: PreFacturaInterna[];
  pf_splits: PfSplitRecord[];
  /** Cabecera PP con biblioteca — Chusa alinea IC virtual por caso. */
  chusa_modo_biblioteca: boolean;
};

type PpdPfRow = {
  ppd_id: number;
  shop: string;
  id_marca: number;
  marca: string;
  linea_marca_id: number | null;
  marca_linea: string;
  brand_excel: string;
  brand_json: string;
  caso_pl: string;
  linea: string;
  referencia: string;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number | null;
  color_id: number | null;
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
  estilo_lr: string;
  estilo_linea: string;
};

function resolveCasoNorm(
  r: PpdPfRow,
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
): string {
  return resolveCasoMotorPrecios({
    casoPl: r.caso_pl,
    casoPele: casoLineaFromMapa(mapaCasoLinea, r.linea),
    estiloLr: r.estilo_lr,
    estiloLinea: r.estilo_linea,
    materialHint: r.material,
    casosEvento,
  });
}

function buildArticulo(
  r: PpdPfRow,
  tier: ListadoPrecioTierId,
  caso: string,
  opts?: { includeImages?: boolean },
): PfArticuloRow {
  const { precio_unit, subtotal } = subtotalSinDescuento(
    { lpn: r.lpn, lpc02: r.lpc02, lpc03: r.lpc03, lpc04: r.lpc04 },
    tier,
    r.pares,
  );
  const imageCandidates =
    opts?.includeImages === false
      ? []
      : productImageCandidatesForRow(
          r.linea,
          r.referencia,
          r.material_code ?? "",
          r.color_code ?? "",
        ).filter(Boolean);
  return {
    ppd_id: Number(r.ppd_id),
    linea_id: r.linea_id,
    referencia_id: r.referencia_id,
    material_id: r.material_id,
    color_id: r.color_id,
    caso,
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
    imageCandidates,
  };
}

function marcaEsCasoComercial(
  marca: string,
  casoNorm: string,
  casosEvento: Set<string>,
): boolean {
  const m = normAdminEtiqueta(marca);
  if (!m || m === "—") return false;
  if (casoNorm && m === normAdminEtiqueta(casoNorm)) return true;
  return casosEvento.has(m);
}

function ppdRowParIc(
  ic: PpIcVinculada,
  r: PpdPfRow,
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
): boolean {
  if (Number(r.shop) !== ic.id_cliente) return false;
  if (r.id_marca === ic.id_marca) return true;
  const casoNorm = resolveCasoNorm(r, mapaCasoLinea, casosEvento);
  if (!casoNorm || casoNorm === "—") return false;
  /** IC cabecera legacy: marca = caso comercial (ej. CHINELO). */
  if (normAdminEtiqueta(ic.marca) === normAdminEtiqueta(casoNorm)) return true;
  /** Proforma exportó el caso en columna marca — emparejar IC marca real. */
  if (marcaEsCasoComercial(r.marca, casoNorm, casosEvento)) return true;
  return false;
}

/** IC vinculada a fila PPD — desempate cuando proforma puso caso como marca. */
function pickIcForPpdRow(
  r: PpdPfRow,
  icsRaw: PpIcVinculada[],
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
): PpIcVinculada | undefined {
  const idCliente = Number(r.shop) || 0;
  const candidates = icsRaw.filter((ic) => ppdRowParIc(ic, r, mapaCasoLinea, casosEvento));
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const exactMarca = candidates.find((ic) => ic.id_marca === r.id_marca);
  if (exactMarca) return exactMarca;

  const casoNorm = resolveCasoNorm(r, mapaCasoLinea, casosEvento);
  if (marcaEsCasoComercial(r.marca, casoNorm, casosEvento)) {
    const marcasReales = candidates.filter(
      (ic) => !casosEvento.has(normAdminEtiqueta(ic.marca)),
    );
    if (marcasReales.length === 1) return marcasReales[0];
    const byPares = marcasReales.filter((ic) => ic.pares === r.pares);
    if (byPares.length === 1) return byPares[0];
    const icConMarcaPpd = icsRaw.some(
      (ic) => ic.id_cliente === idCliente && ic.id_marca === r.id_marca,
    );
    if (!icConMarcaPpd && marcasReales.length > 0) {
      return [...marcasReales].sort((a, b) => a.ic_id - b.ic_id)[0];
    }
  }

  return candidates[0];
}

function resolveMarcaPfFila(
  r: PpdPfRow,
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
  marcaByNom: Map<string, { id_marca: number; nombre: string }>,
): Pick<PpdPfRow, "id_marca" | "marca"> {
  const casoNorm = resolveCasoNorm(r, mapaCasoLinea, casosEvento);
  return resolveMarcaRealPf({
    id_marca: r.id_marca,
    marca: r.marca,
    linea_marca_id: r.linea_marca_id,
    marca_linea: r.marca_linea,
    brand_excel: r.brand_excel,
    brand_json: r.brand_json,
    casoNorm,
    casosEvento,
    marcaByNom,
  });
}

function buildPrefacturaMap(
  ppdRows: PpdPfRow[],
  icsRaw: PpIcVinculada[],
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
  defaultPfTier: ListadoPrecioTierId,
  marcaByNom: Map<string, { id_marca: number; nombre: string }>,
): Map<string, PreFacturaInterna> {
  const pfMap = new Map<string, PreFacturaInterna>();

  for (const r of ppdRows) {
    const idCliente = Number(r.shop) || 0;
    const casoNorm = resolveCasoNorm(r, mapaCasoLinea, casosEvento);
    const marcaFila = resolveMarcaPfFila(r, mapaCasoLinea, casosEvento, marcaByNom);
    const rMarca = { ...r, id_marca: marcaFila.id_marca, marca: marcaFila.marca };
    const pfKey = `${idCliente}|${rMarca.id_marca}|${casoNorm}`;
    const art = buildArticulo(rMarca, defaultPfTier, casoNorm, { includeImages: false });

    const existing = pfMap.get(pfKey);
    if (existing) {
      existing.articulos.push(art);
      existing.total_pares += art.pares;
      existing.total_monto = Math.round((existing.total_monto + art.subtotal) * 100) / 100;
    } else {
      pfMap.set(pfKey, {
        pf_key: pfKey,
        id_cliente: idCliente,
        marca: rMarca.marca,
        id_marca: rMarca.id_marca,
        caso: casoNorm,
        listado_tier: defaultPfTier,
        listado_label: labelListadoPrecio(defaultPfTier),
        total_pares: art.pares,
        total_monto: art.subtotal,
        articulos: [art],
      });
    }
  }

  return pfMap;
}

function estimateIcMontoProforma(
  ic: PpIcVinculada,
  ppdRows: PpdPfRow[],
  mapaCasoLinea: Map<string, string>,
  casosEvento: Set<string>,
): number {
  const tier = fiListaTier(ic.listado_precio_id ?? 1);
  let sum = 0;
  for (const r of ppdRows) {
    if (!ppdRowParIc(ic, r, mapaCasoLinea, casosEvento)) continue;
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
  const [icsRaw, ppMeta, casoCtx] = await Promise.all([
    listIcsVinculadasPp(pool, ppId),
    pool.query<{ evento_id: number | null }>(
      `SELECT icp.precio_evento_id::int AS evento_id
       FROM intencion_compra_pedido icp
       WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
       ORDER BY icp.id LIMIT 1`,
      [ppId],
    ),
    loadPpCasoContext(pool, ppId),
  ]);

  const eventoId = ppMeta.rows[0]?.evento_id ?? casoCtx.eventoId;
  const { mapaCasoLinea, casosEvento } = casoCtx;

  const marcasRes = await pool.query<{ id_marca: number; nom: string }>(
    `SELECT id_marca, UPPER(TRIM(descp_marca)) AS nom FROM marca_v2 WHERE descp_marca IS NOT NULL`,
  );
  const marcaByNom = new Map<string, { id_marca: number; nombre: string }>();
  for (const m of marcasRes.rows) {
    if (m.nom) marcaByNom.set(m.nom, { id_marca: m.id_marca, nombre: m.nom });
  }

  const { rows: ppdRows } = await pool.query<PpdPfRow>(
    `
    SELECT
      ppd.id AS ppd_id,
      COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '0') AS shop,
      COALESCE(ppd.id_marca, l_eff.marca_id)::int AS id_marca,
      COALESCE(mv_pilar.descp_marca, mv_excel.descp_marca, '—') AS marca,
      l_eff.marca_id AS linea_marca_id,
      COALESCE(mv_pilar.descp_marca, '—') AS marca_linea,
      COALESCE(NULLIF(TRIM(ppd.grades_json->>'_brand_excel'), ''), '') AS brand_excel,
      COALESCE(NULLIF(TRIM(ppd.grades_json->>'_brand'), ''), '') AS brand_json,
      COALESCE(
        NULLIF(TRIM(pl_fk.nombre_caso_aplicado), ''),
        NULLIF(TRIM(pec_fk.nombre_caso), ''),
        NULLIF(TRIM(pl_cod.nombre_caso_aplicado), ''),
        NULLIF(TRIM(pec_cod.nombre_caso), ''),
        '—'
      ) AS caso_pl,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      l_eff.id AS linea_id,
      ref_eff.id AS referencia_id,
      m_eff.id AS material_id,
      c_eff.id AS color_id,
      ppd.material_code,
      COALESCE(m_eff.descripcion, ppd.descp_material, '') AS material,
      ppd.color_code,
      COALESCE(c_eff.nombre, ppd.descp_color, '') AS color,
      ppd.grada,
      COALESCE(ppd.cantidad_pares, 0)::int AS pares,
      COALESCE(pl_fk.lpn, pl_cod.lpn, ppd.precio_lpn, 0)::float AS lpn,
      COALESCE(pl_fk.lpc02, pl_cod.lpc02, ppd.precio_lpc02, 0)::float AS lpc02,
      COALESCE(pl_fk.lpc03, pl_cod.lpc03, ppd.precio_lpc03, 0)::float AS lpc03,
      COALESCE(pl_fk.lpc04, pl_cod.lpc04, ppd.precio_lpc04, 0)::float AS lpc04,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), NULLIF(TRIM(lr.descp_grupo_estilo), ''), '') AS estilo_lr,
      COALESCE(NULLIF(TRIM(ge_linea.descp_grupo_estilo), ''), '') AS estilo_linea
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN marca_v2 mv_excel ON mv_excel.id_marca = ppd.id_marca
    LEFT JOIN linea l ON l.id = ppd.linea_id
    LEFT JOIN linea l_cod
      ON l_cod.proveedor_id = pp.proveedor_importacion_id
     AND l_cod.codigo_proveedor::text = TRIM(ppd.linea)
     AND l.id IS NULL
    LEFT JOIN linea l_eff ON l_eff.id = COALESCE(l.id, l_cod.id)
    LEFT JOIN referencia ref ON ref.id = ppd.referencia_id
    LEFT JOIN referencia ref_cod
      ON ref_cod.linea_id = l_eff.id
     AND ref_cod.codigo_proveedor::text = TRIM(COALESCE(ppd.referencia, '0'))
     AND ref.id IS NULL
    LEFT JOIN referencia ref_eff ON ref_eff.id = COALESCE(ref.id, ref_cod.id)
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l_eff.id
     AND lr.referencia_id = ref_eff.id
     AND lr.proveedor_id = pp.proveedor_importacion_id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN grupo_estilo_v2 ge_linea ON ge_linea.id_grupo_estilo = l_eff.grupo_estilo_id
    LEFT JOIN marca_v2 mv_pilar ON mv_pilar.id_marca = l_eff.marca_id
    LEFT JOIN material m ON m.id = ppd.id_material
    LEFT JOIN material m_cod
      ON m_cod.proveedor_id = pp.proveedor_importacion_id
     AND m_cod.codigo_proveedor::text = TRIM(ppd.material_code)
     AND m.id IS NULL
    LEFT JOIN material m_eff ON m_eff.id = COALESCE(m.id, m_cod.id)
    LEFT JOIN color c ON c.id = ppd.id_color
    LEFT JOIN color c_cod
      ON c_cod.proveedor_id = pp.proveedor_importacion_id
     AND c_cod.codigo_proveedor::text = TRIM(ppd.color_code)
     AND c.id IS NULL
    LEFT JOIN color c_eff ON c_eff.id = COALESCE(c.id, c_cod.id)
    LEFT JOIN precio_lista pl_fk
      ON pl_fk.evento_id = $2
     AND pl_fk.linea_id = l_eff.id
     AND pl_fk.referencia_id = ref_eff.id
     AND pl_fk.material_id = m_eff.id
    LEFT JOIN precio_evento_caso pec_fk ON pec_fk.id = pl_fk.caso_id
    LEFT JOIN LATERAL (
      SELECT pl.nombre_caso_aplicado, pl.caso_id, pl.lpn, pl.lpc02, pl.lpc03, pl.lpc04
      FROM precio_lista pl
      WHERE pl.evento_id = $2
        AND TRIM(pl.linea_codigo) = TRIM(ppd.linea)
        AND TRIM(pl.referencia_codigo) = TRIM(ppd.referencia)
        AND (m_eff.id IS NULL OR pl.material_id = m_eff.id)
      ORDER BY CASE WHEN m_eff.id IS NOT NULL AND pl.material_id = m_eff.id THEN 0 ELSE 1 END, pl.id
      LIMIT 1
    ) pl_cod ON pl_fk.id IS NULL
    LEFT JOIN precio_evento_caso pec_cod ON pec_cod.id = pl_cod.caso_id
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.linea IS NOT NULL
      AND TRIM(ppd.linea) <> ''
    ORDER BY shop, marca, caso_pl, ppd.id
    `,
    [ppId, eventoId],
  );

  const defaultPfTier: ListadoPrecioTierId = 1;
  const pfMap = buildPrefacturaMap(ppdRows, icsRaw, mapaCasoLinea, casosEvento, defaultPfTier, marcaByNom);

  const ics: IcAdminRow[] = icsRaw.map((ic) => {
    const tier = fiListaTier(ic.listado_precio_id ?? 1);
    return {
      ...ic,
      monto_ic: Math.round(Number(ic.monto_bruto ?? 0)),
      monto_proforma: estimateIcMontoProforma(ic, ppdRows, mapaCasoLinea, casosEvento),
      listado_tier: tier,
      listado_label: labelListadoPrecio(tier),
    };
  });

  const prefacturasBase = [...pfMap.values()].sort(
    (a, b) =>
      a.id_cliente - b.id_cliente ||
      a.marca.localeCompare(b.marca) ||
      a.caso.localeCompare(b.caso),
  );

  const pf_splits = await loadPfSplits(pool, ppId);
  const prefacturas = applyPfSplitsToPrefacturas(prefacturasBase, pf_splits).sort(
    (a, b) =>
      a.id_cliente - b.id_cliente ||
      a.marca.localeCompare(b.marca) ||
      a.caso.localeCompare(b.caso),
  );

  return {
    ics,
    prefacturas,
    pf_splits,
    chusa_modo_biblioteca: casoCtx.fuente === "biblioteca",
  };
}
