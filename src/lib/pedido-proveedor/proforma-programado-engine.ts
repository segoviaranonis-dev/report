import type { Pool, PoolClient } from "pg";
import { getRimecPool } from "@/lib/rimec/pool";
import { parseProforma, type ProformaRow } from "./parse-proforma";
import {
  canonicalMolKey,
  categoriaEsProgramado,
  upsertColorProforma,
  upsertMaterialProforma,
} from "./pilares-proforma-upsert";
import { provisionPilaresFromProforma, type ProformaPilaresStats } from "./proforma-pilares-provision";
import {
  buildProformaPilaresImportReport,
  type ProformaPilaresImportReport,
} from "./proforma-pilares-import-report";
import {
  calcFobAjustadoPct,
  calcLineaFiPrecio,
  fiListaTier,
  type SkuPrecioTiers,
} from "./aritmetica-programado";
import {
  enrichProformaBrandsFromPpd,
  loadProformaDetalleParaFi,
  saveProformaFilas,
  backfillPpdShopFromSnapshot,
} from "./proforma-snapshot";
import { loadMapaCasoPorLineaEvento } from "@/lib/motor-precios/caso-linea-evento";
import {
  casoDominanteDeNombres,
  resolveCasoDominanteDesdePpd,
} from "@/lib/pedido-proveedor/resolve-caso-cabecera-fi";
import {
  casoLineaFromMapa,
  loadCasosEventoNombres,
  resolveCasoMotorPrecios,
} from "@/lib/pedido-proveedor/resolve-caso-comercial";
import { buildLineaSnapshotForFi } from "@/lib/pedido-proveedor/linea-snapshot-fi";
import {
  backfillPpdPilarFks,
  loadPpdPilarFkLookups,
  resolvePpdPilarIds,
} from "@/lib/pedido-proveedor/ppd-pilares-fk";
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

export type ProformaPrecioAuditEstado = "ok" | "sin_precio" | "sin_caso" | "pilares_faltantes";

export type ProformaPrecioAuditFila = {
  linea: string;
  referencia: string;
  material_code: string;
  pares: number;
  estado: ProformaPrecioAuditEstado;
  caso: string | null;
  lpn: number | null;
};

export type ProformaPrecioAuditResumen = {
  n_skus: number;
  n_ok: number;
  n_sin_precio: number;
  n_sin_caso: number;
  n_pilares_faltantes: number;
  pares_ok: number;
  pares_sin_precio: number;
  pares_sin_caso: number;
  pares_pilares_faltantes: number;
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
  /** Avisos pilares × precio_lista — no bloquean import. */
  avisos?: string[];
  precio_audit?: ProformaPrecioAuditResumen;
  precio_audit_muestra?: ProformaPrecioAuditFila[];
  listado_vinculado?: boolean;
  evento_id?: number;
  error?: string;
  pilares_import?: ProformaPilaresImportReport;
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
  import_avisos?: string[];
  precio_audit?: ProformaPrecioAuditResumen;
  pilares_import?: ProformaPilaresImportReport;
};

