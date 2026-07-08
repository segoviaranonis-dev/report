import type { Pool, PoolClient } from "pg";
import { getRimecPool } from "@/lib/rimec/pool";
import { parseProforma, type ProformaRow } from "./parse-proforma";
import {
  canonicalMolKey,
  categoriaEsProgramado,
  upsertColorProforma,
  upsertMaterialProforma,
} from "./pilares-proforma-upsert";
export type EmparejamientoShop = {
  brand: string;
  shop: string;
  pares_proforma: number;
  ic_id: number;
  ic_nro: string;
  id_cliente: number;
  cliente_nombre: string;
  pares_ic: number;
  match: boolean;
};

export type ProformaPreviewResult = {
  ok: boolean;
  preview?: boolean;
  programado?: boolean;
  pp_id?: number;
  total_pares?: number;
  n_filas?: number;
  n_grupos_shop?: number;
  emparejamientos?: EmparejamientoShop[];
  errores?: string[];
  listado_vinculado?: boolean;
  evento_id?: number;
  error?: string;
};

export type FiCreadaProgramado = {
  ic_nro: string;
  shop: string;
  fi_nro: string;
  pares: number;
};

export type ProformaImportResult = {
  ok: boolean;
  programado?: boolean;
  pp_id?: number;
  pares?: number;
  n_articulos?: number;
  message?: string;
  n_fi?: number;
  fi_creadas?: FiCreadaProgramado[];
  fi_errores?: string[];
  error?: string;
};

type IcRow = {
  ic_id: number;
  numero_registro: string;
  id_cliente: number;
  id_vendedor: number | null;
  cantidad_total_pares: number;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  id_plazo: number | null;
  listado_precio_id: number | null;
  precio_evento_id: number | null;
  descp_cliente: string | null;
};

type PpRow = {
  id: number;
  numero_registro: string;
  numero_proforma: string | null;
  nro_pedido_externo: string | null;
  categoria_id: number | null;
  fecha_arribo_estimada: string | null;
  descuento_1: number;
  descuento_2: number;
  descuento_3: number;
  descuento_4: number;
  proveedor_importacion_id: number | null;
};

function calcFobAjustado(fob: number, d1: number, d2: number, d3: number, d4: number): number {
  let result = fob;
  for (const d of [d1, d2, d3, d4]) {
    if (d && d > 0) result *= 1 - Number(d);
  }
  return Math.round(result * 10000) / 10000;
}

function factorDescuentoIcPct(d1: number, d2: number, d3: number, d4: number): number {
  let factor = 1;
  for (const d of [d1, d2, d3, d4]) {
    if (d && Number(d) > 0) factor *= 1 - Number(d) / 100;
  }
  return factor;
}

function molKeyProformaRow(r: ProformaRow): string {
  return canonicalMolKey(
    r.linea_codigo_proveedor,
    r.referencia_codigo_proveedor,
    r.material_code,
    r.color_code,
    r.grades_json,
  );
}

function normalizeClienteId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function aggregateIcsPorCliente(ics: IcRow[]): Map<
  number,
  { paresIc: number; icIds: number[]; icNros: string[]; clienteNombre: string }
> {
  const agg = new Map<
    number,
    { paresIc: number; icIds: number[]; icNros: string[]; clienteNombre: string }
  >();
  for (const r of ics) {
    const cid = normalizeClienteId(r.id_cliente);
    if (cid == null) continue;
    const bucket = agg.get(cid) ?? { paresIc: 0, icIds: [], icNros: [], clienteNombre: r.descp_cliente ?? "" };
    bucket.paresIc += Number(r.cantidad_total_pares ?? 0);
    bucket.icIds.push(Number(r.ic_id));
    bucket.icNros.push(String(r.numero_registro));
    if (!bucket.clienteNombre && r.descp_cliente) bucket.clienteNombre = r.descp_cliente;
    agg.set(cid, bucket);
  }
  return agg;
}

