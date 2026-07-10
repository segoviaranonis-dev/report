import type { Pool, PoolClient } from "pg";
import type { ProformaRow } from "./parse-proforma";
import { canonicalMolKey } from "./pilares-proforma-upsert";

let tableReady = false;

export async function ensureProformaFilasTable(pool: Pool | PoolClient): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pp_proforma_filas (
      pp_id bigint PRIMARY KEY REFERENCES pedido_proveedor(id) ON DELETE CASCADE,
      filas jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

export async function saveProformaFilas(
  client: Pool | PoolClient,
  ppId: number,
  filas: ProformaRow[],
): Promise<void> {
  await ensureProformaFilasTable(client);
  await client.query(
    `INSERT INTO pp_proforma_filas (pp_id, filas, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (pp_id) DO UPDATE SET filas = EXCLUDED.filas, updated_at = now()`,
    [ppId, JSON.stringify(filas)],
  );
}

export async function loadProformaFilas(pool: Pool | PoolClient, ppId: number): Promise<ProformaRow[] | null> {
  await ensureProformaFilasTable(pool);
  const { rows } = await pool.query<{ filas: ProformaRow[] | string }>(
    "SELECT filas FROM pp_proforma_filas WHERE pp_id = $1",
    [ppId],
  );
  const raw = rows[0]?.filas;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ProformaRow[];
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? (raw as ProformaRow[]) : null;
}

type PpdProformaMeta = { shop?: string; brand?: string; item?: string };

function readPpdMeta(gradesJson: unknown): PpdProformaMeta {
  if (typeof gradesJson !== "object" || !gradesJson) return {};
  const g = gradesJson as Record<string, unknown>;
  return {
    shop: typeof g._shop === "string" ? g._shop : undefined,
    brand: typeof g._brand === "string" ? g._brand : undefined,
    item: typeof g._item === "string" ? g._item : undefined,
  };
}

/** Reconstruye filas proforma desde PPD (shop guardado en grades_json al importar). */
export async function loadProformaDetalleFromPpd(
  pool: Pool | PoolClient,
  ppId: number,
): Promise<ProformaRow[] | null> {
  const { rows } = await pool.query<{
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    descp_material: string | null;
    descp_color: string | null;
    nombre: string | null;
    ncm: string | null;
    style_code: string | null;
    grada: string | null;
    cantidad_cajas: number;
    cantidad_pares: number;
    unit_fob: number;
    amount_fob: number;
    grades_json: unknown;
    fila_origen_f9: number | null;
    id_marca: number | null;
  }>(
    `SELECT linea, referencia, material_code, color_code, descp_material, descp_color, nombre,
            ncm, style_code, grada, cantidad_cajas, cantidad_pares, unit_fob, amount_fob,
            grades_json, fila_origen_f9, id_marca
     FROM pedido_proveedor_detalle
     WHERE pedido_proveedor_id = $1 AND linea IS NOT NULL AND linea <> ''
     ORDER BY fila_origen_f9 NULLS LAST, id`,
    [ppId],
  );
  if (!rows.length) return null;

  const detalle: ProformaRow[] = [];
  let withShop = 0;
  for (const r of rows) {
    const gj =
      typeof r.grades_json === "object" && r.grades_json
        ? ({ ...(r.grades_json as Record<string, number>) } as Record<string, number>)
        : {};
    const meta = readPpdMeta(r.grades_json);
    if (!meta.shop?.trim()) continue;
    withShop += 1;
    delete gj._shop;
    delete gj._brand;
    delete gj._item;

    detalle.push({
      item: meta.item ?? String(r.fila_origen_f9 ?? ""),
      ncm: r.ncm ?? "",
      style_code: r.style_code ?? "",
      linea_codigo_proveedor: String(r.linea),
      referencia_codigo_proveedor: String(r.referencia),
      name: r.nombre ?? "",
      material_code: String(r.material_code ?? ""),
      material: r.descp_material ?? "",
      color_code: String(r.color_code ?? ""),
      color: r.descp_color ?? "",
      brand: meta.brand ?? "",
      shop: meta.shop.trim(),
      boxes: Number(r.cantidad_cajas ?? 1),
      pairs: Number(r.cantidad_pares ?? 0),
      unit_fob: Number(r.unit_fob ?? 0),
      amount_fob: Number(r.amount_fob ?? 0),
      grade_range: r.grada ?? "",
      grades_json: gj,
    });
  }
  if (withShop === 0 || withShop < rows.length * 0.95) return null;
  return detalle;
}

/** Fuente canónica en BD: snapshot JSON → PPD con _shop → inferencia IC+PPD. Sin Excel. */
export async function loadProformaDetalleParaFi(
  pool: Pool | PoolClient,
  ppId: number,
  opts?: { autoInfer?: boolean },
): Promise<{ detalle: ProformaRow[]; source: "snapshot" | "ppd" | "inferred" } | null> {
  const snap = await loadProformaFilas(pool, ppId);
  if (snap?.length) return { detalle: snap, source: "snapshot" };

  const fromPpd = await loadProformaDetalleFromPpd(pool, ppId);
  if (fromPpd?.length) return { detalle: fromPpd, source: "ppd" };

  if (opts?.autoInfer !== false) {
    const inferred = await inferAndPersistProformaFromPpd(pool, ppId);
    if (inferred?.detalle.length) return { detalle: inferred.detalle, source: "inferred" };
  }

  return null;
}

export async function hasProformaDetalleEnBd(pool: Pool | PoolClient, ppId: number): Promise<boolean> {
  const loaded = await loadProformaDetalleParaFi(pool, ppId);
  return loaded != null && loaded.detalle.length > 0;
}

export async function hasProformaFilas(pool: Pool | PoolClient, ppId: number): Promise<boolean> {
  return hasProformaDetalleEnBd(pool, ppId);
}

/** Si hay snapshot, escribe _shop en grades_json de PPD existente (backfill sin reimportar). */
export async function backfillPpdShopFromSnapshot(client: Pool | PoolClient, ppId: number): Promise<number> {
  const snap = await loadProformaFilas(client, ppId);
  if (!snap?.length) return 0;

  const { rows } = await client.query<{
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

  const byMol = new Map<string, ProformaRow>();
  for (const f of snap) {
    byMol.set(
      canonicalMolKey(
        f.linea_codigo_proveedor,
        f.referencia_codigo_proveedor,
        f.material_code,
        f.color_code,
        f.grades_json,
      ),
      f,
    );
  }

  let n = 0;
  for (const r of rows) {
    const gj =
      typeof r.grades_json === "object" && r.grades_json
        ? ({ ...(r.grades_json as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (typeof gj._shop === "string" && gj._shop.trim()) continue;

    const key = canonicalMolKey(
      String(r.linea),
      String(r.referencia),
      String(r.material_code),
      String(r.color_code),
      gj as Record<string, number>,
    );
    const hit = byMol.get(key);
    if (!hit?.shop) continue;

    gj._shop = hit.shop.trim();
    gj._brand = hit.brand?.trim() ?? "";
    gj._item = hit.item ?? "";
    await client.query(`UPDATE pedido_proveedor_detalle SET grades_json = $2::jsonb WHERE id = $1`, [
      r.id,
      JSON.stringify(gj),
    ]);
    n += 1;
  }
  return n;
}

type PpdRowRaw = {
  linea: string;
  referencia: string;
  material_code: string;
  color_code: string;
  descp_material: string | null;
  descp_color: string | null;
  nombre: string | null;
  ncm: string | null;
  style_code: string | null;
  grada: string | null;
  cantidad_cajas: number;
  cantidad_pares: number;
  unit_fob: number;
  amount_fob: number;
  grades_json: unknown;
  fila_origen_f9: number | null;
  id_marca: number | null;
};

const PPD_SELECT = `SELECT linea, referencia, material_code, color_code, descp_material, descp_color, nombre,
            ncm, style_code, grada, cantidad_cajas, cantidad_pares, unit_fob, amount_fob,
            grades_json, fila_origen_f9, id_marca
     FROM pedido_proveedor_detalle
     WHERE pedido_proveedor_id = $1 AND linea IS NOT NULL AND linea <> ''`;

function gradesSinMeta(gradesJson: unknown): Record<string, number> {
  const gj =
    typeof gradesJson === "object" && gradesJson
      ? ({ ...(gradesJson as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  delete gj._shop;
  delete gj._brand;
  delete gj._item;
  return gj as Record<string, number>;
}

function ppdRowToProformaBase(r: PpdRowRaw): ProformaRow {
  const gj = gradesSinMeta(r.grades_json);
  const meta = readPpdMeta(r.grades_json);
  const pairs = Number(r.cantidad_pares ?? 0);
  const boxes = Number(r.cantidad_cajas ?? 1) || 1;
  return {
    item: meta.item ?? String(r.fila_origen_f9 ?? ""),
    ncm: r.ncm ?? "",
    style_code: r.style_code ?? "",
    linea_codigo_proveedor: String(r.linea),
    referencia_codigo_proveedor: String(r.referencia),
    name: r.nombre ?? "",
    material_code: String(r.material_code ?? ""),
    material: r.descp_material ?? "",
    color_code: String(r.color_code ?? ""),
    color: r.descp_color ?? "",
    brand: meta.brand ?? "",
    shop: "",
    boxes,
    pairs,
    unit_fob: Number(r.unit_fob ?? 0),
    amount_fob: Number(r.amount_fob ?? 0),
    grade_range: r.grada ?? "",
    grades_json: gj,
  };
}

function splitProformaRowPairs(row: ProformaRow, take: number): ProformaRow {
  const pOrig = row.pairs;
  const boxesOrig = row.boxes || 1;
  const r2: ProformaRow = { ...row, pairs: take };
  if (pOrig > 0 && boxesOrig > 0) {
    r2.boxes = Math.max(1, Math.round((boxesOrig * take) / pOrig));
  }
  return r2;
}

export type IcClientePares = { id_cliente: number; pares_ic: number };

/** Legacy: PPD sin _shop — reparte filas en orden F9 según cupos IC (misma lógica que preview). */
export function inferProformaDetalleFromPpdAndIcs(
  ppdRows: PpdRowRaw[],
  icClientes: IcClientePares[],
): ProformaRow[] | null {
  if (!ppdRows.length || !icClientes.length) return null;

  const queue = ppdRows
    .slice()
    .sort((a, b) => (a.fila_origen_f9 ?? 0) - (b.fila_origen_f9 ?? 0))
    .map((r) => ppdRowToProformaBase(r))
    .filter((r) => r.pairs > 0);

  const totalPpd = queue.reduce((s, r) => s + r.pairs, 0);
  const totalIc = icClientes.reduce((s, c) => s + c.pares_ic, 0);
  if (totalPpd !== totalIc || totalPpd <= 0) return null;

  const clients = icClientes.slice().sort((a, b) => b.pares_ic - a.pares_ic);
  const out: ProformaRow[] = [];
  let qi = 0;

  for (const client of clients) {
    let needed = client.pares_ic;
    const shop = String(client.id_cliente);
    while (needed > 0 && qi < queue.length) {
      const row = queue[qi];
      if (row.pairs <= needed) {
        out.push({ ...row, shop });
        needed -= row.pairs;
        qi += 1;
      } else {
        out.push({ ...splitProformaRowPairs(row, needed), shop });
        queue[qi] = {
          ...row,
          pairs: row.pairs - needed,
          boxes: Math.max(1, row.boxes - Math.max(1, Math.round((row.boxes * needed) / row.pairs))),
        };
        needed = 0;
      }
    }
    if (needed !== 0) return null;
  }

  if (qi < queue.length) {
    const rest = queue.slice(qi).reduce((s, r) => s + r.pairs, 0);
    if (rest > 0) return null;
  }

  return out.length ? out : null;
}

async function loadPpdRowsRaw(pool: Pool | PoolClient, ppId: number): Promise<PpdRowRaw[]> {
  const { rows } = await pool.query<PpdRowRaw>(`${PPD_SELECT} ORDER BY fila_origen_f9 NULLS LAST, id`, [ppId]);
  return rows;
}

async function loadIcParesPorCliente(pool: Pool | PoolClient, ppId: number): Promise<IcClientePares[]> {
  const { rows } = await pool.query<{ id_cliente: number; pares: number }>(
    `SELECT ic.id_cliente, SUM(ic.cantidad_total_pares)::int AS pares
     FROM intencion_compra_pedido icp
     JOIN intencion_compra ic ON ic.id = icp.intencion_compra_id
     WHERE icp.pedido_proveedor_id = $1
     GROUP BY ic.id_cliente`,
    [ppId],
  );
  return rows.map((r) => ({ id_cliente: Number(r.id_cliente), pares_ic: Number(r.pares ?? 0) }));
}

export async function inferAndPersistProformaFromPpd(
  client: Pool | PoolClient,
  ppId: number,
): Promise<{ detalle: ProformaRow[]; n_backfill: number } | null> {
  const [ppdRows, icClientes] = await Promise.all([loadPpdRowsRaw(client, ppId), loadIcParesPorCliente(client, ppId)]);
  const detalle = inferProformaDetalleFromPpdAndIcs(ppdRows, icClientes);
  if (!detalle?.length) return null;
  await saveProformaFilas(client, ppId, detalle);
  const n_backfill = await backfillPpdShopFromSnapshot(client, ppId);
  return { detalle, n_backfill };
}