type IcRow = {
  ic_id: number;
  numero_registro: string;
  id_cliente: number;
  id_vendedor: number | null;
  id_marca: number | null;
  marca_nombre: string | null;
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

export type ProformaImportPhase = "ppd" | "fi" | "all";

export const PROFORMA_FI_BATCH_SIZE = 12;

export type ProformaImportPhaseResult = ProformaImportResult & {
  phase?: ProformaImportPhase;
  done?: boolean;
  fi_offset?: number;
  fi_offset_next?: number;
  fi_total?: number;
  fi_batch?: number;
  fi_avisos?: string[];
  /** Avisos cruce proforma ↔ precio_lista al cargar PPD. */
  import_avisos?: string[];
  precio_audit?: ProformaPrecioAuditResumen;
  /** Pilares + líneas sin biblioteca tras import. */
  pilares_import?: ProformaPilaresImportReport;
};

type FiLineItem = {
  ppd_id: number;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number | null;
  linea_codigo: string;
  ref_codigo: string;
  material_code: string;
  color_code: string;
  material_nombre: string;
  color_nombre: string;
  grades_json?: unknown;
  caso: string | null;
  cajas: number;
  pares: number;
  precio_unit: number;
  precio_neto: number;
  subtotal: number;
};

type FiJob = { shop: string; icRow: IcRow; items: FiLineItem[] };

const PPD_INSERT_CHUNK = 150;

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

function icClienteMarcaKey(idCliente: number, brand: string): string {
  return `${idCliente}|${normalizeBrandKey(brand)}`;
}

/** IC indexada por id_cliente + marca — emparejamiento canónico SHOP×BRAND del Excel. */
function indexIcsPorClienteMarca(ics: IcRow[]): Map<
  string,
  { paresIc: number; icIds: number[]; icNros: string[]; clienteNombre: string; id_cliente: number; brand: string }
> {
  const map = new Map<
    string,
    { paresIc: number; icIds: number[]; icNros: string[]; clienteNombre: string; id_cliente: number; brand: string }
  >();
  for (const ic of ics) {
    const cid = normalizeClienteId(ic.id_cliente);
    if (cid == null) continue;
    const brand = normalizeBrandKey(ic.marca_nombre);
    if (!brand) continue;
    const key = icClienteMarcaKey(cid, brand);
    const bucket = map.get(key) ?? {
      paresIc: 0,
      icIds: [],
      icNros: [],
      clienteNombre: ic.descp_cliente ?? "",
      id_cliente: cid,
      brand,
    };
    bucket.paresIc += Number(ic.cantidad_total_pares ?? 0);
    bucket.icIds.push(Number(ic.ic_id));
    bucket.icNros.push(String(ic.numero_registro));
    if (!bucket.clienteNombre && ic.descp_cliente) bucket.clienteNombre = ic.descp_cliente;
    map.set(key, bucket);
  }
  return map;
}

function normalizeBrandKey(s: string | null | undefined): string {
  return (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function rowMatchesIcMarca(
  row: ProformaRow,
  icRow: IcRow,
  ppdByMol: Map<string, number>,
  ppdMarcaById: Map<number, number>,
): boolean {
  if (!icRow.id_marca) return true;
  const rowBrand = normalizeBrandKey(row.brand);
  const icBrand = normalizeBrandKey(icRow.marca_nombre);
  if (rowBrand && icBrand && rowBrand === icBrand) return true;
  const ppdId = ppdByMol.get(molKeyProformaRow(row));
  if (!ppdId) return rowBrand ? rowBrand === icBrand : false;
  return ppdMarcaById.get(ppdId) === icRow.id_marca;
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

function resolveRowMarcaKey(
  row: ProformaRow,
  ppdByMol: Map<string, number>,
  ppdMarcaById: Map<number, number>,
): number | string {
  const ppdId = ppdByMol.get(molKeyProformaRow(row));
  if (ppdId != null && ppdMarcaById.has(ppdId)) return ppdMarcaById.get(ppdId)!;
  const b = normalizeBrandKey(row.brand);
  return b ? `brand:${b}` : "unknown";
}

function pickMarcaPool(
  poolsByMarca: Map<number | string, ProformaRow[]>,
  icRow: IcRow,
): ProformaRow[] {
  if (icRow.id_marca != null) {
    const byId = poolsByMarca.get(icRow.id_marca);
    if (byId?.length) return byId;
  }
  const bk = normalizeBrandKey(icRow.marca_nombre);
  if (bk) {
    const byBrand = poolsByMarca.get(`brand:${bk}`);
    if (byBrand?.length) return byBrand;
  }
  return [];
}

/** Consume pares de un pool mutable (misma marca) hasta cubrir cupo IC. */
function consumeProformaPool(pool: ProformaRow[], quota: number): ProformaRow[] {
  if (quota <= 0 || !pool.length) return [];
  const taken: ProformaRow[] = [];
  let left = quota;
  let i = 0;
  while (left > 0 && i < pool.length) {
    const row = pool[i];
    const pOrig = row.pairs;
    if (pOrig <= 0) {
      pool.splice(i, 1);
      continue;
    }
    const take = Math.min(pOrig, left);
    const boxesOrig = row.boxes || 1;
    const r2: ProformaRow = { ...row, pairs: take };
    if (pOrig > 0 && boxesOrig > 0) {
      r2.boxes = Math.max(1, Math.round((boxesOrig * take) / pOrig));
    }
    taken.push(r2);
    row.pairs -= take;
    left -= take;
    if (row.pairs <= 0) pool.splice(i, 1);
    else i += 1;
  }
  return taken;
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
            ic.id_marca, UPPER(TRIM(mv.descp_marca)) AS marca_nombre,
            ic.cantidad_total_pares, ic.descuento_1, ic.descuento_2,
            ic.descuento_3, ic.descuento_4, ic.id_plazo, ic.listado_precio_id,
            icp.precio_evento_id, cv.descp_cliente
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     LEFT JOIN cliente_v2 cv ON cv.id_cliente = ic.id_cliente
     LEFT JOIN marca_v2 mv ON mv.id_marca = ic.id_marca
     WHERE icp.pedido_proveedor_id = $1
     ORDER BY ic.id_cliente, ic.id`,
    [ppId],
  );
  return rows;
}

type SkuPrecioKey = { linea: string; referencia: string; material_code: string; pares: number };

function aggregateSkusProforma(rows: ProformaRow[]): SkuPrecioKey[] {
  const map = new Map<string, SkuPrecioKey>();
  for (const r of rows) {
    const linea = String(r.linea_codigo_proveedor ?? "").trim();
    const referencia = String(r.referencia_codigo_proveedor ?? "").trim();
    const material_code = String(r.material_code ?? "").trim();
    if (!linea) continue;
    const key = `${linea}\0${referencia}\0${material_code}`;
    const prev = map.get(key);
    const pares = r.pairs > 0 ? r.pairs : 0;
    map.set(key, {
      linea,
      referencia,
      material_code,
      pares: (prev?.pares ?? 0) + pares,
    });
  }
  return [...map.values()];
}

function clasificarSkuPrecio(
  row: {
    linea_id: number | null;
    referencia_id: number | null;
    material_id: number | null;
    lpn: number | null;
    caso: string | null;
  },
  casoMatriz: string | null,
): ProformaPrecioAuditEstado {
  if (!row.linea_id || !row.referencia_id || !row.material_id) return "pilares_faltantes";
  const caso = (row.caso ?? casoMatriz ?? "").trim();
  if (!caso) return "sin_caso";
  const lpn = Number(row.lpn ?? 0);
  if (!(lpn > 0)) return "sin_precio";
  return "ok";
}

function buildAvisosPrecioAudit(resumen: ProformaPrecioAuditResumen, muestra: ProformaPrecioAuditFila[]): string[] {
  const avisos: string[] = [];
  if (resumen.n_sin_caso > 0) {
    avisos.push(
      `⛔ ${resumen.n_sin_caso} SKU(s) / línea(s) SIN CASO en matriz (${resumen.pares_sin_caso.toLocaleString("es-PY")} pares) — obligatorio: Motor → asignar línea al caso (precio es aparte).`,
    );
  }
  if (resumen.n_sin_precio > 0) {
    avisos.push(
      `${resumen.n_sin_precio} SKU(s) con caso OK pero sin LPN (${resumen.pares_sin_precio.toLocaleString("es-PY")} pares) — se importan con advertencia.`,
    );
  }
  if (resumen.n_pilares_faltantes > 0) {
    avisos.push(
      `${resumen.n_pilares_faltantes} SKU(s) con pilares L·R·M incompletos (${resumen.pares_pilares_faltantes.toLocaleString("es-PY")} pares) — revisar listado o pilares.`,
    );
  }
  const detalle = muestra.filter((f) => f.estado !== "ok").slice(0, 15);
  for (const f of detalle) {
    const sku = `${f.linea}.${f.referencia}.${f.material_code || "?"}`;
    if (f.estado === "sin_precio") {
      avisos.push(
        `${sku} · L.${f.linea}: tiene caso «${f.caso ?? "?"}» pero sin LPN (${f.pares.toLocaleString("es-PY")} pares).`,
      );
    } else if (f.estado === "sin_caso") {
      avisos.push(
        `⛔ ${sku} · línea ${f.linea}: SIN CASO en matriz — asignar en Motor (POST asignar-lineas-preview) antes de operar.`,
      );
    } else {
      avisos.push(`${sku}: pilares L·R·M incompletos (${f.pares.toLocaleString("es-PY")} pares).`);
    }
  }
  if (resumen.n_ok > 0 && avisos.length === 0) {
    avisos.push(`${resumen.n_ok} SKU(s) cruzados OK con precio_lista y caso.`);
  }
  return avisos;
}

/** Cruce proforma × precio_lista (L+R+M) × caso — paridad getSkusConPrecioParaFi. */
export async function auditProformaVsPrecioLista(
  pool: Pool,
  eventoId: number,
  provId: number,
  rows: ProformaRow[],
): Promise<{ resumen: ProformaPrecioAuditResumen; muestra: ProformaPrecioAuditFila[]; avisos: string[] }> {
  const skus = aggregateSkusProforma(rows);
  const empty: ProformaPrecioAuditResumen = {
    n_skus: 0,
    n_ok: 0,
    n_sin_precio: 0,
    n_sin_caso: 0,
    n_pilares_faltantes: 0,
    pares_ok: 0,
    pares_sin_precio: 0,
    pares_sin_caso: 0,
    pares_pilares_faltantes: 0,
  };
  if (!skus.length) {
    return { resumen: empty, muestra: [], avisos: [] };
  }

  const lineas = skus.map((s) => s.linea);
  const refs = skus.map((s) => s.referencia);
  const mats = skus.map((s) => s.material_code);

  const mapaCasoLinea = await loadMapaCasoPorLineaEvento(pool, eventoId);

  const { rows: dbRows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    linea_id: number | null;
    referencia_id: number | null;
    material_id: number | null;
    lpn: number | null;
    caso: string | null;
  }>(
    `SELECT t.linea, t.referencia, t.material_code,
            l.id AS linea_id, ref.id AS referencia_id, m.id AS material_id,
            COALESCE(pl.lpn, 0)::float AS lpn,
            NULLIF(TRIM(pl.nombre_caso_aplicado), '') AS caso
     FROM unnest($1::text[], $2::text[], $3::text[]) AS t(linea, referencia, material_code)
     LEFT JOIN linea l ON l.proveedor_id = $4::bigint AND l.codigo_proveedor::text = t.linea
     LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = t.referencia
     LEFT JOIN material m ON m.proveedor_id = $4::bigint AND m.codigo_proveedor::text = t.material_code
     LEFT JOIN precio_lista pl ON pl.evento_id = $5
                               AND pl.linea_id = l.id
                               AND pl.referencia_id = ref.id
                               AND pl.material_id = m.id`,
    [lineas, refs, mats, provId, eventoId],
  );

  const paresByKey = new Map(skus.map((s) => [`${s.linea}\0${s.referencia}\0${s.material_code}`, s.pares]));
  const resumen: ProformaPrecioAuditResumen = { ...empty, n_skus: skus.length };
  const muestra: ProformaPrecioAuditFila[] = [];

  for (const db of dbRows) {
    const key = `${db.linea}\0${db.referencia}\0${db.material_code}`;
    const pares = paresByKey.get(key) ?? 0;
    const lineaNorm = String(Math.trunc(Number(db.linea)));
    const casoMatriz = mapaCasoLinea.get(lineaNorm) ?? null;
    const casoEfectivo = (db.caso ?? casoMatriz ?? "").trim() || null;
    const estado = clasificarSkuPrecio(db, casoMatriz);
    const fila: ProformaPrecioAuditFila = {
      linea: db.linea,
      referencia: db.referencia,
      material_code: db.material_code,
      pares,
      estado,
      caso: casoEfectivo,
      lpn: db.lpn != null && db.lpn > 0 ? db.lpn : null,
    };
    muestra.push(fila);

    if (estado === "ok") {
      resumen.n_ok += 1;
      resumen.pares_ok += pares;
    } else if (estado === "sin_precio") {
      resumen.n_sin_precio += 1;
      resumen.pares_sin_precio += pares;
    } else if (estado === "sin_caso") {
      resumen.n_sin_caso += 1;
      resumen.pares_sin_caso += pares;
    } else {
      resumen.n_pilares_faltantes += 1;
      resumen.pares_pilares_faltantes += pares;
    }
  }

  muestra.sort((a, b) => {
    const rank = (e: ProformaPrecioAuditEstado) =>
      e === "sin_caso" ? 0 : e === "pilares_faltantes" ? 1 : e === "sin_precio" ? 2 : 3;
    return rank(a.estado) - rank(b.estado) || b.pares - a.pares;
  });

  return { resumen, muestra, avisos: buildAvisosPrecioAudit(resumen, muestra) };
}

function payloadImportAvisos(
  pilaresImport: ProformaPilaresImportReport | undefined,
  importPrecioAudit: Awaited<ReturnType<typeof auditProformaVsPrecioLista>> | null,
): Pick<ProformaImportPhaseResult, "import_avisos" | "precio_audit" | "pilares_import"> {
  if (!pilaresImport && !importPrecioAudit) return {};
  const avisos = [...(pilaresImport?.avisos ?? []), ...(importPrecioAudit?.avisos ?? [])];
  return {
    ...(avisos.length ? { import_avisos: avisos } : {}),
    ...(importPrecioAudit ? { precio_audit: importPrecioAudit.resumen } : {}),
    ...(pilaresImport ? { pilares_import: pilaresImport } : {}),
  };
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

  const grupos = new Map<string, { brand: string; shop: string; pares: number }>();
  for (const row of parsed.rows) {
    const brand = row.brand.trim().toUpperCase();
    const shop = row.shop.trim();
    const p = row.pairs;
    if (p <= 0 || !brand || !shop) continue;
    const key = `${brand}\0${shop}`;
    const prev = grupos.get(key);
    grupos.set(key, { brand, shop, pares: (prev?.pares ?? 0) + p });
  }

  const icByClienteMarca = indexIcsPorClienteMarca(ics);
  const emparejamientos: EmparejamientoShop[] = [];
  const errores: string[] = [];
  const avisosMatch: string[] = [];
  const matchedIcKeys = new Set<string>();

  const sortedGrupos = [...grupos.values()].sort(
    (a, b) => Number.parseInt(a.shop, 10) - Number.parseInt(b.shop, 10) || a.brand.localeCompare(b.brand),
  );

  for (const grupo of sortedGrupos) {
    const shopI = Number.parseInt(grupo.shop, 10);
    if (!Number.isFinite(shopI)) {
      errores.push(`SHOP no numérico: ${grupo.brand} / ${grupo.shop}`);
      continue;
    }
    const icKey = icClienteMarcaKey(shopI, grupo.brand);
    const icHit = icByClienteMarca.get(icKey);
    if (!icHit) {
      avisosMatch.push(`SHOP ${grupo.shop} · ${grupo.brand}: sin IC id_cliente=${shopI} + marca ${grupo.brand}`);
      emparejamientos.push({
        brand: grupo.brand,
        shop: grupo.shop,
        pares_proforma: grupo.pares,
        ic_id: 0,
        ic_nro: "—",
        id_cliente: shopI,
        cliente_nombre: "",
        pares_ic: 0,
        match: false,
      });
      continue;
    }
    matchedIcKeys.add(icKey);
    const icPares = icHit.paresIc;
    const okMatch = icPares === grupo.pares;
    if (!okMatch) {
      avisosMatch.push(
        `SHOP ${grupo.shop} · ${grupo.brand} · IC [${icHit.icNros.join(", ")}]: proforma ${grupo.pares} ≠ IC ${icPares} pares`,
      );
    }
    emparejamientos.push({
      brand: grupo.brand,
      shop: grupo.shop,
      pares_proforma: grupo.pares,
      ic_id: icHit.icIds[0],
      ic_nro: icHit.icNros.join(", "),
      id_cliente: shopI,
      cliente_nombre: icHit.clienteNombre,
      pares_ic: icPares,
      match: okMatch,
    });
  }

  for (const [, icHit] of icByClienteMarca) {
    const key = icClienteMarcaKey(icHit.id_cliente, icHit.brand);
    if (matchedIcKeys.has(key)) continue;
    avisosMatch.push(
      `IC [${icHit.icNros.join(", ")}] · cliente ${icHit.id_cliente} · ${icHit.brand}: sin filas SHOP×BRAND en proforma`,
    );
  }

  const plRes = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM precio_lista WHERE evento_id = $1",
    [eventoId],
  );
  const listadoOk = (plRes.rows[0]?.c ?? 0) > 0;

  let avisosPrecio: string[] = [];
  let precioAudit: ProformaPrecioAuditResumen | undefined;
  let precioAuditMuestra: ProformaPrecioAuditFila[] | undefined;

  if (listadoOk) {
    try {
      const audit = await auditProformaVsPrecioLista(pool, eventoId, provId, parsed.rows);
      avisosPrecio = audit.avisos;
      precioAudit = audit.resumen;
      precioAuditMuestra = audit.muestra.slice(0, 30);
    } catch (e) {
      avisosPrecio = [
        `Auditoría precio_lista falló (no bloquea): ${e instanceof Error ? e.message : "error"}`,
      ];
    }
  } else {
    avisosPrecio = ["Listado vinculado sin filas en precio_lista — no se pudo auditar pilares × precios."];
  }

  let pilaresPreview: ProformaPilaresImportReport;
  try {
    pilaresPreview = await buildProformaPilaresImportReport(pool, {
      rows: parsed.rows,
      proveedorId: provId,
      eventoId,
      preview: true,
    });
  } catch (e) {
    pilaresPreview = {
      stats: {
        lineas_nuevas: 0,
        lineas_nuevas_codigos: [],
        lineas_enriquecidas: 0,
        referencias_nuevas: 0,
        linea_referencia_nuevas: 0,
        materiales_tocados: 0,
        colores_tocados: 0,
        tonos_asignados: 0,
        duracion_ms: 0,
      },
      lineas_proforma: [],
      lineas_sin_pilar: [],
      lineas_sin_biblioteca: [],
      lineas_en_biblioteca: [],
      biblioteca_id: null,
      biblioteca_nombre: null,
      avisos: [
        `Reporte pilares falló (no bloquea SHOP↔IC): ${e instanceof Error ? e.message : "error"}`,
      ],
    };
  }

  return {
    ok: errores.length === 0,
    preview: true,
    programado: true,
    pp_id: ppId,
    total_pares: parsed.totalPares,
    n_filas: parsed.rows.length,
    n_grupos_shop: grupos.size,
    evento_id: eventoId,
    emparejamientos,
    errores,
    avisos: [...avisosMatch, ...pilaresPreview.avisos, ...avisosPrecio],
    precio_audit: precioAudit,
    precio_audit_muestra: precioAuditMuestra,
    listado_vinculado: listadoOk,
    pilares_import: pilaresPreview,
  };
}

async function getNextNroFiBase(client: PoolClient, ppId: number): Promise<number> {
  const { rows } = await client.query<{ correlativo: number }>(
    `SELECT COALESCE(
       MAX(CAST(REGEXP_REPLACE(nro_factura, '^[0-9]+-PV', '') AS INTEGER)), 0
     ) AS correlativo
     FROM factura_interna
     WHERE pp_id = $1 AND nro_factura ~ '^[0-9]+-PV[0-9]+$'`,
    [ppId],
  );
  return rows[0]?.correlativo ?? 0;
}

function formatNroFi(ppId: number, correlativo: number): string {
  return `${ppId}-PV${String(correlativo).padStart(3, "0")}`;
}

async function populatePpFromProforma(
  client: PoolClient,
  pp: PpRow,
  proforma: string,
  detalleRows: ProformaRow[],
): Promise<{ ok: boolean; message: string; pilaresStats: ProformaPilaresStats }> {
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

  const pilaresStats = await provisionPilaresFromProforma(client, provId, detalleRows, marcaLookup);

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

  const pilarFkLookups = await loadPpdPilarFkLookups(client, provId);

  await client.query("DELETE FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1", [ppId]);

  const insertRows: unknown[][] = [];

  for (const r of detalleRows) {
    const fobUnit = r.unit_fob;
    const fobAj = calcFobAjustadoPct(fobUnit, pp.descuento_1, pp.descuento_2, pp.descuento_3, pp.descuento_4);
    const grades = r.grades_json;
    const brandKey = r.brand.trim().toUpperCase();
    const idMarca = marcaLookup.get(brandKey) ?? null;
    const matCode = String(r.material_code || "").trim();
    const colCode = String(r.color_code || "").trim();
    const matHit = matLookup.get(matCode);
    const colHit = colLookup.get(colCode);
    const { linea_id, referencia_id } = resolvePpdPilarIds(
      pilarFkLookups,
      r.linea_codigo_proveedor || "",
      r.referencia_codigo_proveedor || "",
    );

    insertRows.push([
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
      JSON.stringify({
        ...grades,
        _shop: r.shop.trim(),
        _brand: r.brand.trim(),
        _item: String(r.item ?? ""),
      }),
      Number.parseInt(r.item, 10) || 0,
      linea_id,
      referencia_id,
    ]);
  }

  const colCount = 32;
  for (let i = 0; i < insertRows.length; i += PPD_INSERT_CHUNK) {
    const chunk = insertRows.slice(i, i + PPD_INSERT_CHUNK);
    const values: unknown[] = [];
    const tuples = chunk.map((row, rowIdx) => {
      const base = rowIdx * colCount;
      values.push(...row);
      const ph = Array.from({ length: colCount }, (_, j) => {
        const n = base + j + 1;
        return j === 28 ? `$${n}::jsonb` : `$${n}`;
      });
      return `(${ph.join(", ")})`;
    });
    await client.query(
      `INSERT INTO pedido_proveedor_detalle (
         pedido_proveedor_id, cantidad, id_marca, ncm, style_code, linea, referencia, nombre,
         id_material, descp_material, material_code, id_color, descp_color, color_code, grada,
         t33, t34, t35, t36, t37, t38, t39, t40,
         cantidad_cajas, cantidad_pares, unit_fob, unit_fob_ajustado, amount_fob, grades_json, fila_origen_f9,
         linea_id, referencia_id
       ) VALUES ${tuples.join(", ")}`,
      values,
    );
  }

  await backfillPpdPilarFks(client, ppId);

  await client.query(
    `UPDATE pedido_proveedor_detalle ppd
     SET id_marca = COALESCE(l.marca_id, ppd.id_marca)
     FROM linea l
     WHERE ppd.pedido_proveedor_id = $1
       AND ppd.linea_id = l.id
       AND l.marca_id IS NOT NULL`,
    [ppId],
  );

  await saveProformaFilas(client, ppId, detalleRows);
  await backfillPpdShopFromSnapshot(client, ppId);

  return {
    ok: true,
    message: `${totalPares.toLocaleString("es-PY")} pares · ${detalleRows.length} SKUs · USD ${totalFob.toLocaleString("es-PY")}`,
    pilaresStats,
  };
}

type SkuFi = SkuPrecioTiers & {
  ppd_id: number;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  color_id: number | null;
  caso: string | null;
};

async function getSkusConPrecioParaFi(client: PoolClient, ppId: number, eventoId: number): Promise<Map<number, SkuFi>> {
  const pool = getRimecPool();
  const [mapaCasoLinea, casosEvento] = await Promise.all([
    loadMapaCasoPorLineaEvento(pool, eventoId),
    loadCasosEventoNombres(pool, eventoId),
  ]);

  const { rows } = await client.query<
    SkuFi & {
      linea: string;
      caso_pl: string | null;
      estilo_lr: string;
      estilo_linea: string;
      material: string;
    }
  >(
    `SELECT ppd.id AS ppd_id, TRIM(ppd.linea) AS linea,
            l_eff.id AS linea_id, ref_eff.id AS referencia_id,
            m_eff.id AS material_id, c_eff.id AS color_id,
            COALESCE(
              NULLIF(TRIM(pl_fk.nombre_caso_aplicado), ''),
              NULLIF(TRIM(pec_fk.nombre_caso), ''),
              NULLIF(TRIM(pl_cod.nombre_caso_aplicado), ''),
              NULLIF(TRIM(pec_cod.nombre_caso), ''),
              '—'
            ) AS caso_pl,
            COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), NULLIF(TRIM(lr.descp_grupo_estilo), ''), '') AS estilo_lr,
            COALESCE(NULLIF(TRIM(ge_linea.descp_grupo_estilo), ''), '') AS estilo_linea,
            COALESCE(m_eff.descripcion, ppd.descp_material, '') AS material,
            COALESCE(pl_fk.lpn, pl_cod.lpn, 0)::float AS lpn,
            COALESCE(pl_fk.lpc02, pl_cod.lpc02, 0)::float AS lpc02,
            COALESCE(pl_fk.lpc03, pl_cod.lpc03, 0)::float AS lpc03,
            COALESCE(pl_fk.lpc04, pl_cod.lpc04, 0)::float AS lpc04,
            NULL::text AS caso
     FROM pedido_proveedor_detalle ppd
     JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
     LEFT JOIN linea l ON l.id = ppd.linea_id
     LEFT JOIN linea l_cod
       ON l_cod.proveedor_id = pp.proveedor_importacion_id AND l_cod.codigo_proveedor::text = ppd.linea AND l.id IS NULL
     LEFT JOIN linea l_eff ON l_eff.id = COALESCE(l.id, l_cod.id)
     LEFT JOIN referencia ref ON ref.id = ppd.referencia_id
     LEFT JOIN referencia ref_cod
       ON ref_cod.linea_id = l_eff.id AND ref_cod.codigo_proveedor::text = TRIM(COALESCE(ppd.referencia, '0')) AND ref.id IS NULL
     LEFT JOIN referencia ref_eff ON ref_eff.id = COALESCE(ref.id, ref_cod.id)
     LEFT JOIN linea_referencia lr
       ON lr.linea_id = l_eff.id AND lr.referencia_id = ref_eff.id AND lr.proveedor_id = pp.proveedor_importacion_id
     LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
     LEFT JOIN grupo_estilo_v2 ge_linea ON ge_linea.id_grupo_estilo = l_eff.grupo_estilo_id
     LEFT JOIN material m ON m.id = ppd.id_material
     LEFT JOIN material m_cod
       ON m_cod.proveedor_id = pp.proveedor_importacion_id AND m_cod.codigo_proveedor::text = ppd.material_code AND m.id IS NULL
     LEFT JOIN material m_eff ON m_eff.id = COALESCE(m.id, m_cod.id)
     LEFT JOIN color c ON c.id = ppd.id_color
     LEFT JOIN color c_cod ON c_cod.codigo_proveedor::text = ppd.color_code AND c.id IS NULL
     LEFT JOIN color c_eff ON c_eff.id = COALESCE(c.id, c_cod.id)
     LEFT JOIN precio_lista pl_fk
       ON pl_fk.evento_id = $2 AND pl_fk.linea_id = l_eff.id
      AND pl_fk.referencia_id = ref_eff.id AND pl_fk.material_id = m_eff.id
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
     WHERE ppd.pedido_proveedor_id = $1 AND ppd.linea IS NOT NULL AND ppd.linea != ''`,
    [ppId, eventoId],
  );
  const map = new Map<number, SkuFi>();
  for (const r of rows) {
    if (!r.linea_id || !r.referencia_id || !r.material_id) continue;
    const casoEfectivo = resolveCasoMotorPrecios({
      casoPl: r.caso_pl ?? "—",
      casoPele: casoLineaFromMapa(mapaCasoLinea, r.linea),
      estiloLr: r.estilo_lr,
      estiloLinea: r.estilo_linea,
      materialHint: r.material,
      casosEvento,
    });
    map.set(r.ppd_id, {
      ppd_id: r.ppd_id,
      linea_id: r.linea_id,
      referencia_id: r.referencia_id,
      material_id: r.material_id,
      color_id: r.color_id,
      caso: casoEfectivo === "—" ? null : casoEfectivo,
      lpn: r.lpn,
      lpc02: r.lpc02,
      lpc03: r.lpc03,
      lpc04: r.lpc04,
    });
  }
  return map;
}

async function crearFacturaInterna(
  client: PoolClient,
  ppId: number,
  ic: IcRow,
  items: FiLineItem[],
  nroOverride?: string,
): Promise<{ ok: boolean; nro: string }> {
  const nro = nroOverride ?? formatNroFi(ppId, (await getNextNroFiBase(client, ppId)) + 1);
  const totalPares = items.reduce((s, i) => s + i.pares, 0);
  const totalMonto = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
  let casoCab = casoDominanteDeNombres(items.map((i) => i.caso));
  let casoId: number | null = null;
  if (ic.precio_evento_id && items.length) {
    const resolved = await resolveCasoDominanteDesdePpd(
      client,
      ppId,
      ic.precio_evento_id,
      items.map((i) => i.ppd_id),
    );
    if (!casoCab) casoCab = resolved.caso;
    if (resolved.caso && (!casoCab || resolved.caso === casoCab)) {
      casoId = resolved.caso_id;
    }
  }

  const fiRes = await client.query<{ id: number }>(
    `INSERT INTO factura_interna
       (pp_id, nro_factura, cliente_id, vendedor_id, plazo_id, lista_precio_id,
        marca, marca_id, caso, caso_id,
        descuento_1, descuento_2, descuento_3, descuento_4, total_pares, total_monto, estado, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'RESERVADA', $17)
     RETURNING id`,
    [
      ppId,
      nro,
      ic.id_cliente,
      ic.id_vendedor,
      ic.id_plazo,
      ic.listado_precio_id ?? 1,
      ic.marca_nombre,
      ic.id_marca,
      casoCab,
      casoId,
      ic.descuento_1,
      ic.descuento_2,
      ic.descuento_3,
      ic.descuento_4,
      totalPares,
      totalMonto,
      ic.numero_registro,
    ],
  );
  const fiId = fiRes.rows[0].id;

  if (items.length) {
    const values: unknown[] = [];
    const tuples = items.map((item, idx) => {
      const base = idx * 8;
      const snap = buildLineaSnapshotForFi({
        linea_codigo: item.linea_codigo,
        ref_codigo: item.ref_codigo,
        material_code: item.material_code,
        color_code: item.color_code,
        material_nombre: item.material_nombre,
        color_nombre: item.color_nombre,
        grades_json: item.grades_json,
        origen: "proforma-programado",
      });
      values.push(fiId, item.ppd_id, item.cajas, item.pares, item.precio_unit, item.subtotal, item.precio_neto, snap);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}::jsonb)`;
    });
    await client.query(
      `INSERT INTO factura_interna_detalle
         (factura_id, ppd_id, cajas, pares, precio_unit, subtotal, precio_neto, linea_snapshot)
       VALUES ${tuples.join(", ")}`,
      values,
    );
    for (const item of items) {
      if (item.ppd_id && item.pares > 0) {
        await client.query("SELECT descontar_stock_pp($1, $2)", [item.ppd_id, item.pares]);
      }
    }
  }

  return { ok: true, nro };
}

