import type { Pool } from "pg";
import {
  agregarLineasCasoBiblioteca,
  loadBibliotecaEditor,
} from "./biblioteca-editor";
import { reemplazarLineasExcepcion } from "./evento-matriz";
import { asegurarLineaEnPilar } from "./evento-pilares";

export type AsignarLineasPreviewResult =
  | { ok: true; lineas: string[]; caso_biblioteca_id: number; caso_evento_id: number }
  | { ok: false; error: string };

async function casoBibliotecaIdDesdeEventoCaso(
  pool: Pool,
  eventoId: number,
  casoEventoId: number,
  bibliotecaId: number,
): Promise<number | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT cpb.id
     FROM precio_evento_caso pec
     JOIN caso_precio_biblioteca cpb
       ON cpb.biblioteca_id = $3
      AND cpb.activo = true
      AND UPPER(TRIM(cpb.nombre_caso)) = UPPER(TRIM(pec.nombre_caso))
     WHERE pec.id = $1 AND pec.evento_id = $2
     LIMIT 1`,
    [casoEventoId, eventoId, bibliotecaId],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function lineasBclCaso(
  pool: Pool,
  bibliotecaId: number,
  casoBibliotecaId: number,
): Promise<string[]> {
  const { rows } = await pool.query<{ cod: string }>(
    `SELECT l.codigo_proveedor::text AS cod
     FROM biblioteca_caso_linea bcl
     JOIN linea l ON l.id = bcl.linea_id
     WHERE bcl.biblioteca_id = $1 AND bcl.caso_biblioteca_id = $2
     ORDER BY l.codigo_proveedor`,
    [bibliotecaId, casoBibliotecaId],
  );
  return rows.map((r) => String(Math.trunc(Number(r.cod))));
}

/**
 * Preview operativo — asigna códigos pilar línea al caso en biblioteca (BCL)
 * y sincroniza precio_evento_linea_excepcion del evento. Alta línea en pilar si falta.
 */
export async function asignarLineasPreviewACaso(
  pool: Pool,
  opts: {
    eventoId: number;
    proveedorId: number;
    bibliotecaId: number;
    casoEventoId: number;
    lineasCodigo: string[];
    marcaPorLinea: Record<string, string>;
  },
): Promise<AsignarLineasPreviewResult> {
  const { eventoId, proveedorId, bibliotecaId, casoEventoId, lineasCodigo, marcaPorLinea } = opts;

  const codigos = [...new Set(lineasCodigo.map((c) => String(Math.trunc(Number(c)))).filter((c) => c && c !== "NaN"))];
  if (!codigos.length) {
    return { ok: false, error: "Sin códigos de línea válidos." };
  }

  const casoBibId = await casoBibliotecaIdDesdeEventoCaso(pool, eventoId, casoEventoId, bibliotecaId);
  if (!casoBibId) {
    return { ok: false, error: "No se encontró el caso en la biblioteca vinculada al evento." };
  }

  for (const cod of codigos) {
    const n = parseInt(cod, 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const marca = marcaPorLinea[cod] ?? "BEIRA RIO";
    await asegurarLineaEnPilar(pool, proveedorId, n, marca);
  }

  const merged = await agregarLineasCasoBiblioteca(
    pool,
    bibliotecaId,
    casoBibId,
    proveedorId,
    codigos,
  );
  if (!merged.ok) {
    return { ok: false, error: merged.error ?? "No se pudo guardar en biblioteca." };
  }

  const lineasSync = await lineasBclCaso(pool, bibliotecaId, casoBibId);
  await reemplazarLineasExcepcion(pool, casoEventoId, lineasSync, proveedorId, eventoId);

  const editor = await loadBibliotecaEditor(pool, bibliotecaId, proveedorId);
  const caso = editor?.casos.find((c) => c.id === casoBibId);

  return {
    ok: true,
    lineas: caso?.lineas ?? lineasSync,
    caso_biblioteca_id: casoBibId,
    caso_evento_id: casoEventoId,
  };
}
