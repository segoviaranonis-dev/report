/**
 * Traspaso + combinacion — gemelo compra_legal/logic.py + facturacion/logic.py
 */
import type { PoolClient } from "pg";
import { gradesJsonSoloTallas } from "@/lib/pedido-proveedor/grades-json-canonical";
import { ALM_TRANSITO, ALM_WEB_BAZAR } from "./constants";

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

/** Normaliza clave talla: "t38" | "38" | "38.0" → 38 */
export function tallaKeyToNum(tallaStr: string): number | null {
  const head = String(tallaStr ?? "")
    .trim()
    .replace(/^t/i, "")
    .split("/")[0]
    ?.replace(/[^\d.]/g, "");
  const n = Number(head);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 20 || i > 55) return null;
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

function gradasFmtToTallas(gradasFmt: string): Record<string, number> {
  if (!gradasFmt.includes("(") || !gradasFmt.includes(")")) return {};
  try {
    const [inicioStr, resto] = gradasFmt.split("(", 2);
    const [cantidadesStr] = resto.split(")", 1);
    const tallaInicio = parseInt(inicioStr.trim(), 10);
    const cantidades = cantidadesStr.split(/[\s\-]+/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
    const tallas: Record<string, number> = {};
    cantidades.forEach((qty, idx) => {
      const tallaNum = tallaInicio + idx;
      if (tallaNum >= 33 && tallaNum <= 40 && qty > 0) tallas[`t${tallaNum}`] = qty;
    });
    return tallas;
  } catch {
    return {};
  }
}

export function extractTallasFromFiRow(row: {
  grades_json: unknown;
  linea_snapshot: unknown;
  pares: number;
}): Record<string, number> {
  let tallas: Record<string, number> = {};
  const grades = gradesJsonSoloTallas(row.grades_json);
  if (Object.keys(grades).length && row.pares > 0) {
    tallas = scaleGradesToPares(grades, row.pares);
  }
  if (!Object.keys(tallas).length && row.linea_snapshot) {
    const snap = parseJsonRecord(row.linea_snapshot);
    const fmt = snap ? String(snap.gradas_fmt ?? snap.grada ?? "") : "";
    if (fmt) tallas = gradasFmtToTallas(fmt);
    if (!Object.keys(tallas).length && snap?.tallas && typeof snap.tallas === "object") {
      tallas = scaleGradesToPares(snap.tallas as Record<string, number>, row.pares);
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

  const matMatch = `
    (
      NULLIF(btrim(mat.descripcion), '') = $4
      OR mat.codigo_proveedor::text = $4
      OR ('K' || l.codigo_proveedor::text) = $4
    )
  `;
  const colMatch = `(col.nombre = $5 OR col.codigo_proveedor::text = $5)`;

  const found = await client.query<{ id: number }>(
    `
    SELECT c.id
    FROM combinacion c
    JOIN linea l ON l.id = c.linea_id AND l.codigo_proveedor::text = $1
    JOIN referencia r ON r.id = c.referencia_id AND r.codigo_proveedor::text = $2 AND r.linea_id = l.id
    JOIN talla tl ON tl.id = c.talla_id AND tl.talla_etiqueta = $3
    JOIN material mat ON mat.id = c.material_id AND ${matMatch}
    JOIN color col ON col.id = c.color_id AND ${colMatch}
    LIMIT 1
    `,
    [lineaCod, refCod, tallaCod, matCod, colCod],
  );
  if (found.rows[0]?.id) return found.rows[0].id;

  const ids = await client.query<{ linea_id: number; ref_id: number; mat_id: number; col_id: number; talla_id: number }>(
    `
    SELECT l.id AS linea_id, r.id AS ref_id, mat.id AS mat_id, col.id AS col_id, tl.id AS talla_id
    FROM linea l
    JOIN referencia r ON r.linea_id = l.id AND r.codigo_proveedor::text = $2
    JOIN talla tl ON tl.talla_etiqueta = $3
    JOIN material mat ON mat.proveedor_id = l.proveedor_id AND ${matMatch}
    JOIN color col ON col.proveedor_id = l.proveedor_id AND ${colMatch}
    WHERE l.codigo_proveedor::text = $1
    LIMIT 1
    `,
    [lineaCod, refCod, tallaCod, matCod, colCod],
  );
  if (!ids.rows.length) return null;

  const { linea_id, ref_id, mat_id, col_id, talla_id } = ids.rows[0];
  const ins = await client.query<{ id: number }>(
    `
    INSERT INTO combinacion (linea_id, referencia_id, material_id, color_id, talla_id, activo_web)
    VALUES ($1, $2, $3, $4, $5, false)
    RETURNING id
    `,
    [linea_id, ref_id, mat_id, col_id, talla_id],
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
      linea: string; referencia: string; descp_material: string; descp_color: string;
      grades_json: unknown; linea_snapshot: unknown; pares: number; id_marca: number;
    }>(
      `
      SELECT ppd.linea, ppd.referencia, ppd.descp_material, ppd.descp_color,
             ppd.grades_json, fid.linea_snapshot, fid.pares, COALESCE(ppd.id_marca, 0)::int AS id_marca
      FROM factura_interna_detalle fid
      JOIN pedido_proveedor_detalle ppd ON ppd.id = fid.ppd_id
      WHERE fid.factura_id = $1
      `,
      [fiId],
    );

    const idMarca = det.rows[0]?.id_marca ?? 0;
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
    if (!items.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "No se pudo extraer distribución de tallas." };
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
