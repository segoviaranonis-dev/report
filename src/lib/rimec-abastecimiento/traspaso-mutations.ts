/**
 * Traspaso + combinacion — gemelo compra_legal/logic.py + facturacion/logic.py
 */
import type { PoolClient } from "pg";
import { gradesJsonTallasTraspaso } from "@/lib/pedido-proveedor/grades-json-canonical";
import { ALM_TRANSITO, ALM_WEB_BAZAR } from "./constants";

const RE_GRADA_NUM_638 = /^(\d+)\((\d+)\)(\d+)$/;
const RE_GRADA_LET_638 = /^([A-Za-z]+)\((\d+)\)([A-Za-z]+)$/;

export type ItemTallas = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  tallas: Record<string, number>;
};

function parseJsonRecord(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(raw.replace(/'/g, '"')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * Normaliza clave talla: "t38" | "38" | "38.0" → 38
 * Rango **14–55**: calzado adulto + infantil (Molekinho/Molekinha 19–26, etc.).
 * Antes 20–55 descartaba gradas `19(…)23` → TRP corto vs FI (4.05.03.001).
 */
export function tallaKeyToNum(tallaStr: string): number | null {
  const head = String(tallaStr ?? "")
    .trim()
    .replace(/^t/i, "")
    .split("/")[0]
    ?.replace(/[^\d.]/g, "");
  const n = Number(head);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 14 || i > 55) return null;
  return i;
}

/**
 * Escala grades_json a fid.pares (caja RIMEC 8 o 12).
 * - Acepta claves `t38` o `38`
 * - Reparte con método del mayor resto (no tira pares a la última talla)
 * - Si pares no es múltiplo de la caja (suma grada), escala igual pero deja curva coherente
 */
export function scaleGradesToPares(grades: Record<string, number>, pares: number): Record<string, number> {
  const normalized: Record<number, number> = {};
  for (const [tallaStr, qty] of Object.entries(grades)) {
    const tallaNum = tallaKeyToNum(tallaStr);
    if (tallaNum == null) continue;
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) continue;
    normalized[tallaNum] = (normalized[tallaNum] ?? 0) + q;
  }
  const entries = Object.entries(normalized)
    .map(([t, q]) => [Number(t), Number(q)] as const)
    .sort((a, b) => a[0] - b[0]);
  const suma = entries.reduce((a, [, q]) => a + q, 0);
  if (suma <= 0 || pares <= 0) return {};

  if (suma === pares) {
    const tallas: Record<string, number> = {};
    for (const [t, q] of entries) tallas[`t${t}`] = q;
    return tallas;
  }

  const factor = pares / suma;
  const raw = entries.map(([t, q]) => {
    const exact = q * factor;
    const base = Math.floor(exact);
    return { t, base, frac: exact - base };
  });
  let assigned = raw.reduce((a, r) => a + r.base, 0);
  let remain = pares - assigned;
  raw.sort((a, b) => b.frac - a.frac || a.t - b.t);
  for (const r of raw) {
    if (remain <= 0) break;
    r.base += 1;
    remain -= 1;
  }
  raw.sort((a, b) => a.t - b.t);

  const tallas: Record<string, number> = {};
  for (const r of raw) {
    if (r.base > 0) tallas[`t${r.t}`] = r.base;
  }
  return tallas;
}

/** Parsea grada textual RIMEC calzado (ej. `38(1 2 3 3 2 1)43`). */
export function gradasFmtToTallas(gradasFmt: string): Record<string, number> {
  if (!gradasFmt.includes("(") || !gradasFmt.includes(")")) return {};
  try {
    const [inicioStr, resto] = gradasFmt.split("(", 2);
    const [cantidadesStr] = resto.split(")", 1);
    const tallaInicio = tallaKeyToNum(inicioStr.trim());
    if (tallaInicio == null) return {};
    const cantidades = cantidadesStr
      .split(/[\s\-]+/)
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    const tallas: Record<string, number> = {};
    cantidades.forEach((qty, idx) => {
      const tallaNum = tallaInicio + idx;
      if (tallaKeyToNum(String(tallaNum)) != null && qty > 0) tallas[`t${tallaNum}`] = qty;
    });
    return tallas;
  } catch {
    return {};
  }
}

/**
 * Grada abierta 638 Carlos: `1(1)1` · `P(1)M` · `4/6/8` · `10`.
 * 1 fila = 1 talle = N prendas (pares de FI).
 */
export function gradaAbierta638ToTallas(gradasFmt: string, pares = 1): Record<string, number> {
  const s = String(gradasFmt ?? "").trim();
  if (!s) return {};
  const qty = Math.max(1, Math.trunc(Number(pares) || 1));
  let m = s.match(RE_GRADA_NUM_638);
  if (m) {
    const start = Number(m[1]);
    const end = Number(m[3]);
    // `23(12)27` / `28(12)33` = curva calzado (un qty), NO grada abierta 638 `1(1)1`.
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start !== end &&
      (start >= 14 || end >= 14)
    ) {
      return {};
    }
    return { [m[1]]: qty };
  }
  m = s.match(RE_GRADA_LET_638);
  if (m) return { [m[1].toUpperCase()]: qty };
  if (/^[A-Za-z]{1,3}$/.test(s)) return { [s.toUpperCase()]: qty };
  if (/^\d{1,2}(\/\d{1,2})+$/.test(s)) return { [s]: qty };
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    if (n >= 1 && n <= 16) return { [s]: qty };
  }
  return {};
}

