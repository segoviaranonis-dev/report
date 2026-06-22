import type { Pool } from "pg";
import { calcIndiceGs } from "./caso-utils";
import { contarSkusExcel } from "./evento-sku-staging";
import { esBibliotecaCanonica } from "./constants";

export type CasoEventoRow = {
  id: number;
  nombre_caso: string;
  dolar_politica: number;
  factor_conversion: number;
  descuento_1: number | null;
  descuento_2: number | null;
  descuento_3: number | null;
  descuento_4: number | null;
  genera_lpc03_lpc04: boolean;
  lineas_count: number;
  indice_gs: number;
};

export type PrecioEventoDetalle = {
  id: number;
  nombre_evento: string;
  nombre_archivo: string;
  fecha_vigencia_desde: string;
  proveedor_id: number;
  estado: string;
  biblioteca_precio_id: number | null;
  biblioteca: {
    id: number;
    nombre: string;
    casos_count: number;
    lineas_count: number;
    canonica: boolean;
  } | null;
  matriz: {
    casos_count: number;
    lineas_count: number;
    skus_count: number;
    excel_skus_count: number;
    casos: CasoEventoRow[];
  };
};

export async function getPrecioEventoDetalle(pool: Pool, eventoId: number): Promise<PrecioEventoDetalle | null> {
  const { rows: evRows } = await pool.query<{
    id: string;
    nombre_evento: string;
    nombre_archivo: string;
    fecha_vigencia_desde: Date;
    proveedor_id: string;
    estado: string;
    biblioteca_precio_id: string | null;
  }>(
    `SELECT id, nombre_evento, nombre_archivo, fecha_vigencia_desde,
            proveedor_id, estado, biblioteca_precio_id
     FROM precio_evento
     WHERE id = $1`,
    [eventoId],
  );
  const ev = evRows[0];
  if (!ev) return null;

  const bibliotecaId = ev.biblioteca_precio_id ? Number(ev.biblioteca_precio_id) : null;
  let biblioteca: PrecioEventoDetalle["biblioteca"] = null;

  if (bibliotecaId) {
    const { rows: bibRows } = await pool.query<{
      id: string;
      nombre: string;
      casos_count: string;
      lineas_count: string;
    }>(
      `SELECT bp.id, bp.nombre,
              COALESCE(c.cnt, 0)::text AS casos_count,
              COALESCE(l.cnt, 0)::text AS lineas_count
       FROM biblioteca_precio bp
       LEFT JOIN (
         SELECT biblioteca_id, COUNT(*) AS cnt
         FROM caso_precio_biblioteca WHERE activo = true GROUP BY biblioteca_id
       ) c ON c.biblioteca_id = bp.id
       LEFT JOIN (
         SELECT biblioteca_id, COUNT(*) AS cnt FROM biblioteca_caso_linea GROUP BY biblioteca_id
       ) l ON l.biblioteca_id = bp.id
       WHERE bp.id = $1`,
      [bibliotecaId],
    );
    const b = bibRows[0];
    if (b) {
      biblioteca = {
        id: Number(b.id),
        nombre: b.nombre,
        casos_count: Number(b.casos_count),
        lineas_count: Number(b.lineas_count),
        canonica: esBibliotecaCanonica(b.nombre),
      };
    }
  }

  const { rows: casosRows } = await pool.query<{
    id: string;
    nombre_caso: string;
    dolar_politica: string;
    factor_conversion: string;
    descuento_1: string | null;
    descuento_2: string | null;
    descuento_3: string | null;
    descuento_4: string | null;
    genera_lpc03_lpc04: boolean;
    lineas_count: string;
  }>(
    `SELECT pec.id, pec.nombre_caso, pec.dolar_politica, pec.factor_conversion,
            pec.descuento_1, pec.descuento_2, pec.descuento_3, pec.descuento_4,
            pec.genera_lpc03_lpc04,
            COALESCE(l.cnt, 0)::text AS lineas_count
     FROM precio_evento_caso pec
     LEFT JOIN (
       SELECT caso_id, COUNT(*) AS cnt
       FROM precio_evento_linea_excepcion
       GROUP BY caso_id
     ) l ON l.caso_id = pec.id
     WHERE pec.evento_id = $1
     ORDER BY pec.nombre_caso`,
    [eventoId],
  );

  const { rows: skusRows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );

  const { rows: lineasRows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM precio_evento_linea_excepcion pele
     JOIN precio_evento_caso pec ON pec.id = pele.caso_id
     WHERE pec.evento_id = $1`,
    [eventoId],
  );

  const excelSkusCount = await contarSkusExcel(pool, eventoId);

  const casos: CasoEventoRow[] = casosRows.map((r) => {
    const dolar = Number(r.dolar_politica) || 8000;
    const factor = Number(r.factor_conversion) || 180;
    return {
      id: Number(r.id),
      nombre_caso: r.nombre_caso,
      dolar_politica: dolar,
      factor_conversion: factor,
      descuento_1: r.descuento_1 != null ? Number(r.descuento_1) : null,
      descuento_2: r.descuento_2 != null ? Number(r.descuento_2) : null,
      descuento_3: r.descuento_3 != null ? Number(r.descuento_3) : null,
      descuento_4: r.descuento_4 != null ? Number(r.descuento_4) : null,
      genera_lpc03_lpc04: r.genera_lpc03_lpc04 !== false,
      lineas_count: Number(r.lineas_count),
      indice_gs: calcIndiceGs(dolar, factor),
    };
  });

  return {
    id: Number(ev.id),
    nombre_evento: ev.nombre_evento,
    nombre_archivo: ev.nombre_archivo,
    fecha_vigencia_desde: ev.fecha_vigencia_desde.toISOString().slice(0, 10),
    proveedor_id: Number(ev.proveedor_id),
    estado: ev.estado ?? "borrador",
    biblioteca_precio_id: bibliotecaId,
    biblioteca,
    matriz: {
      casos_count: casos.length,
      lineas_count: Number(lineasRows[0]?.n ?? 0),
      skus_count: Number(skusRows[0]?.n ?? 0),
      excel_skus_count: excelSkusCount,
      casos,
    },
  };
}