async function loadPpdByMol(client: PoolClient, ppId: number): Promise<Map<string, number>> {
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
      typeof pr.grades_json === "object" && pr.grades_json ? ({ ...(pr.grades_json as Record<string, unknown>) } as Record<string, unknown>) : {};
    delete gj._shop;
    delete gj._brand;
    delete gj._item;
    const key = canonicalMolKey(String(pr.linea), String(pr.referencia), String(pr.material_code), String(pr.color_code), gj as Record<string, number>);
    ppdByMol.set(key, pr.id);
  }
  return ppdByMol;
}

async function loadPpdMarcaById(client: PoolClient, ppId: number): Promise<Map<number, number>> {
  const { rows } = await client.query<{ id: string; id_marca: string }>(
    `SELECT id, id_marca FROM pedido_proveedor_detalle
     WHERE pedido_proveedor_id = $1 AND id_marca IS NOT NULL`,
    [ppId],
  );
  const out = new Map<number, number>();
  for (const r of rows) out.set(Number(r.id), Number(r.id_marca));
  return out;
}

function buildProgramadoFiJobs(
  detalle: ProformaRow[],
  ics: IcRow[],
  ppdByMol: Map<string, number>,
  ppdMarcaById: Map<number, number>,
  skuByPpd: Map<number, SkuFi>,
): { jobs: FiJob[]; errores: string[]; avisos: string[] } {
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

  const jobs: FiJob[] = [];
  const errores: string[] = [];
  const avisos: string[] = [];
  const sortedShops = [...icsByShop.keys()].sort();

  for (const shop of sortedShops) {
    const icGroup = [...icsByShop.get(shop)!].sort((a, b) => a.ic_id - b.ic_id);
    const shopRowsAll = rowsByShop.get(shop) ?? [];

    const poolsByMarca = new Map<number | string, ProformaRow[]>();
    if (shopRowsAll.length) {
      for (const r of shopRowsAll) {
        const mk = resolveRowMarcaKey(r, ppdByMol, ppdMarcaById);
        const list = poolsByMarca.get(mk) ?? [];
        list.push({ ...r });
        poolsByMarca.set(mk, list);
      }
    }

    for (const icRow of icGroup) {
      if (!shopRowsAll.length) {
        avisos.push(`IC ${icRow.numero_registro}: sin filas proforma shop ${shop}`);
        jobs.push({ shop, icRow, items: [] });
        continue;
      }

      const pool = pickMarcaPool(poolsByMarca, icRow);
      const cupo = icRow.cantidad_total_pares ?? 0;
      const assigned = consumeProformaPool(pool, cupo);

      if (!assigned.length) {
        avisos.push(
          `IC ${icRow.numero_registro}: sin filas proforma marca ${icRow.marca_nombre ?? "?"} en shop ${shop}`,
        );
      } else {
        const assignedPares = assigned.reduce((s, r) => s + r.pairs, 0);
        if (cupo > 0 && assignedPares !== cupo) {
          avisos.push(
            `IC ${icRow.numero_registro}: cupo ${cupo}p ≠ filas marca ${assignedPares}p (${icRow.marca_nombre ?? "?"})`,
          );
        }
      }

      const d1 = Number(icRow.descuento_1 ?? 0);
      const d2 = Number(icRow.descuento_2 ?? 0);
      const d3 = Number(icRow.descuento_3 ?? 0);
      const d4 = Number(icRow.descuento_4 ?? 0);
      const tier = fiListaTier(icRow.listado_precio_id);
      const items: FiLineItem[] = [];

      for (const r of assigned) {
        const molKey = molKeyProformaRow(r);
        const ppdId = ppdByMol.get(molKey);
        if (!ppdId) {
          avisos.push(
            `IC ${icRow.numero_registro}: molécula ${r.linea_codigo_proveedor}.${r.referencia_codigo_proveedor} sin PPD`,
          );
          continue;
        }
        const ppdMarca = ppdMarcaById.get(ppdId);
        if (icRow.id_marca && ppdMarca && ppdMarca !== icRow.id_marca) continue;
        const sku = skuByPpd.get(ppdId);
        if (!sku?.linea_id) {
          avisos.push(`IC ${icRow.numero_registro}: pilares/LPN faltantes PPD ${ppdId}`);
          continue;
        }
        const casoLinea = (sku.caso ?? "").trim();
        if (!casoLinea) {
          avisos.push(`IC ${icRow.numero_registro}: sin caso comercial PPD ${ppdId} — incluido en FI igual`);
        }
        const { precio_unit, precio_neto, subtotal } = calcLineaFiPrecio(sku, tier, d1, d2, d3, d4, r.pairs);
        items.push({
          ppd_id: ppdId,
          linea_id: sku.linea_id,
          referencia_id: sku.referencia_id,
          material_id: sku.material_id,
          color_id: sku.color_id,
          linea_codigo: r.linea_codigo_proveedor,
          ref_codigo: r.referencia_codigo_proveedor,
          material_code: String(r.material_code ?? "").trim(),
          color_code: String(r.color_code ?? "").trim(),
          material_nombre: r.material,
          color_nombre: r.color,
          grades_json: r.grades_json,
          caso: casoLinea || null,
          cajas: r.boxes || 1,
          pares: r.pairs,
          precio_unit,
          precio_neto,
          subtotal,
        });
      }

      if (!items.length && assigned.length) {
        avisos.push(
          `IC ${icRow.numero_registro}: sin líneas con LPN/pilares (${assigned.length} filas proforma marca)`,
        );
      }
      jobs.push({ shop, icRow, items });
    }
  }

  return { jobs, errores, avisos };
}

