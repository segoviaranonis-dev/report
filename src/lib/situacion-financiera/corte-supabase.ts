/**
 * Ola 3 — Leer sf_corte cerrado + sf_sit_fin_linea desde Postgres.
 * Si tablas no existen o DB cae → null (fallback demo/pipeline).
 */

import {
  getRimecPool,
  isRimecDatabaseConfigured,
} from "@/lib/rimec/pool";

export type SfCorteCerradoDb = {
  corteId: number;
  batchId: string;
  fechaAl: string;
  tasaUsd: number | null;
  estado: string;
  fuente: string;
  lineas: {
    mesYm: string | null;
    concepto: string;
    importeGs: number;
    origen: string;
  }[];
};

export async function loadCorteCerradoSupabase(): Promise<SfCorteCerradoDb | null> {
  if (!isRimecDatabaseConfigured()) return null;
  try {
    const pool = getRimecPool();
    const corteRes = await pool.query<{
      id: number;
      batch_id: string;
      fecha_al: Date | string;
      tasa_usd: string | number | null;
      estado: string;
    }>(
      `SELECT id, batch_id::text, fecha_al, tasa_usd, estado
       FROM public.sf_corte
       WHERE estado = 'cerrado'
       ORDER BY fecha_al DESC, id DESC
       LIMIT 1`
    );
    if (!corteRes.rows.length) return null;
    const c = corteRes.rows[0];
    const linRes = await pool.query<{
      mes_ym: string | null;
      concepto: string;
      importe_gs: string | number;
      origen: string;
    }>(
      `SELECT mes_ym, concepto, importe_gs, origen
       FROM public.sf_sit_fin_linea
       WHERE corte_id = $1
       ORDER BY id`,
      [c.id]
    );
    const fecha =
      typeof c.fecha_al === "string"
        ? c.fecha_al.slice(0, 10)
        : c.fecha_al.toISOString().slice(0, 10);
    return {
      corteId: c.id,
      batchId: c.batch_id,
      fechaAl: fecha,
      tasaUsd: c.tasa_usd == null ? null : Number(c.tasa_usd),
      estado: c.estado,
      fuente: `supabase · sf_corte #${c.id} · batch ${c.batch_id}`,
      lineas: linRes.rows.map((r) => ({
        mesYm: r.mes_ym,
        concepto: r.concepto,
        importeGs: Number(r.importe_gs) || 0,
        origen: r.origen,
      })),
    };
  } catch {
    // tabla ausente / red — no romper UI
    return null;
  }
}

/** Snapshot LAB local (JSON) escrito por _export_corte_cerrado_lab.py */
export type SfCorteCerradoLab = SfCorteCerradoDb;

export async function loadCorteCerradoLabFile(
  readFile: (p: string) => Promise<string>
): Promise<SfCorteCerradoLab | null> {
  try {
    const raw = await readFile(
      "scripts/situacion-financiera/data/catalogo_local/corte_cerrado_lab.json"
    );
    const j = JSON.parse(raw) as SfCorteCerradoLab;
    if (!j?.lineas?.length) return null;
    return j;
  } catch {
    return null;
  }
}