function splitProformaRowsPorQuotas(quotas: number[], rows: ProformaRow[]): ProformaRow[][] {
  const out: ProformaRow[][] = quotas.map(() => []);
  if (!quotas.length || quotas.reduce((a, b) => a + b, 0) <= 0) return out;
  let qi = 0;
  let quotaLeft = quotas[0];
  for (const row of rows) {
    let p = row.pairs;
    const pOrig = p;
    const boxesOrig = row.boxes || 1;
    while (p > 0 && qi < quotas.length) {
      if (quotaLeft <= 0) {
        qi += 1;
        quotaLeft = qi < quotas.length ? quotas[qi] : 0;
        continue;
      }
      const take = Math.min(p, quotaLeft);
      const r2: ProformaRow = { ...row, pairs: take };
      if (pOrig > 0 && boxesOrig > 0) {
        r2.boxes = Math.max(1, Math.round((boxesOrig * take) / pOrig));
      }
      out[qi].push(r2);
      p -= take;
      quotaLeft -= take;
    }
  }
  return out;
}

async function loadPp(pool: Pool, ppId: number): Promise<PpRow | null> {
  const { rows } = await pool.query<PpRow>(
    `SELECT id, numero_registro, numero_proforma, nro_pedido_externo, categoria_id,
            fecha_arribo_estimada, descuento_1, descuento_2, descuento_3, descuento_4,
            proveedor_importacion_id
     FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  return rows[0] ?? null;
}

async function loadIcsPpProgramado(pool: Pool, ppId: number): Promise<IcRow[]> {
  const { rows } = await pool.query<IcRow>(
    `SELECT ic.id AS ic_id, ic.numero_registro, ic.id_cliente, ic.id_vendedor,
            ic.cantidad_total_pares, ic.descuento_1, ic.descuento_2,
            ic.descuento_3, ic.descuento_4, ic.id_plazo, ic.listado_precio_id,
            icp.precio_evento_id, cv.descp_cliente
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     LEFT JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
     WHERE icp.pedido_proveedor_id = $1
     ORDER BY ic.id_cliente`,
    [ppId],
  );
  return rows;
}

export async function previewImportProformaProgramadoTs(
  ppId: number,
  fileBuffer: Buffer,
): Promise<ProformaPreviewResult> {
  const parsed = parseProforma(fileBuffer);
  if (parsed.error) return { ok: false, error: parsed.error };

  const pool = getRimecPool();
  const ics = await loadIcsPpProgramado(pool, ppId);
  if (!ics.length) return { ok: false, error: "El PP no tiene ICs vinculadas." };

  const eventoIds = [
    ...new Set(
      ics
        .map((i) => {
          const n = Number(i.precio_evento_id);
          return Number.isFinite(n) ? n : null;
        })
        .filter((x): x is number => x != null),
    ),
  ];
  if (eventoIds.length !== 1) {
    return { ok: false, error: "Las ICs del PP deben compartir un único listado de precios vinculado." };
  }
  const eventoId = eventoIds[0];

  const ppRes = await pool.query<{ proveedor_importacion_id: number | null; pares_comprometidos: number | null }>(
    "SELECT proveedor_importacion_id, pares_comprometidos FROM pedido_proveedor WHERE id = $1",
    [ppId],
  );
  const provId = ppRes.rows[0]?.proveedor_importacion_id ?? 654;

  const grupos = new Map<string, { brand: string; pares: number }>();
  for (const row of parsed.rows) {
    const brand = row.brand.trim().toUpperCase();
    const shop = row.shop.trim();
    const p = row.pairs;
    if (p <= 0) continue;
    const key = `${brand}\0${shop}`;
    const prev = grupos.get(key);
    grupos.set(key, { brand, pares: (prev?.pares ?? 0) + p });
  }

  const shopPares = new Map<string, number>();
  const shopBrands = new Map<string, Set<string>>();
  for (const [key, val] of grupos) {
    const shop = key.split("\0")[1];
    shopPares.set(shop, (shopPares.get(shop) ?? 0) + val.pares);
    const brands = shopBrands.get(shop) ?? new Set<string>();
    brands.add(val.brand);
    shopBrands.set(shop, brands);
  }

  const icByCliente = aggregateIcsPorCliente(ics);
  const emparejamientos: EmparejamientoShop[] = [];
  const errores: string[] = [];
  const matchedShops = new Set<string>();

  const sortedShops = [...shopPares.entries()].sort((a, b) => b[1] - a[1]);
  for (const [shop, paresProforma] of sortedShops) {
    const shopI = Number.parseInt(shop, 10);
    if (!Number.isFinite(shopI)) {
      const brands = [...(shopBrands.get(shop) ?? [])].sort().join(", ");
      errores.push(`SHOP no numérico: ${brands} / ${shop}`);
      continue;
    }
    const icAgg = icByCliente.get(shopI);
    if (!icAgg) {
      const brands = [...(shopBrands.get(shop) ?? [])].sort().join(", ");
      errores.push(`SHOP ${shop} (${brands}) sin IC con id_cliente=${shop}`);
      continue;
    }
    const icPares = icAgg.paresIc;
    const okMatch = icPares === paresProforma;
    if (!okMatch) {
      errores.push(
        `SHOP ${shop} · IC [${icAgg.icNros.join(", ")}]: proforma ${paresProforma} ≠ IC ${icPares} pares (suma ${icAgg.icNros.length} IC)`,
      );
    }
    matchedShops.add(shop);
    const brands = [...(shopBrands.get(shop) ?? [])].sort().join(", ");
    emparejamientos.push({
      brand: brands,
      shop,
      pares_proforma: paresProforma,
      ic_id: icAgg.icIds[0],
      ic_nro: icAgg.icNros.join(", "),
      id_cliente: shopI,
      cliente_nombre: icAgg.clienteNombre,
      pares_ic: icPares,
      match: okMatch,
    });
  }

  for (const cid of [...icByCliente.keys()].sort((a, b) => a - b)) {
    const shopS = String(cid);
    if (!matchedShops.has(shopS)) {
      const icLabel = icByCliente.get(cid)!.icNros.join(", ");
      errores.push(`Cliente ${shopS} · IC [${icLabel}] sin filas en proforma`);
    }
  }

  const plRes = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM precio_lista WHERE evento_id = $1",
    [eventoId],
  );
  const listadoOk = (plRes.rows[0]?.c ?? 0) > 0;

  return {
    ok: errores.length === 0,
    preview: true,
    programado: true,
    pp_id: ppId,
    total_pares: parsed.totalPares,
    n_filas: parsed.rows.length,
    n_grupos_shop: shopPares.size,
    evento_id: eventoId,
    emparejamientos,
    errores,
    listado_vinculado: listadoOk,
  };
}

async function getNextNroFi(client: PoolClient, ppId: number): Promise<string> {
  const { rows } = await client.query<{ correlativo: number }>(
    `SELECT COALESCE(
       MAX(CAST(REGEXP_REPLACE(nro_factura, '^[0-9]+-PV', '') AS INTEGER)), 0
     ) + 1 AS correlativo
     FROM factura_interna
     WHERE pp_id = $1 AND nro_factura ~ '^[0-9]+-PV[0-9]+$'`,
    [ppId],
  );
  const correlativo = rows[0]?.correlativo ?? 1;
  return `${ppId}-PV${String(correlativo).padStart(3, "0")}`;
}

async function populatePpFromProforma(
  client: PoolClient,
  pp: PpRow,
  proforma: string,
  detalleRows: ProformaRow[],
): Promise<{ ok: boolean; message: string }> {
  const ppId = pp.id;
  const totalPares = detalleRows.reduce((s, r) => s + r.pairs, 0);
  const totalFob = Math.round(detalleRows.reduce((s, r) => s + r.amount_fob, 0) * 100) / 100;
  const provId = pp.proveedor_importacion_id ?? 654;

  await client.query(
    `UPDATE pedido_proveedor
     SET numero_proforma = $1, nro_pedido_externo = $2,
         descuento_1 = $3, descuento_2 = $4, descuento_3 = $5, descuento_4 = $6,
         fecha_arribo_estimada = $7, pares_comprometidos = $8,
         categoria_id = COALESCE(categoria_id, $9), fecha_pedido = CURRENT_DATE
     WHERE id = $10`,
    [
      proforma.trim() || null,
      pp.nro_pedido_externo?.trim() || null,
      pp.descuento_1,
      pp.descuento_2,
      pp.descuento_3,
      pp.descuento_4,
      pp.fecha_arribo_estimada,
      totalPares,
      pp.categoria_id,
      ppId,
    ],
  );

  const marcaRes = await client.query<{ id_marca: number; nom: string }>(
    "SELECT id_marca, UPPER(descp_marca) AS nom FROM marca_v2",
  );
  const marcaLookup = new Map<string, number>();
  for (const m of marcaRes.rows) {
    if (m.nom) marcaLookup.set(m.nom, m.id_marca);
  }

  const matRes = await client.query<{ id: number; codigo: string; descripcion: string | null }>(
    "SELECT id, codigo_proveedor::text AS codigo, descripcion FROM material WHERE proveedor_id = $1::bigint",
    [provId],
  );
  const matLookup = new Map<string, { id: number; desc: string }>();
  for (const m of matRes.rows) matLookup.set(m.codigo, { id: m.id, desc: m.descripcion ?? "" });

  const colRes = await client.query<{ id: number; codigo: string; nombre: string | null }>(
    "SELECT id, codigo_proveedor::text AS codigo, nombre FROM color WHERE proveedor_id = $1::bigint",
    [provId],
  );
  const colLookup = new Map<string, { id: number; nombre: string }>();
  for (const c of colRes.rows) colLookup.set(c.codigo, { id: c.id, nombre: c.nombre ?? "" });

  await client.query("DELETE FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1", [ppId]);

  for (const r of detalleRows) {
    const fobUnit = r.unit_fob;
    const fobAj = calcFobAjustado(fobUnit, pp.descuento_1, pp.descuento_2, pp.descuento_3, pp.descuento_4);
    const grades = r.grades_json;
    const brandKey = r.brand.trim().toUpperCase();
    const idMarca = marcaLookup.get(brandKey) ?? null;
    const matCode = String(r.material_code || "").trim();
    const colCode = String(r.color_code || "").trim();
    const matHit = matLookup.get(matCode);
    const colHit = colLookup.get(colCode);

    await client.query(
      `INSERT INTO pedido_proveedor_detalle (
         pedido_proveedor_id, cantidad, id_marca, ncm, style_code, linea, referencia, nombre,
         id_material, descp_material, material_code, id_color, descp_color, color_code, grada,
         t33, t34, t35, t36, t37, t38, t39, t40,
         cantidad_cajas, cantidad_pares, unit_fob, unit_fob_ajustado, amount_fob, grades_json, fila_origen_f9
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb, $30
       )`,
      [
        ppId,
        r.pairs,
        idMarca,
        r.ncm || "",
        r.style_code || "",
        r.linea_codigo_proveedor || "",
        r.referencia_codigo_proveedor || "",
        r.name || "",
        matHit?.id ?? null,
        matHit?.desc ?? (r.material || ""),
        matCode,
        colHit?.id ?? null,
        colHit?.nombre ?? (r.color || ""),
        colCode,
        r.grade_range || "",
        grades["33"] ?? 0,
        grades["34"] ?? 0,
        grades["35"] ?? 0,
        grades["36"] ?? 0,
        grades["37"] ?? 0,
        grades["38"] ?? 0,
        grades["39"] ?? 0,
        grades["40"] ?? 0,
        r.boxes,
        r.pairs,
        fobUnit,
        fobAj,
        r.amount_fob,
        JSON.stringify(grades),
        Number.parseInt(r.item, 10) || 0,
      ],
    );

    const healCol = (r.color || "").trim();
    if (colCode && healCol) {
      await upsertColorProforma(client, colCode, provId, healCol);
    }
    const healMat = (r.material || "").trim();
    if (matCode && healMat) {
      await upsertMaterialProforma(client, matCode, provId, healMat);
    }
  }

  return {
    ok: true,
    message: `${totalPares.toLocaleString("es-PY")} pares · ${detalleRows.length} SKUs · USD ${totalFob.toLocaleString("es-PY")}`,
  };
}

type SkuFi = {
  ppd_id: number;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number | null;
  lpn: number;
};

async function getSkusConPrecioParaFi(client: PoolClient, ppId: number, eventoId: number): Promise<Map<number, SkuFi>> {
  const { rows } = await client.query<SkuFi>(
    `SELECT ppd.id AS ppd_id, l.id AS linea_id, ref.id AS referencia_id,
            m.id AS material_id, c.id AS color_id, COALESCE(pl.lpn, 0)::float AS lpn
     FROM pedido_proveedor_detalle ppd
     JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
     LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
     LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
     LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
     LEFT JOIN color c ON c.codigo_proveedor::text = ppd.color_code
     LEFT JOIN precio_lista pl ON pl.evento_id = $2 AND pl.linea_id = l.id
                               AND pl.referencia_id = ref.id AND pl.material_id = m.id
     WHERE ppd.pedido_proveedor_id = $1 AND ppd.linea IS NOT NULL AND ppd.linea != ''`,
    [ppId, eventoId],
  );
  const map = new Map<number, SkuFi>();
  for (const r of rows) {
    if (r.linea_id && r.referencia_id && r.material_id) map.set(r.ppd_id, r);
  }
  return map;
}

async function crearFacturaInterna(
  client: PoolClient,
  ppId: number,
  ic: IcRow,
  items: Array<{
    ppd_id: number;
    linea_id: number;
    referencia_id: number;
    material_id: number;
    color_id: number | null;
    linea_codigo: string;
    ref_codigo: string;
    material_nombre: string;
    color_nombre: string;
    cajas: number;
    pares: number;
    precio_unit: number;
    precio_neto: number;
    subtotal: number;
  }>,
): Promise<{ ok: boolean; nro: string }> {
  const nro = await getNextNroFi(client, ppId);
  const totalPares = items.reduce((s, i) => s + i.pares, 0);
  const totalMonto = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

  const fiRes = await client.query<{ id: number }>(
    `INSERT INTO factura_interna
       (pp_id, nro_factura, cliente_id, vendedor_id, plazo_id, lista_precio_id,
        descuento_1, descuento_2, descuento_3, descuento_4, total_pares, total_monto, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'RESERVADA')
     RETURNING id`,
    [
      ppId,
      nro,
      ic.id_cliente,
      ic.id_vendedor,
      ic.id_plazo,
      ic.listado_precio_id ?? 1,
      ic.descuento_1,
      ic.descuento_2,
      ic.descuento_3,
      ic.descuento_4,
      totalPares,
      totalMonto,
    ],
  );
  const fiId = fiRes.rows[0].id;

  for (const item of items) {
    const snap = JSON.stringify({
      linea_codigo: item.linea_codigo,
      ref_codigo: item.ref_codigo,
      material_nombre: item.material_nombre,
      color_nombre: item.color_nombre,
    });
    await client.query(
      `INSERT INTO factura_interna_detalle
         (factura_id, ppd_id, cajas, pares, precio_unit, subtotal, precio_neto, linea_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [fiId, item.ppd_id, item.cajas, item.pares, item.precio_unit, item.subtotal, item.precio_neto, snap],
    );
    if (item.ppd_id && item.pares > 0) {
      await client.query("SELECT descontar_stock_pp($1, $2)", [item.ppd_id, item.pares]);
    }
  }

  const vis = await client.query<{ numero_preventa_global: string }>(
    "SELECT numero_preventa_global FROM v_factura_interna_preventa WHERE id = $1",
    [fiId],
  );
  return { ok: true, nro: vis.rows[0]?.numero_preventa_global ?? nro };
}