export async function importProformaProgramadoPhased(
  ppId: number,
  fileBuffer: Buffer,
  opts: {
    proforma?: string;
    phase?: ProformaImportPhase;
    fiOffset?: number;
    fiBatchSize?: number;
  } = {},
): Promise<ProformaImportPhaseResult> {
  const phase = opts.phase ?? "all";
  const fiBatchSize = Math.max(1, Math.min(30, opts.fiBatchSize ?? PROFORMA_FI_BATCH_SIZE));
  let fiOffset = Math.max(0, opts.fiOffset ?? 0);

  const parsed = parseProforma(fileBuffer);
  if (parsed.error) return { ok: false, error: parsed.error, programado: true, phase };

  let preview: ProformaPreviewResult;
  let eventoId: number;

  const pool0 = getRimecPool();
  const ppdExistsRes =
    phase === "fi"
      ? await pool0.query<{ ok: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1
           ) AS ok`,
          [ppId],
        )
      : null;
  const ppdExists = ppdExistsRes?.rows[0]?.ok === true;

  if (phase === "fi" && (fiOffset > 0 || ppdExists)) {
    const ics0 = await loadIcsPpProgramado(pool0, ppId);
    const eventoIds = [
      ...new Set(
        ics0
          .map((i) => {
            const n = Number(i.precio_evento_id);
            return Number.isFinite(n) ? n : null;
          })
          .filter((x): x is number => x != null),
      ),
    ];
    if (eventoIds.length !== 1) {
      return { ok: false, error: "Las ICs del PP deben compartir un único listado de precios vinculado.", programado: true, phase };
    }
    eventoId = eventoIds[0];
    preview = { ok: true, listado_vinculado: true, evento_id: eventoId };
  } else {
    preview = await previewImportProformaProgramadoTs(ppId, fileBuffer);
    if (!preview.ok) {
      return {
        ...preview,
        ok: false,
        error: preview.errores?.join("; ") || "Emparejamiento SHOP↔IC inválido",
        programado: true,
        phase,
      };
    }
    if (!preview.listado_vinculado) {
      return { ok: false, error: "Vinculá el listado de precios RIMEC antes de importar programado.", programado: true, phase };
    }
    eventoId = preview.evento_id!;
  }

  const pool = getRimecPool();
  const pp = await loadPp(pool, ppId);
  if (!pp) return { ok: false, error: `PP ${ppId} no encontrado.`, programado: true, phase };

  const proforma = (opts.proforma || pp.numero_proforma || "").trim();
  if (!proforma) return { ok: false, error: "Nro proforma obligatorio.", programado: true, phase };

  let detalle: ProformaRow[];
  if (phase === "fi" && ppdExists) {
    const loaded = await loadProformaDetalleParaFi(pool, ppId);
    if (!loaded?.detalle.length) {
      return {
        ok: false,
        error: "Proforma en BD incompleta — no se pudo inferir SHOP desde PPD+IC.",
        programado: true,
        phase: "fi",
      };
    }
    detalle = loaded.detalle;
  } else {
    detalle = parsed.rows;
  }

  let importPrecioAudit: Awaited<ReturnType<typeof auditProformaVsPrecioLista>> | null = null;
  let pilaresImportReport: ProformaPilaresImportReport | undefined;

  if (phase === "ppd" || phase === "all") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const pop = await populatePpFromProforma(client, pp, proforma, detalle);
      if (!pop.ok) {
        await client.query("ROLLBACK");
        return { ok: false, error: pop.message, programado: true, phase: "ppd" };
      }
      await client.query("COMMIT");
      const provId = pp.proveedor_importacion_id ?? 654;
      const postAvisos: string[] = [];
      try {
        importPrecioAudit = await auditProformaVsPrecioLista(pool, eventoId, provId, detalle);
        postAvisos.push(...importPrecioAudit.avisos);
      } catch (e) {
        postAvisos.push(
          `Auditoría precio_lista falló (PPD ya guardado): ${e instanceof Error ? e.message : "error"}`,
        );
      }
      try {
        pilaresImportReport = await buildProformaPilaresImportReport(pool, {
          rows: detalle,
          proveedorId: provId,
          eventoId,
          stats: pop.pilaresStats,
        });
        postAvisos.push(...pilaresImportReport.avisos);
      } catch (e) {
        postAvisos.push(
          `Reporte pilares falló (PPD ya guardado): ${e instanceof Error ? e.message : "error"}`,
        );
      }
      if (phase === "ppd") {
        return {
          ok: true,
          programado: true,
          phase: "ppd",
          done: false,
          pp_id: ppId,
          pares: parsed.totalPares,
          n_articulos: detalle.length,
          message: pop.message,
          fi_total: (await loadIcsPpProgramado(pool, ppId)).length,
          fi_offset: 0,
          fi_offset_next: 0,
          fi_batch: fiBatchSize,
          import_avisos: postAvisos,
          precio_audit: importPrecioAudit?.resumen,
          pilares_import: pilaresImportReport,
        };
      }
    } catch (e) {
      await client.query("ROLLBACK");
      return { ok: false, error: e instanceof Error ? e.message : "Error PPD", programado: true, phase: "ppd" };
    } finally {
      client.release();
    }
  }

  const ics = await loadIcsPpProgramado(pool, ppId);
  const ppdCount = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
    [ppId],
  );
  if ((ppdCount.rows[0]?.c ?? 0) === 0) {
    return { ok: false, error: "Sin PPD — ejecutá fase ppd primero.", programado: true, phase: "fi" };
  }

  const existingFiRes = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1",
    [ppId],
  );
  const existingFi = existingFiRes.rows[0]?.c ?? 0;
  if (fiOffset < existingFi) fiOffset = existingFi;

  const client = await pool.connect();
  try {
    const skuByPpd = await getSkusConPrecioParaFi(client, ppId, eventoId);
    if (!skuByPpd.size) {
      return { ok: false, error: "Sin SKUs PPD tras import (listado/pilares).", programado: true, phase: "fi" };
    }

    const ppdByMol = await loadPpdByMol(client, ppId);
    const ppdMarcaById = await loadPpdMarcaById(client, ppId);
    const { jobs, errores: planErrores, avisos: planAvisos } = buildProgramadoFiJobs(
      detalle,
      ics,
      ppdByMol,
      ppdMarcaById,
      skuByPpd,
    );
    if (planErrores.length) {
      return {
        ok: false,
        error: planErrores.slice(0, 3).join("; "),
        programado: true,
        phase: "fi",
        fi_errores: planErrores,
        fi_avisos: planAvisos,
      };
    }

    const fiTotal = jobs.length;
    if (fiTotal === 0 && existingFi === 0) {
      return {
        ok: false,
        error:
          planAvisos.length > 0
            ? planAvisos.slice(0, 3).join("; ")
            : "No se generaron trabajos FI (0 IC×shop) — revisá emparejamiento SHOP↔IC y moléculas PPD.",
        programado: true,
        phase: "fi",
        fi_errores: planErrores,
        fi_avisos: planAvisos,
        fi_total: 0,
        n_fi: 0,
      };
    }

    const batchJobs = phase === "all" ? jobs : jobs.slice(fiOffset, fiOffset + fiBatchSize);
    if (!batchJobs.length && fiOffset >= fiTotal) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET pares_vendidos = cantidad_pares WHERE pedido_proveedor_id = $1`,
        [ppId],
      );
      return {
        ok: true,
        programado: true,
        phase: phase === "all" ? "all" : "fi",
        done: true,
        pp_id: ppId,
        pares: parsed.totalPares,
        n_articulos: detalle.length,
        n_fi: existingFi,
        fi_total: fiTotal,
        fi_offset: fiOffset,
        fi_offset_next: fiTotal,
        message: "Import programado completo.",
        ...payloadImportAvisos(pilaresImportReport, importPrecioAudit),
      };
    }

    await client.query("BEGIN");
    let nroBase = await getNextNroFiBase(client, ppId);
    const fiCreadas: FiCreadaProgramado[] = [];
    const fiErrores: string[] = [];

    for (const job of batchJobs) {
      nroBase += 1;
      const nro = formatNroFi(ppId, nroBase);
      const fi = await crearFacturaInterna(client, ppId, job.icRow, job.items, nro);
      if (fi.ok) {
        fiCreadas.push({
          ic_nro: job.icRow.numero_registro,
          shop: job.shop,
          fi_nro: fi.nro,
          pares: job.items.reduce((s, x) => s + x.pares, 0),
        });
      } else {
        fiErrores.push(`IC ${job.icRow.numero_registro}: ${fi.nro}`);
      }
    }

    if (fiErrores.length) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: fiErrores.slice(0, 3).join("; "),
        programado: true,
        phase: "fi",
        fi_errores: fiErrores,
        fi_creadas: fiCreadas,
        n_fi: existingFi + fiCreadas.length,
      };
    }

    const nextOffset = fiOffset + batchJobs.length;
    const done = nextOffset >= fiTotal;

    if (done) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET pares_vendidos = cantidad_pares WHERE pedido_proveedor_id = $1`,
        [ppId],
      );
    }

    await client.query("COMMIT");

    return {
      ok: true,
      programado: true,
      phase: phase === "all" ? "all" : "fi",
      done,
      pp_id: ppId,
      pares: parsed.totalPares,
      n_articulos: detalle.length,
      message: done ? "Import programado completo." : `FI ${nextOffset}/${fiTotal}`,
      fi_creadas: fiCreadas,
      fi_errores: fiErrores,
      n_fi: existingFi + fiCreadas.length,
      fi_total: fiTotal,
      fi_offset: fiOffset,
      fi_offset_next: nextOffset,
      fi_batch: fiBatchSize,
      fi_avisos: planAvisos.length ? planAvisos : undefined,
      ...payloadImportAvisos(pilaresImportReport, importPrecioAudit),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al importar programado",
      programado: true,
      phase: "fi",
    };
  } finally {
    client.release();
  }
}

export async function importProformaProgramadoTs(
  ppId: number,
  fileBuffer: Buffer,
  proformaOverride?: string,
  importOpts?: { phase?: ProformaImportPhase; fiOffset?: number; fiBatchSize?: number },
): Promise<ProformaImportPhaseResult> {
  return importProformaProgramadoPhased(ppId, fileBuffer, {
    proforma: proformaOverride,
    phase: importOpts?.phase ?? "all",
    fiOffset: importOpts?.fiOffset,
    fiBatchSize: importOpts?.fiBatchSize,
  });
}

/** Crear FI pendientes (1 por IC) sin borrar PPD. Usa proforma ya guardada o inferida desde PPD+IC. */
export async function completarFiProgramadoPhased(
  ppId: number,
  opts: { fileBuffer?: Buffer | null; fiOffset?: number; fiBatchSize?: number } = {},
): Promise<ProformaImportPhaseResult & { needs_proforma_file?: boolean }> {
  const fiBatchSize = Math.max(1, Math.min(30, opts.fiBatchSize ?? PROFORMA_FI_BATCH_SIZE));
  let fiOffset = Math.max(0, opts.fiOffset ?? 0);
  const pool = getRimecPool();
  await enrichProformaBrandsFromPpd(pool, ppId);

  let detalle: ProformaRow[];
  let totalPares: number;

  if (opts.fileBuffer?.length) {
    const parsed = parseProforma(opts.fileBuffer);
    if (parsed.error) return { ok: false, error: parsed.error, programado: true, phase: "fi" };
    detalle = parsed.rows;
    totalPares = parsed.totalPares;
    await saveProformaFilas(pool, ppId, detalle);
  } else {
    const loaded = await loadProformaDetalleParaFi(pool, ppId);
    if (!loaded?.detalle.length) {
      return {
        ok: false,
        error:
          "No se pudo reconstruir la proforma desde BD (PPD+IC) — verificá que stock e ICs coincidan en pares.",
        programado: true,
        phase: "fi",
        needs_proforma_file: false,
      };
    }
    detalle = loaded.detalle;
    totalPares = detalle.reduce((s, r) => s + r.pairs, 0);
  }

  const ics = await loadIcsPpProgramado(pool, ppId);
  if (!ics.length) {
    return { ok: false, error: "El PP no tiene ICs vinculadas.", programado: true, phase: "fi" };
  }

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
    return {
      ok: false,
      error: "Las ICs del PP deben compartir un único listado de precios vinculado.",
      programado: true,
      phase: "fi",
    };
  }
  const eventoId = eventoIds[0];

  const ppdCount = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM pedido_proveedor_detalle WHERE pedido_proveedor_id = $1",
    [ppId],
  );
  if ((ppdCount.rows[0]?.c ?? 0) === 0) {
    return { ok: false, error: "Sin stock PPD — importá la proforma primero.", programado: true, phase: "fi" };
  }

  const existingFiRes = await pool.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM factura_interna WHERE pp_id = $1",
    [ppId],
  );
  const existingFi = existingFiRes.rows[0]?.c ?? 0;
  if (fiOffset < existingFi) fiOffset = existingFi;

  const client = await pool.connect();
  try {
    const skuByPpd = await getSkusConPrecioParaFi(client, ppId, eventoId);
    if (!skuByPpd.size) {
      return { ok: false, error: "Sin SKUs PPD tras import (listado/pilares).", programado: true, phase: "fi" };
    }

    const ppdByMol = await loadPpdByMol(client, ppId);
    const ppdMarcaById = await loadPpdMarcaById(client, ppId);
    const { jobs, errores: planErrores, avisos: planAvisos } = buildProgramadoFiJobs(
      detalle,
      ics,
      ppdByMol,
      ppdMarcaById,
      skuByPpd,
    );
    if (planErrores.length) {
      return {
        ok: false,
        error: planErrores.slice(0, 3).join("; "),
        programado: true,
        phase: "fi",
        fi_errores: planErrores,
        fi_avisos: planAvisos,
      };
    }

    const fiTotal = jobs.length;
    if (fiTotal === 0 && existingFi === 0) {
      return {
        ok: false,
        error:
          planAvisos.length > 0
            ? planAvisos.slice(0, 3).join("; ")
            : "No se generaron trabajos FI (0 IC) — revisá emparejamiento SHOP↔IC.",
        programado: true,
        phase: "fi",
        fi_avisos: planAvisos,
        fi_total: 0,
        n_fi: 0,
      };
    }

    const batchJobs = jobs.slice(fiOffset, fiOffset + fiBatchSize);
    if (!batchJobs.length && fiOffset >= fiTotal) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET pares_vendidos = cantidad_pares WHERE pedido_proveedor_id = $1`,
        [ppId],
      );
      return {
        ok: true,
        programado: true,
        phase: "fi",
        done: true,
        pp_id: ppId,
        pares: totalPares,
        n_articulos: detalle.length,
        n_fi: existingFi,
        fi_total: fiTotal,
        fi_offset: fiOffset,
        fi_offset_next: fiTotal,
        message: "Facturas internas completas.",
      };
    }

    await client.query("BEGIN");
    let nroBase = await getNextNroFiBase(client, ppId);
    const fiCreadas: FiCreadaProgramado[] = [];
    const fiErrores: string[] = [];

    for (const job of batchJobs) {
      nroBase += 1;
      const nro = formatNroFi(ppId, nroBase);
      const fi = await crearFacturaInterna(client, ppId, job.icRow, job.items, nro);
      if (fi.ok) {
        fiCreadas.push({
          ic_nro: job.icRow.numero_registro,
          shop: job.shop,
          fi_nro: fi.nro,
          pares: job.items.reduce((s, x) => s + x.pares, 0),
        });
      } else {
        fiErrores.push(`IC ${job.icRow.numero_registro}: ${fi.nro}`);
      }
    }

    if (fiErrores.length) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: fiErrores.slice(0, 3).join("; "),
        programado: true,
        phase: "fi",
        fi_errores: fiErrores,
        fi_creadas: fiCreadas,
        n_fi: existingFi + fiCreadas.length,
      };
    }

    const nextOffset = fiOffset + batchJobs.length;
    const done = nextOffset >= fiTotal;

    if (done) {
      await client.query(
        `UPDATE pedido_proveedor_detalle SET pares_vendidos = cantidad_pares WHERE pedido_proveedor_id = $1`,
        [ppId],
      );
    }

    await client.query("COMMIT");

    return {
      ok: true,
      programado: true,
      phase: "fi",
      done,
      pp_id: ppId,
      pares: totalPares,
      n_articulos: detalle.length,
      message: done ? "Facturas internas completas." : `FI ${nextOffset}/${fiTotal}`,
      fi_creadas: fiCreadas,
      fi_errores: fiErrores,
      n_fi: existingFi + fiCreadas.length,
      fi_total: fiTotal,
      fi_offset: fiOffset,
      fi_offset_next: nextOffset,
      fi_batch: fiBatchSize,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al crear FI",
      programado: true,
      phase: "fi",
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

    const provId = pp.proveedor_importacion_id ?? 654;
    const eventoRes = await pool.query<{ evento_id: number | null }>(
      `SELECT icp.precio_evento_id::int AS evento_id
       FROM intencion_compra_pedido icp
       WHERE icp.pedido_proveedor_id = $1 AND icp.precio_evento_id IS NOT NULL
       ORDER BY icp.id LIMIT 1`,
      [ppId],
    );
    const eventoId = eventoRes.rows[0]?.evento_id ?? null;
    const pilaresImport = await buildProformaPilaresImportReport(pool, {
      rows: parsed.rows,
      proveedorId: provId,
      eventoId,
      stats: pop.pilaresStats,
    });
    let importPrecioAudit: Awaited<ReturnType<typeof auditProformaVsPrecioLista>> | null = null;
    if (eventoId != null) {
      importPrecioAudit = await auditProformaVsPrecioLista(pool, eventoId, provId, parsed.rows);
    }

    return {
      ok: true,
      programado: false,
      pp_id: ppId,
      pares: parsed.totalPares,
      n_articulos: parsed.rows.length,
      message: pop.message,
      ...payloadImportAvisos(pilaresImport, importPrecioAudit),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al importar" };
  } finally {
    client.release();
  }
}

