import type { Pool } from "pg";

export type EstadoRealEvento = "borrador" | "validado" | "en_uso" | "cerrado";

export type EventoUsoInfo = {
  en_uso: boolean;
  en_uso_pp: boolean;
  en_uso_ic: boolean;
  modulos: string[];
  ics: string[];
  pps: string[];
  pp_ids: number[];
};

export type EventoHistorialRow = {
  id: number;
  nombre_evento: string;
  nombre_archivo: string;
  estado_db: string;
  estado_real: EstadoRealEvento;
  fecha_vigencia_desde: string;
  created_at: string;
  total_skus: number;
  excel_skus: number;
  uso: EventoUsoInfo;
  editable: boolean;
  eliminable: boolean;
};

export async function eventoEstaEnUso(pool: Pool, eventoId: number): Promise<EventoUsoInfo> {
  const { rows: icRows } = await pool.query<{ numero_registro: string }>(
    `SELECT numero_registro FROM intencion_compra WHERE precio_evento_id = $1`,
    [eventoId],
  );
  const ics = icRows.map((r) => r.numero_registro).filter(Boolean);

  const { rows: ppRows } = await pool.query<{ id: string; numero_registro: string }>(
    `SELECT DISTINCT pp.id, pp.numero_registro
     FROM intencion_compra_pedido icp
     JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
     WHERE icp.precio_evento_id = $1`,
    [eventoId],
  );
  const pps = ppRows.map((r) => r.numero_registro).filter(Boolean);
  const pp_ids = ppRows.map((r) => Number(r.id));
  const en_uso_pp = ppRows.length > 0;
  const en_uso_ic = ics.length > 0;

  const modulos: string[] = [];
  if (ics.length) modulos.push(`Intención de Compra: ${ics.join(", ")}`);
  if (ppRows.length) modulos.push(`Pedido proveedor: ${pps.join(", ")}`);

  return {
    en_uso: en_uso_pp || en_uso_ic,
    en_uso_pp,
    en_uso_ic,
    modulos,
    ics,
    pps,
    pp_ids,
  };
}

export function getEstadoRealEvento(estadoDb: string, enUso: boolean): EstadoRealEvento {
  const e = String(estadoDb ?? "borrador").toLowerCase();
  if (e === "cerrado") return "cerrado";
  if (enUso) return "en_uso";
  if (e === "validado" || e === "calculado") return e === "validado" ? "validado" : "borrador";
  return e === "validado" ? "validado" : "borrador";
}

async function usoPorEventos(pool: Pool, ids: number[]): Promise<Map<number, EventoUsoInfo>> {
  const map = new Map<number, EventoUsoInfo>();
  if (!ids.length) return map;

  const { rows: icRows } = await pool.query<{ evento_id: string; numero_registro: string }>(
    `SELECT precio_evento_id AS evento_id, numero_registro
     FROM intencion_compra
     WHERE precio_evento_id = ANY($1::bigint[])`,
    [ids],
  );
  const { rows: ppRows } = await pool.query<{ evento_id: string; pp_id: string; numero_registro: string }>(
    `SELECT icp.precio_evento_id AS evento_id, pp.id AS pp_id, pp.numero_registro
     FROM intencion_compra_pedido icp
     JOIN pedido_proveedor pp ON pp.id = icp.pedido_proveedor_id
     WHERE icp.precio_evento_id = ANY($1::bigint[])`,
    [ids],
  );

  for (const id of ids) {
    map.set(id, { en_uso: false, en_uso_pp: false, en_uso_ic: false, modulos: [], ics: [], pps: [], pp_ids: [] });
  }
  for (const r of icRows) {
    const id = Number(r.evento_id);
    const u = map.get(id)!;
    u.ics.push(r.numero_registro);
  }
  for (const r of ppRows) {
    const id = Number(r.evento_id);
    const u = map.get(id)!;
    if (!u.pps.includes(r.numero_registro)) u.pps.push(r.numero_registro);
    if (!u.pp_ids.includes(Number(r.pp_id))) u.pp_ids.push(Number(r.pp_id));
  }
  for (const u of map.values()) {
    u.en_uso_pp = u.pps.length > 0;
    u.en_uso_ic = u.ics.length > 0;
    u.en_uso = u.en_uso_pp || u.en_uso_ic;
    if (u.ics.length) u.modulos.push(`Intención de Compra: ${u.ics.join(", ")}`);
    if (u.pps.length) u.modulos.push(`Pedido proveedor: ${[...new Set(u.pps)].join(", ")}`);
  }
  return map;
}