export async function importProformaProgramadoTs(
  ppId: number,
  fileBuffer: Buffer,
  proformaOverride?: string,
): Promise<ProformaImportResult> {
  const preview = await previewImportProformaProgramadoTs(ppId, fileBuffer);
  if (!preview.ok) {
    return {
      ...preview,
      ok: false,
      error: preview.errores?.join("; ") || "Emparejamiento SHOP↔IC inválido",
      programado: true,
    };
  }
  if (!preview.listado_vinculado) {
    return { ok: false, error: "Vinculá el listado de precios RIMEC antes de importar programado.", programado: true };
  }

  const parsed = parseProforma(fileBuffer);
  if (parsed.error) return { ok: false, error: parsed.error, programado: true };

  const pool = getRimecPool();
  const pp = await loadPp(pool, ppId);
  if (!pp) return { ok: false, error: `PP ${ppId} no encontrado.`, programado: true };

  const proforma = (proformaOverride || pp.numero_proforma || "").trim();
  if (!proforma) return { ok: false, error: "Nro proforma obligatorio.", programado: true };

  const eventoId = preview.evento_id!;
  const ics = await loadIcsPpProgramado(pool, ppId);
  const detalle = parsed.rows;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pop = await populatePpFromProforma(client, pp, proforma, detalle);
    if (!pop.ok) {
      await client.query("ROLLBACK");
      return { ok: false, error: pop.message, programado: true };
    }

    const skuByPpd = await getSkusConPrecioParaFi(client, ppId, eventoId);
    if (!skuByPpd.size) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Sin SKUs PPD tras import (listado/pilares).", programado: true };
    }

    const ppdMapRes = await client.query<{
      id: number;
      linea: string;
      referencia: string;
      material_code: string;
      color_code: string;
      grades_json: unknown;
    }>(
      `SELECT id, linea, referencia, material_code, color_code, grades_json
       FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1`,
      [ppId],
    );
    const ppdByMol = new Map<string, number>();
    for (const pr of ppdMapRes.rows) {
      const gj =
        typeof pr.grades_json === "object" && pr.grades_json ? (pr.grades_json as Record<string, number>) : {};
      const key = canonicalMolKey(String(pr.linea), String(pr.referencia), String(pr.material_code), String(pr.color_code), gj);
      ppdByMol.set(key, pr.id);
    }

    const rowsByShop = new Map<string, ProformaRow[]>();
    for (const r of detalle) {
      const shop = r.shop.trim();
      const list = rowsByShop.get(shop) ?? [];
      list.push(r);
      rowsByShop.set(shop, list);
    }

    const icsByShop = new Map<string, IcRow[]>();
    for (const ic of ics) {
      const shop = String(normalizeClienteId(ic.id_cliente) ?? ic.id_cliente);
      const list = icsByShop.get(shop) ?? [];
      list.push(ic);
      icsByShop.set(shop, list);
    }

    const fiCreadas: FiCreadaProgramado[] = [];
    const fiErrores: string[] = [];

    for (const [shop, icGroup] of icsByShop) {
      const icRows = rowsByShop.get(shop) ?? [];
      if (!icRows.length) {
        for (const icRow of icGroup) fiErrores.push(`IC ${icRow.numero_registro}: sin filas proforma`);
        continue;
      }

      const quotas = icGroup.map((r) => r.cantidad_total_pares ?? 0);
      const splitRows = splitProformaRowsPorQuotas(quotas, icRows);

      for (let i = 0; i < icGroup.length; i++) {
        const icRow = icGroup[i];
        const assigned = splitRows[i] ?? [];
        if (!assigned.length) {
          fiErrores.push(`IC ${icRow.numero_registro}: cupo sin filas asignadas`);
          continue;
        }

        const d1 = Number(icRow.descuento_1 ?? 0);
        const d2 = Number(icRow.descuento_2 ?? 0);
        const d3 = Number(icRow.descuento_3 ?? 0);
        const d4 = Number(icRow.descuento_4 ?? 0);
        const factor = factorDescuentoIcPct(d1, d2, d3, d4);
        const items: Parameters<typeof crearFacturaInterna>[3] = [];

        for (const r of assigned) {
          const molKey = molKeyProformaRow(r);
          const ppdId = ppdByMol.get(molKey);
          if (!ppdId) {
            fiErrores.push(`IC ${icRow.numero_registro}: molécula ${r.linea_codigo_proveedor}.${r.referencia_codigo_proveedor} sin PPD`);
            continue;
          }
          const sku = skuByPpd.get(ppdId);
          if (!sku?.linea_id) {
            fiErrores.push(`IC ${icRow.numero_registro}: pilares/LPN faltantes PPD ${ppdId}`);
            continue;
          }
          const paresI = r.pairs;
          const cajasI = r.boxes || 1;
          const lpnBase = Number(sku.lpn ?? 0);
          const lpnNeto = Math.round(lpnBase * factor);
          items.push({
            ppd_id: ppdId,
            linea_id: sku.linea_id,
            referencia_id: sku.referencia_id,
            material_id: sku.material_id,
            color_id: sku.color_id,
            linea_codigo: r.linea_codigo_proveedor,
            ref_codigo: r.referencia_codigo_proveedor,
            material_nombre: r.material,
            color_nombre: r.color,
            cajas: cajasI,
            pares: paresI,
            precio_unit: lpnBase,
            precio_neto: lpnNeto,
            subtotal: Math.round(paresI * lpnNeto),
          });
        }

        if (!items.length) continue;
        const fi = await crearFacturaInterna(client, ppId, icRow, items);
        if (fi.ok) {
          fiCreadas.push({
            ic_nro: icRow.numero_registro,
            shop,
            fi_nro: fi.nro,
            pares: items.reduce((s, x) => s + x.pares, 0),
          });
        } else {
          fiErrores.push(`IC ${icRow.numero_registro}: ${fi.nro}`);
        }
      }
    }

    if (fiErrores.length) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: fiErrores.slice(0, 3).join("; "),
        programado: true,
        fi_errores: fiErrores,
        fi_creadas: fiCreadas,
        n_fi: fiCreadas.length,
        pares: parsed.totalPares,
        n_articulos: detalle.length,
      };
    }

    const nIcsEsperadas = ics.length;
    if (fiCreadas.length === 0 || fiCreadas.length < nIcsEsperadas) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: `Import programado incompleto: ${fiCreadas.length}/${nIcsEsperadas} FI creadas. Revisá pilares/LPN o emparejamiento SHOP.`,
        programado: true,
        fi_creadas: fiCreadas,
        n_fi: fiCreadas.length,
      };
    }

    if (fiCreadas.length) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET pares_vendidos = cantidad_pares WHERE pedido_proveedor_id = $1`,
        [ppId],
      );
    }

    await client.query("COMMIT");

    return {
      ok: true,
      programado: true,
      pp_id: ppId,
      pares: parsed.totalPares,
      n_articulos: detalle.length,
      message: pop.message,
      fi_creadas: fiCreadas,
      fi_errores: fiErrores,
      n_fi: fiCreadas.length,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al importar programado",
      programado: true,
    };
  } finally {
    client.release();
  }
}

export async function previewProformaSimpleTs(fileBuffer: Buffer): Promise<ProformaPreviewResult> {
  const parsed = parseProforma(fileBuffer);
  if (parsed.error) return { ok: false, error: parsed.error };
  return {
    ok: true,
    preview: true,
    programado: false,
    total_pares: parsed.totalPares,
    n_filas: parsed.rows.length,
  };
}

export async function importProformaCompraPreviaTs(
  ppId: number,
  fileBuffer: Buffer,
  proformaOverride?: string,
): Promise<ProformaImportResult> {
  const parsed = parseProforma(fileBuffer);
  if (parsed.error) return { ok: false, error: parsed.error, programado: false };

  const pool = getRimecPool();
  const pp = await loadPp(pool, ppId);
  if (!pp) return { ok: false, error: `PP ${ppId} no encontrado.` };

  const proforma = (proformaOverride || pp.numero_proforma || "").trim();
  if (!proforma) return { ok: false, error: "Nro proforma obligatorio." };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pop = await populatePpFromProforma(client, pp, proforma, parsed.rows);
    if (!pop.ok) {
      await client.query("ROLLBACK");
      return { ok: false, error: pop.message };
    }
    await client.query("COMMIT");
    return {
      ok: true,
      programado: false,
      pp_id: ppId,
      pares: parsed.totalPares,
      n_articulos: parsed.rows.length,
      message: pop.message,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al importar" };
  } finally {
    client.release();
  }
}

export async function borrarImportacionTs(ppId: number): Promise<{ ok: boolean; message?: string; error?: string }> {
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const chk = await client.query<{ n: number; vend: number; fi_conf: number }>(
      `SELECT COUNT(ppd.id)::int AS n,
              COALESCE(SUM(ppd.pares_vendidos), 0)::int AS vend,
              (SELECT COUNT(*)::int FROM factura_interna fi
               WHERE fi.pp_id = $1 AND UPPER(TRIM(fi.estado)) = 'CONFIRMADA') AS fi_conf
       FROM pedido_proveedor_detalle ppd WHERE ppd.pedido_proveedor_id = $1`,
      [ppId],
    );
    const row = chk.rows[0];
    if (!row?.n) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No hay artículos importados." };
    }
    if (row.vend > 0 || row.fi_conf > 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No se puede borrar: hay ventas o FI confirmadas." };
    }

    await client.query(
      `DELETE FROM venta_transito vt
       USING pedido_proveedor_detalle ppd
       WHERE vt.pedido_proveedor_detalle_id = ppd.id AND ppd.pedido_proveedor_id = $1`,
      [ppId],
    );
    await client.query(
      `DELETE FROM factura_interna_detalle fid
       USING factura_interna fi
       WHERE fid.factura_id = fi.id AND fi.pp_id = $1`,
      [ppId],
    );
    await client.query(`DELETE FROM factura_interna WHERE pp_id = $1`, [ppId]);
    await client.query(`DELETE FROM snapshot_costos WHERE pp_id = $1`, [ppId]);
    const del = await client.query(`DELETE FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1 RETURNING id`, [
      ppId,
    ]);
    await client.query(`UPDATE pedido_proveedor SET pares_comprometidos = 0 WHERE id = $1`, [ppId]);
    await client.query(`UPDATE pedido_proveedor SET estado_transito = NULL WHERE id = $1 AND estado_transito = 'EN_TRANSITO'`, [
      ppId,
    ]);
    await client.query("COMMIT");
    return {
      ok: true,
      message: `Importación eliminada (${del.rowCount ?? 0} artículos). Podés cargar la proforma de nuevo.`,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al borrar importación" };
  } finally {
    client.release();
  }
}

export function isProgramadoCategoria(categoriaId: unknown): boolean {
  return categoriaEsProgramado(categoriaId);
}