export async function borrarFiReservadasProgramado(
  ppId: number,
): Promise<{ ok: boolean; n?: number; error?: string }> {
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conf = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM factura_interna
       WHERE pp_id = $1 AND UPPER(TRIM(estado)) = 'CONFIRMADA'`,
      [ppId],
    );
    if ((conf.rows[0]?.c ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Hay FI CONFIRMADA — no se puede regenerar." };
    }
    await client.query(
      `UPDATE pedido_proveedor_detalle ppd
       SET pares_vendidos = GREATEST(
         0,
         COALESCE(ppd.pares_vendidos, 0) - COALESCE(agg.pares, 0)
       )
       FROM (
         SELECT fid.ppd_id, SUM(COALESCE(fid.pares, 0))::int AS pares
         FROM factura_interna_detalle fid
         INNER JOIN factura_interna fi ON fi.id = fid.factura_id
         WHERE fi.pp_id = $1
         GROUP BY fid.ppd_id
       ) agg
       WHERE ppd.id = agg.ppd_id AND ppd.pedido_proveedor_id = $1`,
      [ppId],
    );
    await client.query(
      `DELETE FROM factura_interna_detalle fid
       USING factura_interna fi
       WHERE fid.factura_id = fi.id AND fi.pp_id = $1`,
      [ppId],
    );
    const del = await client.query(`DELETE FROM factura_interna WHERE pp_id = $1 RETURNING id`, [ppId]);
    await client.query("COMMIT");
    return { ok: true, n: del.rowCount ?? 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : "Error al borrar FI" };
  } finally {
    client.release();
  }
}

export async function borrarImportacionTs(ppId: number): Promise<{ ok: boolean; message?: string; error?: string }> {
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const chk = await client.query<{ n: number; vend_vt: number; fi_conf: number }>(
      `SELECT COUNT(ppd.id)::int AS n,
              COALESCE((
                SELECT SUM(vt.cantidad_vendida)::int
                FROM venta_transito vt
                JOIN pedido_proveedor_detalle d ON d.id = vt.pedido_proveedor_detalle_id
                WHERE d.pedido_proveedor_id = $1
              ), 0) AS vend_vt,
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
    if (row.vend_vt > 0 || row.fi_conf > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error:
          row.fi_conf > 0
            ? "No se puede borrar: hay FI confirmadas."
            : "No se puede borrar: hay ventas en tránsito Web.",
      };
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
    await client.query(`DELETE FROM pp_proforma_filas WHERE pp_id = $1`, [ppId]);
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

/** Diagnóstico: ICs sin job FI (LPN/pilares/cupo). */
export async function diagnoseProgramadoFiPlan(ppId: number): Promise<{
  n_ic: number;
  n_jobs: number;
  ic_sin_fi: { nro: string; id_cliente: number; pares: number }[];
  avisos: string[];
  errores: string[];
}> {
  const pool = getRimecPool();
  const loaded = await loadProformaDetalleParaFi(pool, ppId);
  if (!loaded?.detalle.length) {
    return { n_ic: 0, n_jobs: 0, ic_sin_fi: [], avisos: [], errores: ["Sin proforma en BD"] };
  }
  const ics = await loadIcsPpProgramado(pool, ppId);
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
    return { n_ic: ics.length, n_jobs: 0, ic_sin_fi: [], avisos: [], errores: ["Evento listado no único"] };
  }
  const client = await pool.connect();
  try {
    const skuByPpd = await getSkusConPrecioParaFi(client, ppId, eventoIds[0]);
    const ppdByMol = await loadPpdByMol(client, ppId);
    const ppdMarcaById = await loadPpdMarcaById(client, ppId);
    const { jobs, errores, avisos } = buildProgramadoFiJobs(
      loaded.detalle,
      ics,
      ppdByMol,
      ppdMarcaById,
      skuByPpd,
    );
    const jobNros = new Set(jobs.map((j) => j.icRow.numero_registro));
    const ic_sin_fi = ics
      .filter((ic) => !jobNros.has(ic.numero_registro))
      .map((ic) => ({
        nro: ic.numero_registro,
        id_cliente: ic.id_cliente,
        pares: ic.cantidad_total_pares,
      }));
    return { n_ic: ics.length, n_jobs: jobs.length, ic_sin_fi, avisos, errores };
  } finally {
    client.release();
  }
}

