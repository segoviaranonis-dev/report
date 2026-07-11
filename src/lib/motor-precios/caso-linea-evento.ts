import type { Pool } from "pg";

/** Mapa canónico línea (codigo_proveedor) → nombre_caso del evento (PELE). Independiente de precio_lista. */
export async function loadMapaCasoPorLineaEvento(
  pool: Pool,
  eventoId: number,
): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ linea: string; nombre_caso: string }>(
    `SELECT l.codigo_proveedor::text AS linea, pec.nombre_caso
     FROM precio_evento_linea_excepcion pele
     JOIN linea l ON l.id = pele.linea_id
     JOIN precio_evento_caso pec ON pec.id = pele.caso_id
     WHERE pec.evento_id = $1`,
    [eventoId],
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    const cod = String(Math.trunc(Number(r.linea)));
    if (!cod || cod === "NaN") continue;
    const nom = String(r.nombre_caso ?? "").replace(/\*/g, "").trim();
    if (nom) map.set(cod, nom);
  }
  return map;
}

export async function casoLineaEnEvento(
  pool: Pool,
  eventoId: number,
  lineaCodigo: string,
): Promise<string | null> {
  const cod = String(Math.trunc(Number(lineaCodigo)));
  if (!cod || cod === "NaN") return null;
  const map = await loadMapaCasoPorLineaEvento(pool, eventoId);
  return map.get(cod) ?? null;
}

export async function listarCasosEventoParaAsignacion(
  pool: Pool,
  eventoId: number,
): Promise<Array<{ id: number; nombre_caso: string }>> {
  const { rows } = await pool.query<{ id: string; nombre_caso: string }>(
    `SELECT id, nombre_caso FROM precio_evento_caso WHERE evento_id = $1 ORDER BY id`,
    [eventoId],
  );
  return rows.map((r) => ({ id: Number(r.id), nombre_caso: r.nombre_caso }));
}
