import type { PoolClient } from "pg";

export type PpdPilarFkLookups = {
  lineaByCod: Map<string, number>;
  refByLineaRef: Map<string, number>;
};

/** Lookups L·R por codigo_proveedor tras provisionPilaresFromProforma. */
export async function loadPpdPilarFkLookups(
  client: PoolClient,
  provId: number,
): Promise<PpdPilarFkLookups> {
  const lineaRes = await client.query<{ id: number; codigo: string }>(
    `SELECT id, codigo_proveedor::text AS codigo FROM linea WHERE proveedor_id = $1`,
    [provId],
  );
  const lineaByCod = new Map<string, number>();
  for (const r of lineaRes.rows) {
    const cod = String(r.codigo ?? "").trim();
    if (cod) lineaByCod.set(cod, r.id);
  }

  const refRes = await client.query<{ id: number; linea_id: number; codigo: string }>(
    `SELECT id, linea_id, codigo_proveedor::text AS codigo FROM referencia WHERE proveedor_id = $1`,
    [provId],
  );
  const refByLineaRef = new Map<string, number>();
  for (const r of refRes.rows) {
    const cod = String(r.codigo ?? "").trim() || "0";
    refByLineaRef.set(`${r.linea_id}|${cod}`, r.id);
  }

  return { lineaByCod, refByLineaRef };
}

export function resolvePpdPilarIds(
  lookups: PpdPilarFkLookups,
  lineaCod: string,
  refCod: string,
): { linea_id: number | null; referencia_id: number | null } {
  const lc = String(lineaCod ?? "").trim();
  const rc = String(refCod ?? "").trim() || "0";
  const linea_id = lookups.lineaByCod.get(lc) ?? null;
  if (!linea_id) return { linea_id: null, referencia_id: null };
  const referencia_id = lookups.refByLineaRef.get(`${linea_id}|${rc}`) ?? null;
  return { linea_id, referencia_id };
}

/** Backfill linea_id / referencia_id / id_material / id_color en PPD existente. */
export async function backfillPpdPilarFks(
  client: PoolClient,
  ppId: number,
): Promise<{ updated: number; sin_linea: number; sin_ref: number }> {
  const upd = await client.query(
    `UPDATE pedido_proveedor_detalle ppd
     SET
       linea_id = sub.linea_id,
       referencia_id = sub.referencia_id,
       id_material = COALESCE(ppd.id_material, sub.material_id),
       id_color = COALESCE(ppd.id_color, sub.color_id)
     FROM (
       SELECT
         ppd2.id AS ppd_id,
         l.id AS linea_id,
         ref.id AS referencia_id,
         m.id AS material_id,
         c.id AS color_id
       FROM pedido_proveedor_detalle ppd2
       JOIN pedido_proveedor pp ON pp.id = ppd2.pedido_proveedor_id
       JOIN linea l
         ON l.proveedor_id = pp.proveedor_importacion_id
        AND l.codigo_proveedor::text = TRIM(ppd2.linea)
       JOIN referencia ref
         ON ref.linea_id = l.id
        AND ref.codigo_proveedor::text = TRIM(COALESCE(ppd2.referencia, '0'))
       LEFT JOIN material m
         ON m.proveedor_id = pp.proveedor_importacion_id
        AND m.codigo_proveedor::text = TRIM(ppd2.material_code)
       LEFT JOIN color c
         ON c.proveedor_id = pp.proveedor_importacion_id
        AND c.codigo_proveedor::text = TRIM(ppd2.color_code)
       WHERE ppd2.pedido_proveedor_id = $1
         AND ppd2.linea IS NOT NULL
         AND TRIM(ppd2.linea) <> ''
     ) sub
     WHERE ppd.id = sub.ppd_id`,
    [ppId],
  );

  const gaps = await client.query<{ sin_linea: string; sin_ref: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE linea_id IS NULL)::text AS sin_linea,
       COUNT(*) FILTER (WHERE linea_id IS NOT NULL AND referencia_id IS NULL)::text AS sin_ref
     FROM pedido_proveedor_detalle
     WHERE pedido_proveedor_id = $1`,
    [ppId],
  );

  return {
    updated: upd.rowCount ?? 0,
    sin_linea: Number(gaps.rows[0]?.sin_linea ?? 0),
    sin_ref: Number(gaps.rows[0]?.sin_ref ?? 0),
  };
}