/** Vincula cada FI RESERVADA/CONFIRMADA a su IC (1:1) vía notas = numero_registro. */
export async function backfillFiIcNotasProgramado(ppId: number): Promise<number> {
  const pool = getRimecPool();
  const res = await pool.query<{ id: number }>(
    `
    WITH fi_seq AS (
      SELECT fi.id AS fi_id,
             ROW_NUMBER() OVER (ORDER BY fi.cliente_id::text, fi.id) AS seq
      FROM factura_interna fi
      WHERE fi.pp_id = $1
    ),
    ic_seq AS (
      SELECT ic.numero_registro,
             ROW_NUMBER() OVER (ORDER BY ic.id_cliente::text, ic.id) AS seq
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = $1
    )
    UPDATE factura_interna fi
    SET notas = ic.numero_registro
    FROM fi_seq fs
    JOIN ic_seq ic ON ic.seq = fs.seq
    WHERE fi.id = fs.fi_id
      AND (fi.notas IS NULL OR TRIM(fi.notas) = '')
    RETURNING fi.id
    `,
    [ppId],
  );
  return res.rowCount ?? 0;
}

export type FiIntegridadAuditoria = {
  fi_multi_marca: number;
  fi_multi_caso: number;
};

export async function auditarFiIntegridadProgramado(ppId: number): Promise<FiIntegridadAuditoria> {
  const pool = getRimecPool();
  const [multiMarca, multiCaso] = await Promise.all([
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM (
         SELECT fi.id FROM factura_interna fi
         JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
         JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
         WHERE fi.pp_id = $1
         GROUP BY fi.id HAVING COUNT(DISTINCT ppd.id_marca) > 1
       ) t`,
      [ppId],
    ),
    pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM (
         SELECT fi.id FROM factura_interna fi
         JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
         JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
         JOIN pedido_proveedor pp ON pp.id = fi.pp_id
         JOIN intencion_compra ic ON ic.id_cliente = fi.cliente_id
         JOIN intencion_compra_pedido icp ON icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
         LEFT JOIN linea l ON l.proveedor_id = pp.proveedor_importacion_id AND l.codigo_proveedor::text = ppd.linea
         LEFT JOIN referencia ref ON ref.linea_id = l.id AND ref.codigo_proveedor::text = ppd.referencia
         LEFT JOIN material m ON m.proveedor_id = pp.proveedor_importacion_id AND m.codigo_proveedor::text = ppd.material_code
         LEFT JOIN precio_lista pl ON pl.evento_id = icp.precio_evento_id
           AND pl.linea_id = l.id AND pl.referencia_id = ref.id AND pl.material_id = m.id
         WHERE fi.pp_id = $1
         GROUP BY fi.id HAVING COUNT(DISTINCT NULLIF(TRIM(pl.nombre_caso_aplicado), '')) > 1
       ) t`,
      [ppId],
    ),
  ]);
  return {
    fi_multi_marca: multiMarca.rows[0]?.c ?? 0,
    fi_multi_caso: multiCaso.rows[0]?.c ?? 0,
  };
}

