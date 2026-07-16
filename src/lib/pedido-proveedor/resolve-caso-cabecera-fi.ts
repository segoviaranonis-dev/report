import type { PoolClient } from "pg";

export type CasoCabeceraFi = {
  caso: string | null;
  caso_id: number | null;
};

/** Caso comercial dominante de las líneas PPD vía precio_lista / PELE del evento.
 * `caso_id` = FK a `caso_precio_biblioteca` (no a `precio_evento_caso`). */
export async function resolveCasoDominanteDesdePpd(
  client: PoolClient,
  ppId: number,
  eventoId: number,
  ppdIds: number[],
): Promise<CasoCabeceraFi> {
  if (!ppdIds.length || !eventoId) return { caso: null, caso_id: null };

  const { rows } = await client.query<{ caso: string; n: number }>(
    `
    SELECT COALESCE(
             NULLIF(TRIM(pl.nombre_caso_aplicado), ''),
             NULLIF(TRIM(pec.nombre_caso), ''),
             NULLIF(TRIM(pec_pele.nombre_caso), '')
           ) AS caso,
           COUNT(*)::int AS n
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN linea l
      ON l.proveedor_id = pp.proveedor_importacion_id
     AND l.codigo_proveedor::text = TRIM(ppd.linea)
    LEFT JOIN referencia ref
      ON ref.linea_id = l.id
     AND ref.codigo_proveedor::text = TRIM(ppd.referencia)
    LEFT JOIN material m
      ON m.proveedor_id = pp.proveedor_importacion_id
     AND m.codigo_proveedor::text = TRIM(COALESCE(ppd.material_code, ''))
    LEFT JOIN precio_lista pl
      ON pl.evento_id = $3
     AND pl.linea_id = l.id
     AND pl.referencia_id = ref.id
     AND (m.id IS NULL OR pl.material_id = m.id)
    LEFT JOIN precio_evento_caso pec ON pec.id = pl.caso_id
    LEFT JOIN precio_evento_linea_excepcion pele ON pele.linea_id = l.id
    LEFT JOIN precio_evento_caso pec_pele
      ON pec_pele.id = pele.caso_id AND pec_pele.evento_id = $3
    WHERE ppd.pedido_proveedor_id = $1
      AND ppd.id = ANY($2::int[])
      AND COALESCE(
            NULLIF(TRIM(pl.nombre_caso_aplicado), ''),
            NULLIF(TRIM(pec.nombre_caso), ''),
            NULLIF(TRIM(pec_pele.nombre_caso), '')
          ) IS NOT NULL
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 1`,
    [ppId, ppdIds, eventoId],
  );

  const top = rows[0];
  if (!top?.caso) return { caso: null, caso_id: null };
  const caso = String(top.caso).replace(/\*/g, "").trim() || null;
  if (!caso) return { caso: null, caso_id: null };

  const bib = await client.query<{ id: number }>(
    `SELECT id::int AS id FROM caso_precio_biblioteca
     WHERE UPPER(TRIM(nombre_caso)) = UPPER(TRIM($1))
     ORDER BY id ASC LIMIT 1`,
    [caso],
  );
  return {
    caso,
    caso_id: bib.rows[0]?.id != null ? Number(bib.rows[0].id) : null,
  };
}

/** Modo (frecuencia) de nombres de caso ya resueltos en memoria. */
export function casoDominanteDeNombres(nombres: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  for (const raw of nombres) {
    const n = String(raw ?? "")
      .replace(/\*/g, "")
      .trim();
    if (!n || n === "—") continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, v] of counts) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}
