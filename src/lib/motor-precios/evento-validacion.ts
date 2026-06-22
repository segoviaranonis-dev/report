import type { Pool } from "pg";
import { contarSkusExcel } from "./evento-sku-staging";

export type CasoValidacionRow = {
  nombre_caso: string;
  dolar_politica: number;
  factor_conversion: number;
  n_skus: number;
  indice_gs: number;
};

export type ValidacionPaso4 = {
  evento_id: number;
  estado: string;
  total_excel: number;
  total_precio_lista: number;
  casos: CasoValidacionRow[];
  ok_cobertura: boolean;
  mensaje: string;
};

export async function getValidacionPaso4(pool: Pool, eventoId: number): Promise<ValidacionPaso4 | null> {
  const { rows: evRows } = await pool.query<{ estado: string }>(
    `SELECT estado FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  if (!evRows[0]) return null;

  const total_excel = await contarSkusExcel(pool, eventoId);

  const { rows: plOnly } = await pool.query<{ n_pl: string }>(
    `SELECT COUNT(*)::text AS n_pl FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );
  const total_precio_lista = Number(plOnly[0]?.n_pl ?? 0);

  const { rows: casosRows } = await pool.query<{
    nombre_caso: string;
    dolar_politica: string;
    factor_conversion: string;
    n_skus: string;
  }>(
    `SELECT pec.nombre_caso, pec.dolar_politica, pec.factor_conversion,
            COUNT(pl.id)::text AS n_skus
     FROM precio_evento_caso pec
     LEFT JOIN precio_lista pl ON pl.caso_id = pec.id AND pl.evento_id = pec.evento_id
     WHERE pec.evento_id = $1
     GROUP BY pec.id, pec.nombre_caso, pec.dolar_politica, pec.factor_conversion
     ORDER BY pec.nombre_caso`,
    [eventoId],
  );

  const casos: CasoValidacionRow[] = casosRows.map((r) => {
    const dolar = Number(r.dolar_politica) || 8000;
    const factor = Number(r.factor_conversion) || 180;
    return {
      nombre_caso: r.nombre_caso,
      dolar_politica: dolar,
      factor_conversion: factor,
      n_skus: Number(r.n_skus ?? 0),
      indice_gs: Math.trunc((dolar * factor) / 100),
    };
  });

  const ok_cobertura = total_precio_lista > 0 && casos.every((c) => c.n_skus >= 0);
  const mensaje =
    total_precio_lista <= 0
      ? "Sin filas en precio_lista — volvé al Paso 3 e iniciá el cálculo."
      : ok_cobertura
        ? `${total_precio_lista} SKUs calculados · listo para validar.`
        : "Revisá casos con 0 SKUs asignados.";

  return {
    evento_id: eventoId,
    estado: evRows[0].estado ?? "borrador",
    total_excel,
    total_precio_lista,
    casos,
    ok_cobertura,
    mensaje,
  };
}

export async function marcarEventoValidado(pool: Pool, eventoId: number): Promise<{ ok: boolean; error?: string }> {
  const val = await getValidacionPaso4(pool, eventoId);
  if (!val) return { ok: false, error: "Evento no encontrado" };
  if (val.total_precio_lista <= 0) {
    return { ok: false, error: "No hay precio_lista — ejecutá Paso 3 primero." };
  }

  const estado = String(val.estado).toLowerCase();
  if (estado === "cerrado") return { ok: false, error: "Evento ya cerrado." };

  await pool.query(
    `UPDATE precio_evento SET estado = 'validado' WHERE id = $1 AND estado <> 'cerrado'`,
    [eventoId],
  );
  return { ok: true };
}
