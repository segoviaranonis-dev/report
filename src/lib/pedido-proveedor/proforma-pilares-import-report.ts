import type { Pool } from "pg";
import type { ProformaRow } from "@/lib/pedido-proveedor/parse-proforma";
import type { ProformaPilaresStats } from "@/lib/pedido-proveedor/proforma-pilares-provision";

export type LineaBibliotecaAsignada = { codigo: string; caso: string };

export type ProformaPilaresImportReport = {
  stats: ProformaPilaresStats;
  lineas_proforma: string[];
  lineas_sin_pilar: string[];
  lineas_sin_biblioteca: string[];
  /** Líneas ya en BCL (no aparecen como libres — revisar caso). */
  lineas_en_biblioteca: LineaBibliotecaAsignada[];
  biblioteca_id: number | null;
  biblioteca_nombre: string | null;
  avisos: string[];
};

export function uniqLineasCodigosFromProforma(rows: ProformaRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const raw = String(r.linea_codigo_proveedor ?? "").trim();
    if (!raw) continue;
    const n = Number.parseInt(raw.split(/[.\s]/)[0]?.replace(/[^\d]/g, "") ?? "", 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    set.add(String(n));
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

export async function getBibliotecaDeEvento(
  pool: Pool,
  eventoId: number,
): Promise<{ id: number; nombre: string } | null> {
  const { rows } = await pool.query<{ id: string; nombre: string }>(
    `SELECT bp.id::text AS id, bp.nombre
     FROM precio_evento pe
     JOIN biblioteca_precio bp ON bp.id = pe.biblioteca_precio_id
     WHERE pe.id = $1 AND bp.activo = true
     LIMIT 1`,
    [eventoId],
  );
  const r = rows[0];
  if (!r) return null;
  return { id: Number(r.id), nombre: r.nombre };
}

/** Líneas del Excel que aún no existen en pilar `linea`. */
export async function listLineasProformaSinPilar(
  pool: Pool,
  proveedorId: number,
  codigos: string[],
): Promise<string[]> {
  if (!codigos.length) return [];
  const { rows } = await pool.query<{ cod: string }>(
    `SELECT t.cod
     FROM unnest($1::text[]) AS t(cod)
     WHERE NOT EXISTS (
       SELECT 1 FROM linea l
       WHERE l.proveedor_id = $2
         AND l.codigo_proveedor::text = t.cod
     )
     ORDER BY t.cod::bigint`,
    [codigos, proveedorId],
  );
  return rows.map((r) => String(Math.trunc(Number(r.cod))));
}

/** Líneas del Excel ya en biblioteca_caso_linea (con nombre de caso). */
export async function listLineasProformaEnBiblioteca(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
  codigos: string[],
): Promise<LineaBibliotecaAsignada[]> {
  if (!codigos.length) return [];
  const { rows } = await pool.query<{ cod: string; nombre_caso: string }>(
    `SELECT DISTINCT t.cod, cpb.nombre_caso
     FROM unnest($1::text[]) AS t(cod)
     INNER JOIN linea l
       ON l.proveedor_id = $2
      AND l.codigo_proveedor::text = t.cod
     INNER JOIN biblioteca_caso_linea bcl
       ON bcl.biblioteca_id = $3 AND bcl.linea_id = l.id
     INNER JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
     ORDER BY t.cod::bigint`,
    [codigos, proveedorId, bibliotecaId],
  );
  return rows.map((r) => ({
    codigo: String(Math.trunc(Number(r.cod))),
    caso: r.nombre_caso,
  }));
}

export async function listLineasProformaSinBiblioteca(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
  codigos: string[],
): Promise<string[]> {
  if (!codigos.length) return [];
  const { rows } = await pool.query<{ cod: string }>(
    `SELECT DISTINCT t.cod
     FROM unnest($1::text[]) AS t(cod)
     INNER JOIN linea l
       ON l.proveedor_id = $2
      AND l.codigo_proveedor::text = t.cod
      AND l.activo = true
     WHERE NOT EXISTS (
       SELECT 1 FROM biblioteca_caso_linea bcl
       WHERE bcl.biblioteca_id = $3 AND bcl.linea_id = l.id
     )
     ORDER BY t.cod::bigint`,
    [codigos, proveedorId, bibliotecaId],
  );
  return rows.map((r) => String(Math.trunc(Number(r.cod))));
}

function fmtCodigos(cods: string[], max = 12): string {
  if (!cods.length) return "";
  if (cods.length <= max) return cods.join(", ");
  return `${cods.slice(0, max).join(", ")}… (+${cods.length - max})`;
}

export function buildPilaresImportAvisos(opts: {
  stats: ProformaPilaresStats;
  lineasProforma: string[];
  sinPilar: string[];
  sinBiblioteca: string[];
  enBiblioteca: LineaBibliotecaAsignada[];
  bibliotecaId: number | null;
  bibliotecaNombre: string | null;
  preview?: boolean;
}): string[] {
  const avisos: string[] = [];
  const { stats } = opts;
  const pref = opts.preview ? "Preview pilares" : "Pilares";

  const partes: string[] = [];
  if (stats.lineas_nuevas > 0) {
    const cods = stats.lineas_nuevas_codigos?.length
      ? fmtCodigos(stats.lineas_nuevas_codigos)
      : `${stats.lineas_nuevas}`;
    partes.push(`${stats.lineas_nuevas} línea(s) nueva(s) (${cods})`);
  }
  if (stats.lineas_enriquecidas > 0) partes.push(`${stats.lineas_enriquecidas} línea(s) enriquecida(s)`);
  if (stats.referencias_nuevas > 0) partes.push(`${stats.referencias_nuevas} referencia(s) nueva(s)`);
  if (stats.linea_referencia_nuevas > 0) partes.push(`${stats.linea_referencia_nuevas} L·R nueva(s)`);
  if (stats.materiales_tocados > 0) partes.push(`${stats.materiales_tocados} material(es)`);
  if (stats.colores_tocados > 0) partes.push(`${stats.colores_tocados} color(es)`);
  if (stats.tonos_asignados > 0) partes.push(`${stats.tonos_asignados} tono(s)`);

  if (partes.length) {
    avisos.push(`✅ ${pref}: ${partes.join(" · ")}.`);
  } else if (opts.lineasProforma.length && !opts.preview) {
    avisos.push(`✅ ${pref}: moléculas cruzadas sin altas nuevas (${opts.lineasProforma.length} línea(s) únicas).`);
  }

  if (opts.sinPilar.length) {
    avisos.push(
      opts.preview
        ? `📥 ${opts.sinPilar.length} línea(s) del Excel se insertarán en pilares al confirmar: ${fmtCodigos(opts.sinPilar)}.`
        : `⚠ ${opts.sinPilar.length} línea(s) aún sin pilar tras import — revisar: ${fmtCodigos(opts.sinPilar)}.`,
    );
  }

  if (opts.sinBiblioteca.length && opts.bibliotecaId) {
    const bib = opts.bibliotecaNombre ?? `bib. ${opts.bibliotecaId}`;
    avisos.push(
      `⛔ ${opts.sinBiblioteca.length} línea(s) sin caso en biblioteca «${bib}»: ${fmtCodigos(opts.sinBiblioteca)} — asigná en Motor → biblioteca (panel líneas libres).`,
    );
  } else if (opts.enBiblioteca.length && opts.bibliotecaId) {
    const bib = opts.bibliotecaNombre ?? `bib. ${opts.bibliotecaId}`;
    const porCaso = new Map<string, string[]>();
    for (const r of opts.enBiblioteca) {
      const arr = porCaso.get(r.caso) ?? [];
      arr.push(r.codigo);
      porCaso.set(r.caso, arr);
    }
    const det = [...porCaso.entries()]
      .map(([caso, cods]) => `${caso}: ${fmtCodigos(cods, 8)}`)
      .join(" · ");
    avisos.push(
      `📚 ${opts.enBiblioteca.length} línea(s) ya en biblioteca «${bib}» (no aparecen como libres): ${det} — revisá/mové al caso correcto (ej. CARTERAS).`,
    );
  } else if (opts.bibliotecaId == null && opts.lineasProforma.length && !opts.preview) {
    avisos.push("ℹ Evento sin biblioteca vinculada — no se pudo listar líneas libres para asignar caso.");
  }

  return avisos;
}

export async function buildProformaPilaresImportReport(
  pool: Pool,
  opts: {
    rows: ProformaRow[];
    proveedorId: number;
    eventoId: number | null;
    stats?: ProformaPilaresStats;
    preview?: boolean;
  },
): Promise<ProformaPilaresImportReport> {
  const lineas_proforma = uniqLineasCodigosFromProforma(opts.rows);
  const stats: ProformaPilaresStats = opts.stats ?? {
    lineas_nuevas: 0,
    lineas_nuevas_codigos: [],
    lineas_enriquecidas: 0,
    referencias_nuevas: 0,
    linea_referencia_nuevas: 0,
    materiales_tocados: 0,
    colores_tocados: 0,
    tonos_asignados: 0,
    duracion_ms: 0,
  };

  const bib = opts.eventoId ? await getBibliotecaDeEvento(pool, opts.eventoId) : null;
  const lineas_sin_pilar = await listLineasProformaSinPilar(pool, opts.proveedorId, lineas_proforma);
  const lineas_sin_biblioteca =
    bib != null
      ? await listLineasProformaSinBiblioteca(pool, bib.id, opts.proveedorId, lineas_proforma)
      : [];
  const lineas_en_biblioteca =
    bib != null
      ? await listLineasProformaEnBiblioteca(pool, bib.id, opts.proveedorId, lineas_proforma)
      : [];

  const avisos = buildPilaresImportAvisos({
    stats,
    lineasProforma: lineas_proforma,
    sinPilar: lineas_sin_pilar,
    sinBiblioteca: bib != null ? lineas_sin_biblioteca : [],
    enBiblioteca: lineas_en_biblioteca,
    bibliotecaId: bib?.id ?? null,
    bibliotecaNombre: bib?.nombre ?? null,
    preview: opts.preview,
  });

  return {
    stats,
    lineas_proforma,
    lineas_sin_pilar,
    lineas_sin_biblioteca,
    lineas_en_biblioteca,
    biblioteca_id: bib?.id ?? null,
    biblioteca_nombre: bib?.nombre ?? null,
    avisos,
  };
}
