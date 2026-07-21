import type { Pool } from "pg";
import {
  loadCasosBibliotecaNombres,
  loadMapaCasoPorLineaBiblioteca,
  loadMapaCasoPorLineaEvento,
} from "@/lib/motor-precios/caso-linea-evento";
import { loadCasosEventoNombres } from "@/lib/pedido-proveedor/resolve-caso-comercial";

export type PpCasoContextFuente = "biblioteca" | "evento" | "none";

export type PpCasoContext = {
  mapaCasoLinea: Map<string, string>;
  casosEvento: Set<string>;
  fuente: PpCasoContextFuente;
  bibliotecaId: number | null;
  eventoId: number | null;
};

/** Caso comercial PP: biblioteca cabecera manda; si no hay, PELE del evento IC. */
export async function loadPpCasoContext(pool: Pool, ppId: number): Promise<PpCasoContext> {
  const { rows } = await pool.query<{ biblioteca_precio_id: number | null; evento_id: number | null }>(
    `SELECT pp.biblioteca_precio_id::int,
            (SELECT icp.precio_evento_id::int
             FROM intencion_compra_pedido icp
             WHERE icp.pedido_proveedor_id = pp.id AND icp.precio_evento_id IS NOT NULL
             ORDER BY icp.id LIMIT 1) AS evento_id
     FROM pedido_proveedor pp
     WHERE pp.id = $1`,
    [ppId],
  );
  const bibliotecaId = rows[0]?.biblioteca_precio_id ?? null;
  const eventoId = rows[0]?.evento_id ?? null;

  if (bibliotecaId) {
    const [mapaCasoLinea, casosEvento] = await Promise.all([
      loadMapaCasoPorLineaBiblioteca(pool, bibliotecaId),
      loadCasosBibliotecaNombres(pool, bibliotecaId),
    ]);
    return { mapaCasoLinea, casosEvento, fuente: "biblioteca", bibliotecaId, eventoId };
  }

  if (eventoId) {
    const [mapaCasoLinea, casosEvento] = await Promise.all([
      loadMapaCasoPorLineaEvento(pool, eventoId),
      loadCasosEventoNombres(pool, eventoId),
    ]);
    return { mapaCasoLinea, casosEvento, fuente: "evento", bibliotecaId: null, eventoId };
  }

  return {
    mapaCasoLinea: new Map(),
    casosEvento: new Set(),
    fuente: "none",
    bibliotecaId: null,
    eventoId: null,
  };
}