export async function listHistorialEventos(
  pool: Pool,
  opts?: { proveedor_id?: number; busqueda?: string },
): Promise<EventoHistorialRow[]> {
  const params: unknown[] = [];
  let where = "WHERE pe.estado = 'cerrado'";
  if (opts?.proveedor_id) {
    params.push(opts.proveedor_id);
    where += ` AND pe.proveedor_id = $${params.length}`;
  }
  if (opts?.busqueda?.trim()) {
    params.push(`%${opts.busqueda.trim().toLowerCase()}%`);
    where += ` AND (LOWER(pe.nombre_evento) LIKE $${params.length} OR LOWER(pe.estado) LIKE $${params.length})`;
  }

  const { rows } = await pool.query<{
    id: string;
    nombre_evento: string;
    nombre_archivo: string;
    estado: string;
    fecha_vigencia_desde: Date;
    created_at: Date;
    total_skus: string;
  }>(
    `SELECT pe.id, pe.nombre_evento, pe.nombre_archivo, pe.estado,
            pe.fecha_vigencia_desde, pe.created_at,
            COUNT(pl.id)::text AS total_skus
     FROM precio_evento pe
     LEFT JOIN precio_lista pl ON pl.evento_id = pe.id
     ${where}
     GROUP BY pe.id
     ORDER BY pe.created_at DESC`,
    params,
  );

  const ids = rows.map((r) => Number(r.id));
  const usoMap = await usoPorEventos(pool, ids);

  let excelCounts = new Map<number, number>();
  const skuTable = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('public.precio_evento_sku_excel') IS NOT NULL AS ok`,
  );
  if (skuTable.rows[0]?.ok && ids.length) {
    const { rows: exRows } = await pool.query<{ evento_id: string; n: string }>(
      `SELECT evento_id, COUNT(*)::text AS n
       FROM precio_evento_sku_excel
       WHERE evento_id = ANY($1::bigint[])
       GROUP BY evento_id`,
      [ids],
    );
    excelCounts = new Map(exRows.map((r) => [Number(r.evento_id), Number(r.n)]));
  }

  const out: EventoHistorialRow[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    const uso = usoMap.get(id) ?? {
      en_uso: false,
      en_uso_pp: false,
      en_uso_ic: false,
      modulos: [],
      ics: [],
      pps: [],
      pp_ids: [],
    };
    const estado_db = r.estado ?? "borrador";
    const estado_real = getEstadoRealEvento(estado_db, uso.en_uso);
    const excel_skus = excelCounts.get(id) ?? 0;
    out.push({
      id,
      nombre_evento: r.nombre_evento,
      nombre_archivo: r.nombre_archivo,
      estado_db,
      estado_real,
      fecha_vigencia_desde: r.fecha_vigencia_desde.toISOString().slice(0, 10),
      created_at: r.created_at.toISOString(),
      total_skus: Number(r.total_skus ?? 0),
      excel_skus,
      uso,
      editable: estado_real !== "cerrado" && !uso.en_uso,
      eliminable: !uso.en_uso_pp,
    });
  }
  return out;
}

export async function eliminarEventoPrecio(
  pool: Pool,
  eventoId: number,
): Promise<{ ok: true; mensaje: string } | { ok: false; error: string }> {
  const { rows: evRows } = await pool.query<{ nombre_evento: string }>(
    `SELECT nombre_evento FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  if (!evRows[0]) {
    return { ok: false, error: "El listado no existe o ya fue eliminado." };
  }
  const nombre = evRows[0].nombre_evento;

  const uso = await eventoEstaEnUso(pool, eventoId);
  if (uso.en_uso_pp) {
    return {
      ok: false,
      error: `No se puede eliminar: vinculado a pedido proveedor (${uso.pps.join(", ")}). Asigná otro listado en el PP antes de borrar.`,
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (uso.en_uso_ic) {
      await client.query(`UPDATE intencion_compra SET precio_evento_id = NULL WHERE precio_evento_id = $1`, [
        eventoId,
      ]);
    }

    const skuTable = await client.query<{ ok: boolean }>(
      `SELECT to_regclass('public.precio_evento_sku_excel') IS NOT NULL AS ok`,
    );
    if (skuTable.rows[0]?.ok) {
      await client.query(`DELETE FROM precio_evento_sku_excel WHERE evento_id = $1`, [eventoId]);
    }

    await client.query(`DELETE FROM precio_lista_staging WHERE evento_id = $1`, [eventoId]).catch(() => {});
    await client.query(`DELETE FROM precio_auditoria WHERE evento_id = $1`, [eventoId]).catch(() => {});
    await client.query(
      `DELETE FROM precio_evento_linea_excepcion
       WHERE caso_id IN (SELECT id FROM precio_evento_caso WHERE evento_id = $1)`,
      [eventoId],
    );
    await client.query(`DELETE FROM precio_lista WHERE evento_id = $1`, [eventoId]);
    await client.query(`DELETE FROM precio_evento_caso WHERE evento_id = $1`, [eventoId]);
    await client.query(`DELETE FROM precio_evento WHERE id = $1`, [eventoId]);
    await client.query("COMMIT");
    return { ok: true, mensaje: `Listado «${nombre}» eliminado.` };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error al eliminar";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
