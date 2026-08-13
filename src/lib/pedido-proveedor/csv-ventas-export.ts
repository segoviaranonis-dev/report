/**
 * CSV veneno Carlos — formato final v2 (8604-26_1.csv).
 * Referencia: csv's/programado/8604-26_1.csv
 */
import type { Pool } from "pg";
import { gradasDisplayFromSnapshot } from "@/app/aprobaciones/lib/linea-snapshot-display";
import { listaPrecioLabel } from "@/app/aprobaciones/lib/aprobaciones-utils";
import { parseGradesJson } from "@/lib/pedido-proveedor/ala-norte-grades";
import { gradesJsonSoloTallas } from "@/lib/pedido-proveedor/grades-json-canonical";
import {
  casoLineaFromMapa,
  resolverEstiloListadoMotor,
} from "@/lib/pedido-proveedor/resolve-caso-comercial";
import { resolveVendedorCarlosParaCsv } from "@/lib/carlos/vendedor-carlos-resolver";
import { loadPpCasoContext } from "@/lib/pedido-proveedor/pp-caso-context";
import { SQL_VENDEDOR_PP_FI_NOMBRE } from "@/lib/pedido-proveedor/vendedor-pp-integridad";

/** Nombre comercial FI — PP: vendedor_v2 / IC pareada (nunca usuario_v2). */
const VENDEDOR_NOMBRE_SQL = `${SQL_VENDEDOR_PP_FI_NOMBRE} AS vendedor_nombre`;

const VENDEDOR_JOINS_SQL = `
  LEFT JOIN vendedor_v2 vd_fi ON vd_fi.id_vendedor = fi.vendedor_id
  LEFT JOIN vendedor_v2 vd_ic ON vd_ic.id_vendedor = ic.id_vendedor
  LEFT JOIN usuario_v2 vu_fi ON vu_fi.id_usuario = fi.vendedor_id`;

/** Header único — sin fila instructiva (formato final Director). */
/** CASO = caso comercial · LISTADO DE PRECIOS = evento listado (≠ col LISTA LPN · ≠ biblioteca UI). */
const HEADER_FILA =
  "SHOP;IC;'STYL.E;BRAND;MATERIAL CODE;MATERIAL;COLOR CODE;COLOR;GRADA;CASO;LISTADO DE PRECIOS;ESTILO;ABoCR;CANT PARES;PLAZO;LISTA;Desc1;Desc2;Desc3;Desc4;Vendedor;Cobrador";

const COBRADOR = "90";

/** Matriz caja cerrada importadora — 12 pares. */
const MATRIZ_CERRADA = [1, 2, 3, 3, 2, 1];

type CsvCarlosRow = {
  fi_id: string;
  cliente_id: string | null;
  ic_nro: string | null;
  plazo_id: string | null;
  linea: string | null;
  referencia: string | null;
  marca: string | null;
  material_code: string | null;
  descp_material: string | null;
  color_code: string | null;
  descp_color: string | null;
  grades_json: unknown;
  caso: string | null;
  biblioteca: string | null;
  estilo: string | null;
  /** Pilar linea_referencia.tipo_1 — fuente canónica col ABoCR (no grades_json por color). */
  tipo_1_pilar: string | null;
  pares: string | null;
  plazo: string | null;
  lista_precio_id: string | null;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  /** PE / override — id numérico Carlos explícito */
  vendedor_carlos?: string | null;
  /** FI cabecera · vendedor_v2.id_vendedor o usuario_v2.id_usuario */
  vendedor_nexus_id?: string | null;
  /** Nombre comercial para matriz Hoja2 */
  vendedor_nombre?: string | null;
  /** Col ABoCR ya normalizada por L+R (pilares) */
  abocr?: string | null;
};