/** Escala abierta 638 (no curva zapato): 1 clave → pares FI. */
export function scaleGradesAbierta638(
  grades: Record<string, number>,
  pares: number,
): Record<string, number> {
  const entries = Object.entries(grades)
    .map(([k, q]) => [String(k).replace(/^t/i, ""), Number(q)] as const)
    .filter(([, q]) => Number.isFinite(q) && q > 0);
  if (!entries.length || pares <= 0) return {};
  if (entries.length === 1) return { [entries[0][0]]: pares };
  const suma = entries.reduce((a, [, q]) => a + q, 0);
  if (suma <= 0) return {};
  if (suma === pares) {
    const out: Record<string, number> = {};
    for (const [k, q] of entries) out[k] = q;
    return out;
  }
  const factor = pares / suma;
  const out: Record<string, number> = {};
  let assigned = 0;
  const ranked = entries.map(([k, q]) => {
    const exact = q * factor;
    const base = Math.floor(exact);
    assigned += base;
    return { k, base, frac: exact - base };
  });
  let remain = pares - assigned;
  ranked.sort((a, b) => b.frac - a.frac || a.k.localeCompare(b.k));
  for (const r of ranked) {
    if (remain <= 0) break;
    r.base += 1;
    remain -= 1;
  }
  for (const r of ranked) {
    if (r.base > 0) out[r.k] = r.base;
  }
  return out;
}

