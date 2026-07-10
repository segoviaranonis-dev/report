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
  carlosVendedorIdFrancis,
  loadFrancisTranslator,
  type FrancisTranslator,
} from "./csv-vendedor-francis";

/** Header único — sin fila instructiva (formato final Director). */
const HEADER_FILA =
  "SHOP;'STYL.E;BRAND;MATERIAL CODE;MATERIAL;COLOR CODE;COLOR;GRADA;CASO;ESTILO;ABoCR;CANT PARES;PLAZO;LISTA;Desc1;Desc2;Desc3;Desc4;Vendedor;Cobrador";

const COBRADOR = "90";

/** Matriz caja cerrada importadora — 12 pares. */
const MATRIZ_CERRADA = [1, 2, 3, 3, 2, 1];

type CsvCarlosRow = {
  fi_id: string;
  cliente_id: string | null;
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
  pares: string | null;
  plazo: string | null;
  lista_precio_id: string | null;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  /** PE / override — id numérico Carlos; si null → matriz Francis por caso */
  vendedor_carlos?: string | null;
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

/** Col K · caja cerrada canónica 1-2-3-3-2-1 → cerrado; resto → abierto. */
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

function formatoCaso(caso: string | null, biblioteca: string | null): string {
  const c = (caso ?? "").trim();
  const b = (biblioteca ?? "").trim();
  if (c && b) return `${c} - ${b}`;
  return c || b || "";
}

function fmtDesc(n: string | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.0";
  return Number.isInteger(v) ? `${v}.0` : String(v);
}

export function csvCarlosFilename(
  numeroProforma: string | null | undefined,
  numeroRegistro: string,
): string {
  const raw = (numeroProforma ?? "").trim();
  if (raw) {
    const slash = raw.match(/(\d{3,5})\s*\/\s*(\d{4})/);
    if (slash) return `${slash[1]}-${slash[2].slice(-2)}.csv`;
    const dash = raw.match(/(\d{3,5})[-_](\d{4})/);
    if (dash) return `${dash[1]}-${dash[2].slice(-2)}.csv`;
  }
  return `${numeroRegistro.replace(/[^\w.-]+/g, "_")}.csv`;
}

export async function fetchCsvCarlosRows(
  pool: Pool,
  ppId: number,
  programado: boolean,
): Promise<CsvCarlosRow[]> {
  const estados = programado ? ["RESERVADA", "CONFIRMADA"] : ["CONFIRMADA"];
  const { rows } = await pool.query<CsvCarlosRow>(
    `
    SELECT
      fi.id::text AS fi_id,
      fi.cliente_id::text AS cliente_id,
      COALESCE(fi.plazo_id, ic.id_plazo)::text AS plazo_id,
      TRIM(ppd.linea) AS linea,
      TRIM(ppd.referencia) AS referencia,
      mv.descp_marca AS marca,
      ppd.material_code,
      ppd.descp_material,
      ppd.color_code,
      ppd.descp_color,
      ppd.grades_json,
      pl.nombre_caso_aplicado AS caso,
      pe_evt.evento_nombre AS biblioteca,
      COALESCE(NULLIF(TRIM(ge.descp_grupo_estilo), ''), lr.grupo_estilo_id::text) AS estilo,
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
      COALESCE(fi.descuento_4, ic.descuento_4, 0)::text AS descuento_4
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    JOIN pedido_proveedor pp ON pp.id = fi.pp_id
    JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN plazo_v2 pl_fi ON pl_fi.id_plazo = fi.plazo_id
    LEFT JOIN LATERAL (
      SELECT ic.id_plazo, ic.descuento_1, ic.descuento_2, ic.descuento_3, ic.descuento_4
      FROM intencion_compra_pedido icp
      JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
      WHERE icp.pedido_proveedor_id = fi.pp_id
        AND ic.id_cliente = fi.cliente_id
      LIMIT 1
    ) ic ON TRUE
    LEFT JOIN plazo_v2 pl_ic ON pl_ic.id_plazo = ic.id_plazo
    LEFT JOIN material m
      ON m.proveedor_id = pp.proveedor_importacion_id
     AND m.codigo_proveedor::text = ppd.material_code
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = ppd.linea
    LEFT JOIN referencia ref
      ON ref.codigo_proveedor::text = ppd.referencia
     AND ref.linea_id = l.id
    LEFT JOIN linea_referencia lr
      ON lr.linea_id = l.id AND lr.referencia_id = ref.id
    LEFT JOIN grupo_estilo_v2 ge ON ge.id_grupo_estilo = lr.grupo_estilo_id
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
    LEFT JOIN precio_lista pl
      ON pl.evento_id = icp.precio_evento_id
     AND pl.linea_id = l.id
     AND pl.referencia_id = ref.id
     AND pl.material_id = m.id
    WHERE fi.pp_id = $1
      AND fi.estado = ANY($2::text[])
    ORDER BY fi.id, fid.id
    `,
    [ppId, estados],
  );
  return rows;
}

export function buildCsvCarlosContent(
  rows: CsvCarlosRow[],
  translator: FrancisTranslator = loadFrancisTranslator(),
): string {
  const lines: string[] = [HEADER_FILA];
  let prevBlock = "";

  for (const r of rows) {
    // Carlos: cada bloque SHOP = 1 factura. 1 FI Nexus = 1 bloque (IC = FI = factura Carlos).
    const blockKey = r.fi_id ?? "";
    const shop = blockKey !== prevBlock ? (r.cliente_id ?? "") : "";
    prevBlock = blockKey;

    const style =
      r.linea && r.referencia ? `'${r.linea}.${r.referencia}` : r.linea ? `'${r.linea}` : "";

    lines.push(
      buildCsvLine([
        shop,
        style,
        r.marca ?? "",
        r.material_code ?? "",
        r.descp_material ?? "",
        r.color_code ?? "",
        r.descp_color ?? "",
        gradaFromJson(r.grades_json),
        formatoCaso(r.caso, r.biblioteca),
        r.estilo ?? "",
        gradaAbiertoCerrado(r.grades_json),
        r.pares ?? "0",
        r.plazo ?? "N/A",
        listaPrecioLabel(r.lista_precio_id != null ? Number(r.lista_precio_id) : 1),
        fmtDesc(r.descuento_1),
        fmtDesc(r.descuento_2),
        fmtDesc(r.descuento_3),
        fmtDesc(r.descuento_4),
        r.vendedor_carlos != null && r.vendedor_carlos !== ""
          ? r.vendedor_carlos
          : carlosVendedorIdFrancis(r.caso, translator),
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
  const translator = loadFrancisTranslator();
  const rows = await fetchCsvCarlosRows(pool, ppId, programado);
  return {
    content: buildCsvCarlosContent(rows, translator),
    filename: csvCarlosFilename(opts.numeroProforma, opts.numeroRegistro),
    rowCount: rows.length,
  };
}
