import type { Pool } from "pg";
import { validarExclusividadCasosLineas } from "./caso-utils";
import { loadBibliotecaEditor } from "./biblioteca-editor";
import { persistirCasoMatrizEvento, vaciarMatrizEvento } from "./evento-matriz";

/** Paridad Streamlit `vincular_biblioteca_a_evento`. */
export async function vincularBibliotecaAEvento(
  pool: Pool,
  eventoId: number,
  bibliotecaId: number | null,
): Promise<void> {
  if (bibliotecaId == null) return;
  await pool.query(`UPDATE precio_evento SET biblioteca_precio_id = $1 WHERE id = $2`, [
    bibliotecaId,
    eventoId,
  ]);
}

export type AplicarBibliotecaResult =
  | { ok: true; n_casos: number; biblioteca_id: number }
  | { ok: false; error: string; n_casos?: number };

/**
 * Paridad Streamlit `aplicar_biblioteca_a_evento`.
 * Copia casos + líneas BCL → precio_evento_caso + precio_evento_linea_excepcion
 * y persiste FK precio_evento.biblioteca_precio_id.
 */
export async function aplicarBibliotecaAEvento(
  pool: Pool,
  eventoId: number,
  proveedorId: number,
  bibliotecaId: number,
  reemplazarMatriz = true,
): Promise<AplicarBibliotecaResult> {
  const editor = await loadBibliotecaEditor(pool, bibliotecaId, proveedorId);
  if (!editor) {
    return { ok: false, error: "No se pudo cargar la biblioteca." };
  }

  if (editor.casos.length === 0) {
    return { ok: false, error: "La biblioteca no tiene casos activos para copiar." };
  }

  const conflictos = validarExclusividadCasosLineas(editor.casos);
  if (conflictos.length) {
    return { ok: false, error: `Biblioteca inconsistente: ${conflictos[0]}` };
  }

  if (reemplazarMatriz) {
    const vacio = await vaciarMatrizEvento(pool, eventoId);
    if (!vacio.ok && vacio.error) {
      return { ok: false, error: vacio.error };
    }
  }

  const { rows: marcasRows } = await pool.query<{ id: string; marcas: string[] | null }>(
    `SELECT id, marcas
     FROM caso_precio_biblioteca
     WHERE biblioteca_id = $1 AND activo = true`,
    [bibliotecaId],
  );
  const marcasPorCaso = new Map<number, { marcas: string[] | null }>();
  for (const r of marcasRows) {
    marcasPorCaso.set(Number(r.id), { marcas: r.marcas });
  }

  let nCasos = 0;
  for (const caso of editor.casos) {
    const extra = marcasPorCaso.get(caso.id);
    const { error } = await persistirCasoMatrizEvento(pool, eventoId, proveedorId, {
      nombre_caso: caso.nombre_caso,
      dolar_politica: caso.dolar_politica,
      factor_conversion: caso.factor_conversion,
      descuento_1: caso.descuento_1,
      descuento_2: caso.descuento_2,
      descuento_3: caso.descuento_3,
      descuento_4: caso.descuento_4,
      genera_lpc03_lpc04: caso.genera_lpc03_lpc04,
      lineas: caso.lineas,
      marcas: extra?.marcas ?? null,
      regla_redondeo: "centena",
    });
    if (error) {
      return { ok: false, error, n_casos: nCasos };
    }
    nCasos += 1;
  }

  await vincularBibliotecaAEvento(pool, eventoId, bibliotecaId);
  return { ok: true, n_casos: nCasos, biblioteca_id: bibliotecaId };
}