export type RatificarFiProgramadoResult = {
  ok: boolean;
  error?: string;
  n_fi?: number;
  fi_total?: number;
  fi_borradas?: number;
  brands_reparados?: number;
  integridad?: FiIntegridadAuditoria;
  plan?: Awaited<ReturnType<typeof diagnoseProgramadoFiPlan>>;
  avisos?: string[];
};

/** IC = PROFORMA = FI riguroso: repara brand snapshot, opcional borra FI RESERVADA, crea FI por lotes, audita marcas/casos. */
export async function ratificarFiProgramadoCompleto(
  ppId: number,
  opts: { regenerar?: boolean } = {},
): Promise<RatificarFiProgramadoResult> {
  const pool = getRimecPool();
  const brandsReparados = await enrichProformaBrandsFromPpd(pool, ppId);
  await backfillFiIcNotasProgramado(ppId);
  const planPre = await diagnoseProgramadoFiPlan(ppId);
  if (planPre.errores.length) {
    return { ok: false, error: planPre.errores.slice(0, 3).join("; "), plan: planPre, brands_reparados: brandsReparados };
  }

  let fiBorradas = 0;
  if (opts.regenerar) {
    const del = await borrarFiReservadasProgramado(ppId);
    if (!del.ok) return { ok: false, error: del.error, plan: planPre, brands_reparados: brandsReparados };
    fiBorradas = del.n ?? 0;
  }

  let offset = 0;
  let last: Awaited<ReturnType<typeof completarFiProgramadoPhased>> | null = null;
  for (;;) {
    last = await completarFiProgramadoPhased(ppId, { fiOffset: offset, fiBatchSize: PROFORMA_FI_BATCH_SIZE });
    if (!last.ok) {
      return {
        ok: false,
        error: last.error ?? "Error al crear FI",
        plan: planPre,
        brands_reparados: brandsReparados,
        fi_borradas: fiBorradas,
        avisos: planPre.avisos,
      };
    }
    if (last.done) break;
    const next = Number(last.fi_offset_next);
    if (!Number.isFinite(next) || next <= offset) {
      return { ok: false, error: "FI incompletas — offset inválido", plan: planPre, brands_reparados: brandsReparados };
    }
    offset = next;
  }

  const planPost = await diagnoseProgramadoFiPlan(ppId);
  const integridad = await auditarFiIntegridadProgramado(ppId);
  if (integridad.fi_multi_marca > 0 || integridad.fi_multi_caso > 0) {
    return {
      ok: false,
      error: `Integridad FI: ${integridad.fi_multi_marca} multi-marca · ${integridad.fi_multi_caso} multi-caso`,
      n_fi: last?.n_fi,
      fi_total: last?.fi_total,
      fi_borradas: fiBorradas,
      brands_reparados: brandsReparados,
      integridad,
      plan: planPost,
      avisos: planPost.avisos,
    };
  }

  return {
    ok: true,
    n_fi: last?.n_fi,
    fi_total: last?.fi_total,
    fi_borradas: fiBorradas,
    brands_reparados: brandsReparados,
    integridad,
    plan: planPost,
    avisos: planPost.avisos,
  };
}