export type { CsvCarlosRow };

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[;\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvLine(cells: unknown[]): string {
  return cells.map(csvCell).join(";");
}

function gradaFromJson(raw: unknown): string {
  return gradasDisplayFromSnapshot({ grades_json: gradesJsonSoloTallas(raw) }).trim() || "";
}

/** Col ABoCR — calzado: tipo_1 pilar CERRADO/ABIERTO; confecciones: temporada; fallback grades_json. */
export function resolveCsvAbocr(tipo1Pilar: string | null | undefined, gradesJson: unknown): string {
  const t = (tipo1Pilar ?? "").trim();
  if (t) {
    const u = t.toUpperCase();
    if (u.includes("CERRADO")) return "cerrado";
    if (u.includes("ABIERTO")) return "abierto";
    return t.toLowerCase();
  }
  return gradaAbiertoCerrado(gradesJson);
}

/** @deprecated Preferir resolveCsvAbocr(tipo_1 pilar). Inferencia legacy por matriz tallas. */
export function gradaAbiertoCerrado(raw: unknown): "abierto" | "cerrado" {
  const grades = parseGradesJson(gradesJsonSoloTallas(raw));
  const keys = Object.keys(grades).sort(
    (a, b) => Number(String(a).replace(/\D/g, "")) - Number(String(b).replace(/\D/g, "")),
  );
  if (keys.length !== 6) return "abierto";
  const vals = keys.map((k) => Math.round(Number(grades[k]) || 0));
  const cerrada = vals.every((v, i) => v === MATRIZ_CERRADA[i]);
  return cerrada ? "cerrado" : "abierto";
}

/** Caso comercial solo (BCL/PELE). No mezclar con evento listado. */
function cellCaso(caso: string | null): string {
  return (caso ?? "").trim();
}

/** Evento / nombre del listado de precios (campo interno `biblioteca`). ≠ col LISTA (LPN). */
function cellListadoPrecios(eventoListado: string | null): string {
  return (eventoListado ?? "").trim();
}

/** Ley dos corazones: caso por línea desde biblioteca cabecera PP o PELE — nunca precio_lista. */
export async function enrichCsvCasoBiblioteca(
  pool: Pool,
  ppId: number,
  rows: CsvCarlosRow[],
): Promise<CsvCarlosRow[]> {
  const ctx = await loadPpCasoContext(pool, ppId);
  if (!ctx.mapaCasoLinea.size) return rows;
  return rows.map((r) => ({
    ...r,
    caso: casoLineaFromMapa(ctx.mapaCasoLinea, r.linea ?? "") || null,
  }));
}

type PilarLrRow = {
  linea: string;
  referencia: string;
  tipo_1: string | null;
  estilo_lr: string | null;
  estilo_linea: string | null;
};

function lrKeyCsv(linea: string | null | undefined, referencia: string | null | undefined): string {
  return `${String(linea ?? "").trim()}.${String(referencia ?? "").trim()}`;
}

/** Mapa L+R → pilares (tipo_1 · estilo) — paridad joins administrador IC. */
async function loadMapaPilarLrPp(pool: Pool, ppId: number): Promise<Map<string, PilarLrRow>> {
  const { rows } = await pool.query<PilarLrRow>(
    `
    SELECT DISTINCT ON (TRIM(ppd.linea), TRIM(ppd.referencia))
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      NULLIF(TRIM(t1.descp_tipo_1), '') AS tipo_1,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), NULLIF(TRIM(lr.descp_grupo_estilo), ''), '') AS estilo_lr,
      COALESCE(NULLIF(TRIM(ge_linea.descp_grupo_estilo), ''), '') AS estilo_linea
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
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
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.linea IS NOT NULL
    ORDER BY TRIM(ppd.linea), TRIM(ppd.referencia), ppd.id
    `,
    [ppId],
  );
  const map = new Map<string, PilarLrRow>();
  for (const r of rows) map.set(lrKeyCsv(r.linea, r.referencia), r);
  return map;
}

/** Moda ABoCR por grades_json cuando tipo_1 pilar vacío — garantiza 1 valor por L+R. */
function abocrModaGrades(filas: CsvCarlosRow[]): "abierto" | "cerrado" {
  const counts = { abierto: 0, cerrado: 0 };
  for (const r of filas) counts[gradaAbiertoCerrado(r.grades_json)]++;
  return counts.cerrado >= counts.abierto ? "cerrado" : "abierto";
}

/** Pilares + ABoCR único por L+R + estilo texto (nunca id numérico). */
export async function enrichCsvPilaresCanonical(
  pool: Pool,
  ppId: number,
  rows: CsvCarlosRow[],
): Promise<CsvCarlosRow[]> {
  if (!rows.length) return rows;
  const mapaLr = await loadMapaPilarLrPp(pool, ppId);

  const byLr = new Map<string, CsvCarlosRow[]>();
  for (const r of rows) {
    const k = lrKeyCsv(r.linea, r.referencia);
    if (!byLr.has(k)) byLr.set(k, []);
    byLr.get(k)!.push(r);
  }

  const abocrCanon = new Map<string, string>();
  for (const [k, grupo] of byLr) {
    const pilar = mapaLr.get(k);
    const tipo1 = pilar?.tipo_1 ?? grupo.find((g) => (g.tipo_1_pilar ?? "").trim())?.tipo_1_pilar ?? null;
    abocrCanon.set(
      k,
      tipo1 ? resolveCsvAbocr(tipo1, null) : abocrModaGrades(grupo),
    );
  }

  return rows.map((r) => {
    const k = lrKeyCsv(r.linea, r.referencia);
    const pilar = mapaLr.get(k);
    const estilo = resolverEstiloListadoMotor(pilar?.estilo_lr ?? "", pilar?.estilo_linea ?? "");
    return {
      ...r,
      tipo_1_pilar: pilar?.tipo_1 ?? r.tipo_1_pilar ?? null,
      estilo: estilo || r.estilo || null,
      abocr: abocrCanon.get(k) ?? resolveCsvAbocr(r.tipo_1_pilar, r.grades_json),
    };
  });
}

/** Vendedor Carlos — matriz Hoja2 (nombre + caso). */
export function resolveCsvVendedorCarlos(
  vendedorNombre: string | null | undefined,
  caso: string | null | undefined,
  override?: string | null,
): string {
  return resolveVendedorCarlosParaCsv({
    vendedor_nombre: vendedorNombre,
    caso,
    override,
  });
}

export async function enrichCsvFilasCompletas(
  pool: Pool,
  ppId: number,
  rows: CsvCarlosRow[],
): Promise<CsvCarlosRow[]> {
  const conCaso = await enrichCsvCasoBiblioteca(pool, ppId, rows);
  return enrichCsvPilaresCanonical(pool, ppId, conCaso);
}

function fmtDesc(n: string | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.0";
  return Number.isInteger(v) ? `${v}.0` : String(v);
}

function csvCarlosBaseName(numeroProforma: string | null | undefined, numeroRegistro: string): string {
  const raw = (numeroProforma ?? "").trim();
  if (raw) {
    const slash = raw.match(/(\d{3,5})\s*\/\s*(\d{4})/);
    if (slash) return `${slash[1]}-${slash[2].slice(-2)}`;
    const dash = raw.match(/(\d{3,5})[-_](\d{4})/);
    if (dash) return `${dash[1]}-${dash[2].slice(-2)}`;
  }
  return numeroRegistro.replace(/[^\w.-]+/g, "_");
}

export function csvCarlosFilename(
  numeroProforma: string | null | undefined,
  numeroRegistro: string,
): string {
  return `${csvCarlosBaseName(numeroProforma, numeroRegistro)}.csv`;
}

/** Cantidades iniciales (PPD · cantidad_pares) — mismo formato Carlos, sufijo `_inicial`. */
export function csvCarlosInicialFilename(
  numeroProforma: string | null | undefined,
  numeroRegistro: string,
): string {
  return `${csvCarlosBaseName(numeroProforma, numeroRegistro)}_inicial.csv`;
}

export async function fetchCsvCarlosRows(
  pool: Pool,
  ppId: number,
  programado: boolean,
): Promise<CsvCarlosRow[]> {
  const estados = programado ? ["RESERVADA", "CONFIRMADA"] : ["CONFIRMADA"];
  if (!programado) {
    const { rows } = await pool.query<CsvCarlosRow>(
      `
    SELECT
      fi.id::text AS fi_id,
      fi.cliente_id::text AS cliente_id,
      ic.ic_nro,
      COALESCE(fi.plazo_id, ic.id_plazo)::text AS plazo_id,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      mv.descp_marca AS marca,
      ppd.material_code,
      ppd.descp_material,
      ppd.color_code,
      ppd.descp_color,
      ppd.grades_json,
      pe_evt.evento_nombre AS biblioteca,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo,
      NULLIF(TRIM(t1.descp_tipo_1), '') AS tipo_1_pilar,
      fid.pares::text AS pares,
      COALESCE(
        NULLIF(TRIM(pl_fi.descp_plazo), ''),
        NULLIF(TRIM(pl_ic.descp_plazo), ''),
        'N/A'
      ) AS plazo,
      fi.lista_precio_id::text AS lista_precio_id,
      COALESCE(fi.descuento_1, ic.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, ic.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, ic.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, ic.descuento_4, 0)::text AS descuento_4,
      fi.vendedor_id::text AS vendedor_nexus_id,
      ${VENDEDOR_NOMBRE_SQL}
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN plazo_v2 pl_fi ON pl_fi.id_plazo = fi.plazo_id
    LEFT JOIN LATERAL (
      SELECT ic.id_plazo, ic.numero_registro AS ic_nro, ic.id_vendedor,
             ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND ic.id_cliente = fi.cliente_id
      ORDER BY ic.id
      LIMIT 1
    ) ic ON TRUE
    ${VENDEDOR_JOINS_SQL}
    LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.codigo_proveedor::text = ppd.referencia
     AND ref.linea_id = l.id
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = ref.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN LATERAL (
      SELECT icp.precio_evento_id
      FROM intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.id
      LIMIT 1
    ) icp ON TRUE
    LEFT JOIN LATERAL (
      SELECT pe.nombre_evento AS evento_nombre
      FROM precio_evento pe
      WHERE pe.id = icp.precio_evento_id
      LIMIT 1
    ) pe_evt ON TRUE
    WHERE fi.pp_id = $1
      AND fi.estado = ANY($2::text[])
    ORDER BY fi.id, fid.id
    `,
      [ppId, estados],
    );
    return enrichCsvFilasCompletas(pool, ppId, rows);
  }

  const { rows } = await pool.query<CsvCarlosRow>(
    `
    SELECT
      fi.id::text AS fi_id,
      fi.cliente_id::text AS cliente_id,
      COALESCE(NULLIF(TRIM(ic.numero_registro), ''), NULLIF(TRIM(fi.notas), '')) AS ic_nro,
      COALESCE(fi.plazo_id, ic.id_plazo)::text AS plazo_id,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      mv.descp_marca AS marca,
      ppd.material_code,
      ppd.descp_material,
      ppd.color_code,
      ppd.descp_color,
      ppd.grades_json,
      pe_evt.evento_nombre AS biblioteca,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo,
      NULLIF(TRIM(t1.descp_tipo_1), '') AS tipo_1_pilar,
      fid.pares::text AS pares,
      COALESCE(
        NULLIF(TRIM(pl_fi.descp_plazo), ''),
        NULLIF(TRIM(pl_ic.descp_plazo), ''),
        'N/A'
      ) AS plazo,
      fi.lista_precio_id::text AS lista_precio_id,
      COALESCE(fi.descuento_1, ic.descuento_1, 0)::text AS descuento_1,
      COALESCE(fi.descuento_2, ic.descuento_2, 0)::text AS descuento_2,
      COALESCE(fi.descuento_3, ic.descuento_3, 0)::text AS descuento_3,
      COALESCE(fi.descuento_4, ic.descuento_4, 0)::text AS descuento_4,
      fi.vendedor_id::text AS vendedor_nexus_id,
      ${VENDEDOR_NOMBRE_SQL}
    FROM factura_interna fi
    LEFT JOIN intencion_compra ic
      ON ic.numero_registro = TRIM(fi.notas)
     AND EXISTS (
       SELECT 1 FROM intencion_compra_pedido icp
       WHERE icp.intencion_compra_id = ic.id AND icp.pedido_proveedor_id = fi.pp_id
     )
    ${VENDEDOR_JOINS_SQL}
    LEFT JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    LEFT JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN plazo_v2 pl_fi ON pl_fi.id_plazo = fi.plazo_id
    LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.codigo_proveedor::text = ppd.referencia
     AND ref.linea_id = l.id
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = ref.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN LATERAL (
      SELECT icp.precio_evento_id
      FROM intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.id
      LIMIT 1
    ) icp ON TRUE
    LEFT JOIN LATERAL (
      SELECT pe.nombre_evento AS evento_nombre
      FROM precio_evento pe
      WHERE pe.id = icp.precio_evento_id
      LIMIT 1
    ) pe_evt ON TRUE
    WHERE fi.pp_id = $1
      AND fi.estado = ANY($2::text[])
    ORDER BY fi.id, fid.id NULLS FIRST
    `,
    [ppId, estados],
  );
  return enrichCsvFilasCompletas(pool, ppId, rows);
}

export function buildCsvCarlosContent(rows: CsvCarlosRow[]): string {
  const lines: string[] = [HEADER_FILA];
  let prevBlock = "";

  for (const r of rows) {
    // Carlos: cada bloque SHOP = 1 factura. 1 FI Nexus = 1 bloque (IC = FI = factura Carlos).
    const blockKey = r.fi_id ?? "";
    const shop = blockKey !== prevBlock ? (r.cliente_id ?? "") : "";
    const icNro = blockKey !== prevBlock ? (r.ic_nro ?? "") : "";
    prevBlock = blockKey;

    const style =
      r.linea && r.referencia ? `'${r.linea}.${r.referencia}` : r.linea ? `'${r.linea}` : "";

    lines.push(
      buildCsvLine([
        shop,
        icNro,
        style,
        r.marca ?? "",
        r.material_code ?? "",
        r.descp_material ?? "",
        r.color_code ?? "",
        r.descp_color ?? "",
        gradaFromJson(r.grades_json),
        cellCaso(r.caso),
        cellListadoPrecios(r.biblioteca),
        r.estilo ?? "",
        r.abocr ?? resolveCsvAbocr(r.tipo_1_pilar, r.grades_json),
        r.pares ?? "0",
        r.plazo ?? "N/A",
        listaPrecioLabel(r.lista_precio_id != null ? Number(r.lista_precio_id) : 1),
        fmtDesc(r.descuento_1),
        fmtDesc(r.descuento_2),
        fmtDesc(r.descuento_3),
        fmtDesc(r.descuento_4),
        r.vendedor_carlos != null && r.vendedor_carlos !== ""
          ? r.vendedor_carlos
          : resolveCsvVendedorCarlos(r.vendedor_nombre, r.caso, r.vendedor_carlos),
        COBRADOR,
      ]),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function exportCsvVentasPp(
  pool: Pool,
  ppId: number,
  opts: {
    numeroRegistro: string;
    numeroProforma: string | null;
    categoriaId: number | null;
  },
): Promise<{ content: string; filename: string; rowCount: number }> {
  const programado = opts.categoriaId === 3;
  const rows = await fetchCsvCarlosRows(pool, ppId, programado);
  return {
    content: buildCsvCarlosContent(rows),
    filename: csvCarlosFilename(opts.numeroProforma, opts.numeroRegistro),
    rowCount: rows.length,
  };
}

export async function fetchCsvCarlosRowsInicial(
  pool: Pool,
  ppId: number,
  programado: boolean,
): Promise<CsvCarlosRow[]> {
  const { rows } = await pool.query<CsvCarlosRow>(
    `
    SELECT
      CASE
        WHEN $2::boolean THEN COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '0')
        ELSE '0'
      END AS fi_id,
      CASE
        WHEN $2::boolean THEN COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '')
        ELSE ''
      END AS cliente_id,
      ic.ic_nro,
      COALESCE(ic.id_plazo, ic0.id_plazo)::text AS plazo_id,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      mv.descp_marca AS marca,
      ppd.material_code,
      ppd.descp_material,
      ppd.color_code,
      ppd.descp_color,
      ppd.grades_json,
      pe_evt.evento_nombre AS biblioteca,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo,
      NULLIF(TRIM(t1.descp_tipo_1), '') AS tipo_1_pilar,
      ppd.cantidad_pares::text AS pares,
      COALESCE(
        NULLIF(TRIM(pl_ic.descp_plazo), ''),
        NULLIF(TRIM(pl_ic0.descp_plazo), ''),
        'N/A'
      ) AS plazo,
      COALESCE(ic.listado_precio_id, ic0.listado_precio_id, 1)::text AS lista_precio_id,
      COALESCE(ic.descuento_1, ic0.descuento_1, 0)::text AS descuento_1,
      COALESCE(ic.descuento_2, ic0.descuento_2, 0)::text AS descuento_2,
      COALESCE(ic.descuento_3, ic0.descuento_3, 0)::text AS descuento_3,
      COALESCE(ic.descuento_4, ic0.descuento_4, 0)::text AS descuento_4
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN LATERAL (
      SELECT ic.numero_registro AS ic_nro, ic.id_plazo, ic.listado_precio_id,
             ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id
        AND (
          NOT $2::boolean
          OR ic.id_cliente::text = COALESCE(NULLIF(TRIM(ppd.grades_json->>'_shop'), ''), '')
        )
      ORDER BY ic.id
      LIMIT 1
    ) ic ON TRUE
    LEFT JOIN LATERAL (
      SELECT ic.id_plazo, ic.listado_precio_id, ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = pp.id
      ORDER BY ic.id
      LIMIT 1
    ) ic0 ON TRUE
    LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
    LEFT JOIN plazo_v2 pl_ic0 ON pl_ic0.id_plazo = ic0.id_plazo
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.codigo_proveedor::text = ppd.referencia
     AND ref.linea_id = l.id
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = ref.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
    LEFT JOIN tipo_1 t1 ON t1.id_tipo_1 = lr.tipo_1_id
    LEFT JOIN LATERAL (
      SELECT icp.precio_evento_id
      FROM intencion_compra_pedido icp
      WHERE icp.pedido_proveedor_id = pp.id
        AND icp.precio_evento_id IS NOT NULL
      ORDER BY icp.id
      LIMIT 1
    ) icp ON TRUE
    LEFT JOIN LATERAL (
      SELECT pe.nombre_evento AS evento_nombre
      FROM precio_evento pe
      WHERE pe.id = icp.precio_evento_id
      LIMIT 1
    ) pe_evt ON TRUE
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.linea IS NOT NULL
      AND COALESCE(ppd.cantidad_pares, 0) > 0
    ORDER BY fi_id, ppd.id
    `,
    [ppId, programado],
  );
  return enrichCsvFilasCompletas(pool, ppId, rows);
}

export async function exportCsvInicialPp(
  pool: Pool,
  ppId: number,
  opts: {
    numeroRegistro: string;
    numeroProforma: string | null;
    categoriaId: number | null;
  },
): Promise<{ content: string; filename: string; rowCount: number }> {
  const programado = opts.categoriaId === 3;
  const rows = await fetchCsvCarlosRowsInicial(pool, ppId, programado);
  return {
    content: buildCsvCarlosContent(rows),
    filename: csvCarlosInicialFilename(opts.numeroProforma, opts.numeroRegistro),
    rowCount: rows.length,
  };
}