/** Material/color desde URL canónica productos: `{linea}-{ref}-{mat}-{color}.jpg` */
export function materialColorFromImagenUrl(url: string | null | undefined): {
  material: string;
  color: string;
} {
  const s = String(url ?? "");
  const m = s.match(/\/productos\/([^/?#]+)\.(?:jpe?g|png|webp)/i);
  if (!m) return { material: "", color: "" };
  const stem = decodeURIComponent(m[1]);
  const parts = stem.split("-");
  if (parts.length < 4) return { material: "", color: "" };
  // linea-ref-mat-color… (color puede traer más segmentos)
  return {
    material: parts[2] ?? "",
    color: parts.slice(3).join("-"),
  };
}

function snapStr(snap: Record<string, unknown> | null, ...keys: string[]): string {
  if (!snap) return "";
  for (const k of keys) {
    const v = snap[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

/** Arma ItemTallas desde FID (+ PPD opcional / snapshot / URL imagen). */
export function itemTallasFromFiDetalle(row: {
  linea?: unknown;
  referencia?: unknown;
  descp_material?: unknown;
  descp_color?: unknown;
  grades_json?: unknown;
  linea_snapshot?: unknown;
  pares: number;
}): ItemTallas | null {
  const snap = parseJsonRecord(row.linea_snapshot);
  const fromImg = materialColorFromImagenUrl(snapStr(snap, "imagen_url", "imagen"));
  const linea =
    String(row.linea ?? "").trim() ||
    snapStr(snap, "linea_codigo", "linea", "codigo_linea");
  const referencia =
    String(row.referencia ?? "").trim() ||
    snapStr(snap, "ref_codigo", "referencia", "codigo_referencia");
  const material =
    String(row.descp_material ?? "").trim() ||
    snapStr(snap, "material_nombre", "material_codigo", "descp_material", "material") ||
    fromImg.material;
  const color =
    String(row.descp_color ?? "").trim() ||
    snapStr(snap, "color_nombre", "color_codigo", "descp_color", "color") ||
    fromImg.color;
  const tallas = extractTallasFromFiRow({
    grades_json: row.grades_json ?? null,
    linea_snapshot: row.linea_snapshot,
    pares: Number(row.pares) || 0,
  });
  if (!linea || !referencia || !Object.keys(tallas).length) return null;
  return { linea, referencia, material, color, tallas };
}

export function extractTallasFromFiRow(row: {
  grades_json: unknown;
  linea_snapshot: unknown;
  pares: number;
}): Record<string, number> {
  let tallas: Record<string, number> = {};
  const grades = gradesJsonTallasTraspaso(row.grades_json);
  if (Object.keys(grades).length && row.pares > 0) {
    const shoeKeys = Object.keys(grades).filter((k) => tallaKeyToNum(k) != null);
    tallas =
      shoeKeys.length === Object.keys(grades).length
        ? scaleGradesToPares(grades, row.pares)
        : scaleGradesAbierta638(grades, row.pares);
  }
  if (!Object.keys(tallas).length && row.linea_snapshot) {
    const snap = parseJsonRecord(row.linea_snapshot);
    const fmt = snap
      ? String(snap.gradas_fmt ?? snap.grada ?? snap.am_talle ?? snap.talle ?? "")
      : "";
    if (fmt) {
      const abierta = gradaAbierta638ToTallas(fmt, row.pares);
      if (Object.keys(abierta).length) {
        tallas = abierta;
      } else {
        const raw = gradasFmtToTallas(fmt);
        tallas =
          row.pares > 0 && Object.keys(raw).length
            ? scaleGradesToPares(raw, row.pares)
            : raw;
      }
    }
    if (!Object.keys(tallas).length && snap?.tallas && typeof snap.tallas === "object") {
      const raw = gradesJsonTallasTraspaso(snap.tallas);
      const shoeKeys = Object.keys(raw).filter((k) => tallaKeyToNum(k) != null);
      tallas =
        shoeKeys.length === Object.keys(raw).length && Object.keys(raw).length
          ? scaleGradesToPares(raw, row.pares)
          : scaleGradesAbierta638(raw, row.pares);
    }
  }
  // Prohibido volcar todo a t37: rompe la grada (caja 8/12).
  return tallas;
}

export async function getNextTraspasoNum(client: PoolClient, anio: number): Promise<string> {
  const { rows } = await client.query<{ mx: string | null }>(
    `
    SELECT MAX(CAST(SPLIT_PART(numero_registro, '-', 3) AS INTEGER))::text AS mx
    FROM traspaso
    WHERE numero_registro LIKE $1
    `,
    [`TRP-${anio}-%`],
  );
  const ultimo = parseInt(rows[0]?.mx ?? "0", 10) || 0;
  return `TRP-${anio}-${String(ultimo + 1).padStart(4, "0")}`;
}

/** Quita prefijo K de códigos Kyly (`K1000059` → `1000059`, `K70170` → `70170`). */
function stripPrefijoK(cod: string): string {
  const s = String(cod ?? "").trim();
  if (/^K\d+/i.test(s)) return s.slice(1);
  return s;
}

function sistemaTalla638(etiqueta: string): "NUMERICO" | "FRACCIONARIO" | "TEXTUAL" {
  const e = etiqueta.trim();
  if (e.includes("/")) return "FRACCIONARIO";
  if (/^\d{1,2}$/.test(e)) return "NUMERICO";
  return "TEXTUAL";
}

/** Asegura fila en `talla` (UNIQUE talla_etiqueta). Grada abierta 638: 1·P·M·4/6/8… */
export async function ensureTallaId(client: PoolClient, talla: string): Promise<number | null> {
  const etiq = String(talla ?? "").trim();
  if (!etiq) return null;
  const found = await client.query<{ id: number }>(
    `SELECT id FROM talla WHERE talla_etiqueta = $1 LIMIT 1`,
    [etiq],
  );
  if (found.rows[0]?.id != null) return Number(found.rows[0].id);

  const sistema = sistemaTalla638(etiq);
  // talla_valor es numeric: solo dígitos; P/M/G y 4/6/8 → NULL
  const tallaValor = /^\d{1,2}$/.test(etiq) ? Number(etiq) : null;
  await client.query("SAVEPOINT sp_ensure_talla");
  try {
    const ins = await client.query<{ id: number }>(
      `
      INSERT INTO talla (talla_valor, talla_etiqueta, sistema, activo)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (talla_etiqueta) DO UPDATE SET talla_etiqueta = EXCLUDED.talla_etiqueta
      RETURNING id
      `,
      [tallaValor, etiq, sistema],
    );
    await client.query("RELEASE SAVEPOINT sp_ensure_talla");
    return ins.rows[0]?.id != null ? Number(ins.rows[0].id) : null;
  } catch {
    await client.query("ROLLBACK TO SAVEPOINT sp_ensure_talla");
    const again = await client.query<{ id: number }>(
      `SELECT id FROM talla WHERE talla_etiqueta = $1 LIMIT 1`,
      [etiq],
    );
    return again.rows[0]?.id != null ? Number(again.rows[0].id) : null;
  }
}

export async function resolveCombinacionId(
  client: PoolClient,
  linea: string,
  ref: string,
  mat: string,
  col: string,
  talla: string,
): Promise<number | null> {
  const lineaCod = String(linea).trim();
  const refCod = String(ref).trim();
  const tallaCod = String(talla).trim();
  const matCod = String(mat).trim();
  const colCod = String(col).trim();
  const matBare = stripPrefijoK(matCod);
  const colBare = stripPrefijoK(colCod);

  const tallaId = await ensureTallaId(client, tallaCod);
  if (tallaId == null) return null;

  // Material: descripción · código exacto · código sin K · K||codigo (NO K||linea suelto — false positive).
  const matMatch = (pMat: string, pBare: string) => `
    (
      NULLIF(btrim(mat.descripcion), '') = ${pMat}
      OR mat.codigo_proveedor::text = ${pMat}
      OR mat.codigo_proveedor::text = ${pBare}
      OR ('K' || mat.codigo_proveedor::text) = ${pMat}
      OR (mat.codigo_proveedor::text = l.codigo_proveedor::text AND ('K' || l.codigo_proveedor::text) = ${pMat})
    )
  `;
  const colMatch = (pCol: string, pBare: string) => `
    (
      col.nombre = ${pCol}
      OR col.codigo_proveedor::text = ${pCol}
      OR col.codigo_proveedor::text = ${pBare}
      OR ('K' || col.codigo_proveedor::text) = ${pCol}
    )
  `;

  const found = await client.query<{ id: number }>(
    `
    SELECT c.id
    FROM combinacion c
    JOIN linea l ON l.id = c.linea_id AND l.codigo_proveedor::text = $1
    JOIN referencia r ON r.id = c.referencia_id AND r.codigo_proveedor::text = $2 AND r.linea_id = l.id
    JOIN talla tl ON tl.id = c.talla_id AND tl.id = $3
    JOIN material mat ON mat.id = c.material_id AND ${matMatch("$4", "$6")}
    JOIN color col ON col.id = c.color_id AND ${colMatch("$5", "$7")}
    LIMIT 1
    `,
    [lineaCod, refCod, tallaId, matCod, colCod, matBare, colBare],
  );
  if (found.rows[0]?.id) return found.rows[0].id;

  const ids = await client.query<{ linea_id: number; ref_id: number; mat_id: number; col_id: number }>(
    `
    SELECT l.id AS linea_id, r.id AS ref_id, mat.id AS mat_id, col.id AS col_id
    FROM linea l
    JOIN referencia r ON r.linea_id = l.id AND r.codigo_proveedor::text = $2
    JOIN material mat ON mat.proveedor_id = l.proveedor_id AND ${matMatch("$3", "$5")}
    JOIN color col ON col.proveedor_id = l.proveedor_id AND ${colMatch("$4", "$6")}
    WHERE l.codigo_proveedor::text = $1
    LIMIT 1
    `,
    [lineaCod, refCod, matCod, colCod, matBare, colBare],
  );
  if (!ids.rows.length) return null;

  const { linea_id, ref_id, mat_id, col_id } = ids.rows[0];
  const ins = await client.query<{ id: number }>(
    `
    INSERT INTO combinacion (linea_id, referencia_id, material_id, color_id, talla_id, activo_web)
    VALUES ($1, $2, $3, $4, $5, false)
    RETURNING id
    `,
    [linea_id, ref_id, mat_id, col_id, tallaId],
  );
  return ins.rows[0]?.id ?? null;
}

export async function crearTraspasoPorFactura(
  client: PoolClient,
  idPp: number,
  idMarca: number,
  numeroFactura: string,
  itemsTallas: ItemTallas[],
): Promise<number> {
  const anio = new Date().getFullYear();
  const trpNum = await getNextTraspasoNum(client, anio);
  const snapshot = {
    numero_factura: numeroFactura,
    id_pp: idPp,
    id_marca: idMarca,
    items: itemsTallas,
  };

  const ins = await client.query<{ id: number }>(
    `
    INSERT INTO traspaso (
      numero_registro, anio_fiscal,
      almacen_origen_id, almacen_destino_id,
      estado, snapshot_json, documento_ref
    ) VALUES (
      $1, $2, $3, $4, 'BORRADOR', $5::jsonb, $6
    )
    RETURNING id
    `,
    [trpNum, anio, ALM_TRANSITO, ALM_WEB_BAZAR, JSON.stringify(snapshot), numeroFactura],
  );
  const trpId = ins.rows[0]?.id;
  if (!trpId) throw new Error("No se pudo crear traspaso");

  await insertTraspasoDetalleLines(client, trpId, itemsTallas, numeroFactura);
  return trpId;
}

export async function crearTraspasosParaPp(client: PoolClient, idPp: number, clId: number): Promise<number> {
  let creados = 0;

  const legacy = await client.query<{ numero_factura_interna: string }>(
    `
    SELECT DISTINCT vt.numero_factura_interna
    FROM venta_transito vt
    WHERE vt.pedido_proveedor_id = $1
      AND NOT EXISTS (SELECT 1 FROM traspaso t WHERE t.documento_ref = vt.numero_factura_interna)
    `,
    [idPp],
  );

  for (const { numero_factura_interna: factura } of legacy.rows) {
    const partes = factura.split("-");
    let idMarca = 0;
    try {
      idMarca = parseInt(partes[3] ?? "0", 10) || 0;
    } catch {
      idMarca = 0;
    }

    const rows = await client.query<{
      linea: string;
      referencia: string;
      descp_material: string;
      descp_color: string;
      t33: number; t34: number; t35: number; t36: number;
      t37: number; t38: number; t39: number; t40: number;
    }>(
      `
      SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
             vt.t33, vt.t34, vt.t35, vt.t36, vt.t37, vt.t38, vt.t39, vt.t40
      FROM venta_transito vt
      JOIN pedido_proveedor_detalle ppd ON ppd.id = vt.pedido_proveedor_detalle_id
      WHERE vt.numero_factura_interna = $1 AND vt.pedido_proveedor_id = $2
      `,
      [factura, idPp],
    );

    const items: ItemTallas[] = rows.rows.map((r) => {
      const tallas: Record<string, number> = {};
      for (let t = 33; t <= 40; t++) {
        const key = `t${t}` as keyof typeof r;
        const v = Number(r[key] ?? 0);
        if (v > 0) tallas[`t${t}`] = v;
      }
      return {
        linea: String(r.linea ?? ""),
        referencia: String(r.referencia ?? ""),
        material: String(r.descp_material ?? ""),
        color: String(r.descp_color ?? ""),
        tallas,
      };
    }).filter((i) => Object.keys(i.tallas).length > 0);

    if (!items.length) continue;
    const trpId = await crearTraspasoPorFactura(client, idPp, idMarca, factura, items);
    await client.query(`UPDATE traspaso SET compra_legal_id = $1 WHERE id = $2`, [clId, trpId]);
    creados += 1;
  }

  const nuevas = await client.query<{ fi_id: number; nro_factura: string; id_marca: number }>(
    `
    SELECT fi.id AS fi_id, fi.nro_factura, COALESCE(MIN(ppd.id_marca), 0)::int AS id_marca
    FROM factura_interna fi
    JOIN factura_interna_detalle fid ON fid.factura_id = fi.id
    JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    WHERE fi.pp_id = $1
      AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      AND NOT EXISTS (SELECT 1 FROM traspaso t WHERE t.documento_ref = fi.nro_factura)
    GROUP BY fi.id, fi.nro_factura
    `,
    [idPp],
  );

  for (const { fi_id, nro_factura, id_marca } of nuevas.rows) {
    const det = await client.query<{
      linea: string; referencia: string; descp_material: string; descp_color: string;
      grades_json: unknown; linea_snapshot: unknown; pares: number;
    }>(
      `
      SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
             ppd.grades_json, fid.linea_snapshot, fid.pares
      FROM factura_interna_detalle fid
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fid.factura_id = $1
      `,
      [fi_id],
    );

    const items: ItemTallas[] = [];
    for (const r of det.rows) {
      const tallas = extractTallasFromFiRow(r);
      if (!Object.keys(tallas).length) continue;
      items.push({
        linea: String(r.linea ?? ""),
        referencia: String(r.referencia ?? ""),
        material: String(r.descp_material ?? ""),
        color: String(r.descp_color ?? ""),
        tallas,
      });
    }
    if (!items.length) continue;
    const trpId = await crearTraspasoPorFactura(client, idPp, id_marca, nro_factura, items);
    await client.query(`UPDATE traspaso SET compra_legal_id = $1 WHERE id = $2`, [clId, trpId]);
    creados += 1;
  }

  await client.query(
    `
    UPDATE traspaso SET compra_legal_id = $1
    WHERE compra_legal_id IS NULL
      AND documento_ref IN (
        SELECT fi.nro_factura FROM factura_interna fi WHERE fi.pp_id = $2
        UNION
        SELECT vt.numero_factura_interna FROM venta_transito vt WHERE vt.pedido_proveedor_id = $2
      )
    `,
    [clId, idPp],
  );

  return creados;
}

export type MutationResult = { ok: true; message: string } | { ok: false; error: string };

export async function finalizarCompra(idCl: number): Promise<MutationResult> {
  const { getRimecPool } = await import("@/lib/rimec/pool");
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pps = await client.query<{ pedido_proveedor_id: number }>(
      `SELECT pedido_proveedor_id FROM compra_legal_pedido WHERE compra_legal_id = $1`,
      [idCl],
    );
    let totalNuevos = 0;
    for (const { pedido_proveedor_id } of pps.rows) {
      totalNuevos += await crearTraspasosParaPp(client, pedido_proveedor_id, idCl);
    }
    await client.query(`UPDATE compra_legal SET estado = 'DISTRIBUIDA' WHERE id = $1`, [idCl]);
    await client.query(
      `
      UPDATE pedido_proveedor SET estado_transito = 'EN_DEPOSITO'
      WHERE id IN (SELECT pedido_proveedor_id FROM compra_legal_pedido WHERE compra_legal_id = $1)
      `,
      [idCl],
    );
    await client.query("COMMIT");
    return { ok: true, message: `Compra distribuida. ${totalNuevos} traspaso(s) nuevo(s) creado(s).` };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

export async function rechazarPpDeCompra(idCl: number, idPp: number): Promise<MutationResult> {
  const { getRimecPool } = await import("@/lib/rimec/pool");
  const pool = getRimecPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE traspaso SET compra_legal_id = NULL
      WHERE compra_legal_id = $1 AND estado = 'BORRADOR'
        AND documento_ref IN (
          SELECT fi.nro_factura FROM factura_interna fi WHERE fi.pp_id = $2
          UNION
          SELECT vt.numero_factura_interna FROM venta_transito vt WHERE vt.pedido_proveedor_id = $2
        )
      `,
      [idCl, idPp],
    );
    await client.query(
      `DELETE FROM compra_legal_pedido WHERE compra_legal_id = $1 AND pedido_proveedor_id = $2`,
      [idCl, idPp],
    );
    await client.query(`UPDATE pedido_proveedor SET estado = 'ABIERTO' WHERE id = $1`, [idPp]);
    await client.query("COMMIT");
    return { ok: true, message: "PP rechazado de la compra." };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}

async function insertTraspasoDetalleLines(
  client: PoolClient,
  trpId: number,
  itemsTallas: ItemTallas[],
  numeroFactura: string,
): Promise<number> {
  let paresPedidos = 0;
  let paresInsertados = 0;
  for (const rec of itemsTallas) {
    for (const [col, qtyVal] of Object.entries(rec.tallas ?? {})) {
      const qty = Math.trunc(Number(qtyVal) || 0);
      if (qty <= 0) continue;
      paresPedidos += qty;
      const tNum = tallaKeyToNum(col);
      const t = tNum != null ? String(tNum) : col.replace(/^t/i, "");
      const combId = await resolveCombinacionId(client, rec.linea, rec.referencia, rec.material, rec.color, t);
      if (!combId) {
        throw new Error(
          `Traspaso ${numeroFactura}: sin combinación L${rec.linea}/R${rec.referencia} talla ${t} ` +
            `(mat=${rec.material} col=${rec.color}) — grada incompleta, abortado.`,
        );
      }
      await client.query(
        `INSERT INTO traspaso_detalle (traspaso_id, combinacion_id, cantidad) VALUES ($1, $2, $3)`,
        [trpId, combId, qty],
      );
      paresInsertados += qty;
    }
  }
  if (paresPedidos > 0 && paresInsertados !== paresPedidos) {
    throw new Error(
      `Traspaso ${numeroFactura}: pares pedidos ${paresPedidos} ≠ insertados ${paresInsertados}`,
    );
  }
  return paresInsertados;
}

/** Reconstruye traspaso_detalle desde FI (corrige gradas truncadas / sin escala). */
export async function resyncTraspasoDetalleFromFactura(
  client: PoolClient,
  traspasoId: number,
): Promise<
  | { ok: true; paresAntes: number; paresDespues: number; fiPares: number; documentoRef: string }
  | { ok: false; error: string }
> {
  const trp = await client.query<{
    documento_ref: string | null;
    estado: string;
    snapshot_json: unknown;
  }>(`SELECT documento_ref, estado, snapshot_json FROM traspaso WHERE id = $1 FOR UPDATE`, [traspasoId]);
  if (!trp.rows.length) return { ok: false, error: "Traspaso no encontrado." };

  const { documento_ref: docRef, estado, snapshot_json: snapRaw } = trp.rows[0];
  if (!docRef?.trim()) return { ok: false, error: "Traspaso sin documento_ref (FI)." };
  if (estado === "CONFIRMADO") {
    return { ok: false, error: "TRP CONFIRMADO — usar repararIngresoTraspasoConfirmado." };
  }

  const fi = await client.query<{ id: number; pp_id: number; total_pares: number }>(
    `
    SELECT fi.id, fi.pp_id, COALESCE(fi.total_pares, 0)::int AS total_pares
    FROM factura_interna fi
    WHERE fi.nro_factura = $1 AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
    LIMIT 1
    `,
    [docRef.trim()],
  );
  if (!fi.rows.length) return { ok: false, error: `FI ${docRef} no encontrada o no confirmada.` };

  const fiId = fi.rows[0].id;
  const idPp = fi.rows[0].pp_id;
  const fiPares = fi.rows[0].total_pares;

  // LEFT JOIN: ppd puede estar huérfano post-purge; snapshot FI + URL imagen bastan.
  const det = await client.query<{
    linea: string | null;
    referencia: string | null;
    descp_material: string | null;
    descp_color: string | null;
    grades_json: unknown;
    linea_snapshot: unknown;
    pares: number;
    id_marca: number;
  }>(
    `
    SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
           ppd.grades_json, fid.linea_snapshot, fid.pares,
           COALESCE(ppd.id_marca, 0)::int AS id_marca
    FROM factura_interna_detalle fid
    LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
    WHERE fid.factura_id = $1
    `,
    [fiId],
  );

  const items: ItemTallas[] = [];
  for (const r of det.rows) {
    const item = itemTallasFromFiDetalle(r);
    if (item) items.push(item);
  }
  if (!items.length) return { ok: false, error: "Sin líneas resolubles desde FI." };

  const expandPares = items.reduce(
    (s, it) => s + Object.values(it.tallas).reduce((a, b) => a + (Number(b) || 0), 0),
    0,
  );
  if (fiPares > 0 && expandPares !== fiPares) {
    return {
      ok: false,
      error: `Expansión grada incompleta: FI ${fiPares} p vs expand ${expandPares} p (${items.length}/${det.rows.length} líneas).`,
    };
  }

  const antesRes = await client.query<{ n: string }>(
    `SELECT COALESCE(SUM(cantidad), 0)::text AS n FROM traspaso_detalle WHERE traspaso_id = $1`,
    [traspasoId],
  );
  const paresAntes = parseInt(antesRes.rows[0]?.n ?? "0", 10) || 0;

  await client.query(`DELETE FROM traspaso_detalle WHERE traspaso_id = $1`, [traspasoId]);
  const paresDespues = await insertTraspasoDetalleLines(client, traspasoId, items, docRef.trim());

  const snap = parseJsonRecord(snapRaw) ?? {};
  const idMarca = det.rows[0]?.id_marca ?? 0;
  const snapshot = {
    ...snap,
    numero_factura: docRef.trim(),
    id_pp: idPp,
    id_marca: idMarca,
    items,
  };
  await client.query(`UPDATE traspaso SET snapshot_json = $2::jsonb WHERE id = $1`, [
    traspasoId,
    JSON.stringify(snapshot),
  ]);

  if (fiPares > 0 && paresDespues !== fiPares) {
    return {
      ok: false,
      error: `Resync parcial: FI ${fiPares} p vs detalle ${paresDespues} p (antes ${paresAntes}). Revisar combinaciones faltantes.`,
    };
  }

  return { ok: true, paresAntes, paresDespues, fiPares, documentoRef: docRef.trim() };
}

export async function enviarFacturaABazar(numeroFactura: string): Promise<MutationResult> {
  const { getRimecPool } = await import("@/lib/rimec/pool");
  const pool = getRimecPool();
  const client = await pool.connect();
  const factura = numeroFactura.trim();
  try {
    await client.query("BEGIN");

    const trp = await client.query<{ id: number; estado: string }>(
      `SELECT id, estado FROM traspaso WHERE documento_ref = $1 LIMIT 1`,
      [factura],
    );
    if (trp.rows.length) {
      const { id, estado } = trp.rows[0];
      if (estado === "ENVIADO") {
        await client.query("ROLLBACK");
        return { ok: false, error: "Ya fue enviado a Web Bazar (estado: ENVIADO)." };
      }
      if (estado === "CONFIRMADO") {
        await client.query("ROLLBACK");
        return { ok: false, error: "Ya fue confirmado por Web Bazar (estado: CONFIRMADO)." };
      }
      await client.query(`UPDATE traspaso SET estado = 'ENVIADO' WHERE id = $1`, [id]);
      await client.query("COMMIT");
      return { ok: true, message: `Traspaso ${id} enviado a Web Bazar.` };
    }

    const vtRows = await client.query<{
      linea: string; referencia: string; descp_material: string; descp_color: string;
      t33: number; t34: number; t35: number; t36: number; t37: number; t38: number; t39: number; t40: number;
      pedido_proveedor_id: number; id_marca: number;
    }>(
      `
      SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
             vt.t33, vt.t34, vt.t35, vt.t36, vt.t37, vt.t38, vt.t39, vt.t40,
             vt.pedido_proveedor_id, COALESCE(ppd.id_marca, 0)::int AS id_marca
      FROM venta_transito vt
      JOIN pedido_proveedor_detalle ppd ON ppd.id = vt.pedido_proveedor_detalle_id
      WHERE vt.numero_factura_interna = $1
      `,
      [factura],
    );

    if (vtRows.rows.length) {
      const idPp = vtRows.rows[0].pedido_proveedor_id;
      const idMarca = vtRows.rows[0].id_marca;
      const items: ItemTallas[] = vtRows.rows.map((r) => {
        const tallas: Record<string, number> = {};
        for (let t = 33; t <= 40; t++) {
          const v = Number(r[`t${t}` as keyof typeof r] ?? 0);
          if (v > 0) tallas[`t${t}`] = v;
        }
        return {
          linea: String(r.linea ?? ""),
          referencia: String(r.referencia ?? ""),
          material: String(r.descp_material ?? ""),
          color: String(r.descp_color ?? ""),
          tallas,
        };
      }).filter((i) => Object.keys(i.tallas).length > 0);

      const trpId = await crearTraspasoPorFactura(client, idPp, idMarca, factura, items);
      await client.query(`UPDATE traspaso SET estado = 'ENVIADO' WHERE id = $1`, [trpId]);
      await client.query("COMMIT");
      return { ok: true, message: "Traspaso TRP creado (legacy) y enviado a Web Bazar." };
    }

    const fi = await client.query<{ id: number; pp_id: number }>(
      `
      SELECT fi.id, fi.pp_id FROM factura_interna fi
      WHERE fi.nro_factura = $1 AND fi.estado IN ('CONFIRMADA', 'RESERVADA')
      LIMIT 1
      `,
      [factura],
    );
    if (!fi.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No se encontró esta factura en venta_transito ni factura_interna." };
    }

    const fiId = fi.rows[0].id;
    const idPp = fi.rows[0].pp_id;
    const det = await client.query<{
      linea: string | null;
      referencia: string | null;
      descp_material: string | null;
      descp_color: string | null;
      grades_json: unknown;
      linea_snapshot: unknown;
      pares: number;
      id_marca: number;
    }>(
      `
      SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
             ppd.grades_json, fid.linea_snapshot, fid.pares, COALESCE(ppd.id_marca, 0)::int AS id_marca
      FROM factura_interna_detalle fid
      LEFT JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fid.factura_id = $1
      `,
      [fiId],
    );

    const idMarca = det.rows[0]?.id_marca ?? 0;
    const items: ItemTallas[] = [];
    for (const r of det.rows) {
      const item = itemTallasFromFiDetalle(r);
      if (item) items.push(item);
    }
    if (!items.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No se pudo extraer distribución de tallas." };
    }
    const fiParesQ = await client.query<{ n: number }>(
      `SELECT COALESCE(total_pares,0)::int AS n FROM factura_interna WHERE id = $1`,
      [fiId],
    );
    const fiPares = Number(fiParesQ.rows[0]?.n || 0);
    const expandPares = items.reduce(
      (s, it) => s + Object.values(it.tallas).reduce((a, b) => a + (Number(b) || 0), 0),
      0,
    );
    if (fiPares > 0 && expandPares !== fiPares) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: `Distribución grada incompleta: FI ${fiPares} ≠ expand ${expandPares}. Abortado.`,
      };
    }

    const trpId = await crearTraspasoPorFactura(client, idPp, idMarca, factura, items);
    await client.query(`UPDATE traspaso SET estado = 'ENVIADO' WHERE id = $1`, [trpId]);
    await client.query("COMMIT");
    return { ok: true, message: "Traspaso TRP creado (FI) y enviado a Web Bazar." };
  } catch (e) {
    await client.query("ROLLBACK");
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    client.release();
  }
}
