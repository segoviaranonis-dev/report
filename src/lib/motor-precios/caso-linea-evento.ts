import type { Pool } from "pg";

function normLineaCodigo(linea: string): string {
  const cod = String(Math.trunc(Number(linea)));
  if (!cod || cod === "NaN") return "";
  return cod;
}

function ingestMapaCasoRows(
  rows: Array<{ linea: string; nombre_caso: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const cod = normLineaCodigo(r.linea);
    if (!cod) continue;
    const nom = String(r.nombre_caso ?? "").replace(/\*/g, "").trim();
    if (nom) map.set(cod, nom);
  }
  return map;
}

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
  return ingestMapaCasoRows(rows);
}

/** Mapa línea → caso desde biblioteca cabecera PP (BCL). Fuente canónica al cambiar biblioteca. */
export async function loadMapaCasoPorLineaBiblioteca(
  pool: Pool,
  bibliotecaId: number,
): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ linea: string; nombre_caso: string }>(
    `SELECT l.codigo_proveedor::text AS linea, cpb.nombre_caso
     FROM biblioteca_caso_linea bcl
     JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
     JOIN linea l ON l.id = bcl.linea_id
     WHERE bcl.biblioteca_id = $1 AND cpb.activo = true`,
    [bibliotecaId],
  );
  return ingestMapaCasoRows(rows);
}

export async function loadCasosBibliotecaNombres(
  pool: Pool,
  bibliotecaId: number,
): Promise<Set<string>> {
  const { rows } = await pool.query<{ nombre_caso: string }>(
    `SELECT nombre_caso FROM caso_precio_biblioteca
     WHERE biblioteca_id = $1 AND activo = true`,
    [bibliotecaId],
  );
  const set = new Set<string>();
  for (const r of rows) {
    const n = String(r.nombre_caso ?? "")
      .replace(/\*/g, "")
      .trim()
      .toUpperCase();
    if (n) set.add(n);
  }
  return set;
}

export async function casoLineaEnEvento(
  pool: Pool,
  eventoId: number,
  lineaCodigo: string,
): Promise<string | null> {
  const cod = normLineaCodigo(lineaCodigo);
  if (!cod) return null;
  const map = await loadMapaCasoPorLineaEvento(pool, eventoId);
  return map.get(cod) ?? null;
}

export async function casoLineaEnBiblioteca(
  pool: Pool,
  bibliotecaId: number,
  lineaCodigo: string,
): Promise<string | null> {
  const cod = normLineaCodigo(lineaCodigo);
  if (!cod) return null;
  const map = await loadMapaCasoPorLineaBiblioteca(pool, bibliotecaId);
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
