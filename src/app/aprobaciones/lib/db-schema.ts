/**
 * Verificación schema Aprobaciones — columna fecha_confirmacion + trigger.
 */
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";

export type AprobacionesDbHealth = {
  ok: boolean;
  fechaConfirmacionColumn: boolean;
  triggerActivo: boolean;
  mensaje: string;
};

let cached: AprobacionesDbHealth | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export async function checkAprobacionesDbSchema(): Promise<AprobacionesDbHealth> {
  if (!isRimecDatabaseConfigured()) {
    return {
      ok: false,
      fechaConfirmacionColumn: false,
      triggerActivo: false,
      mensaje: "DATABASE_URL no configurada",
    };
  }

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;

  const pool = getRimecPool();
  const [colRes, trigRes] = await Promise.all([
    pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'factura_interna'
        AND column_name = 'fecha_confirmacion'
      LIMIT 1
    `),
    pool.query(`
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_fi_fecha_confirmacion'
      LIMIT 1
    `),
  ]);

  const fechaConfirmacionColumn = colRes.rowCount !== null && colRes.rowCount > 0;
  const triggerActivo = trigRes.rowCount !== null && trigRes.rowCount > 0;
  const ok = fechaConfirmacionColumn && triggerActivo;

  cached = {
    ok,
    fechaConfirmacionColumn,
    triggerActivo,
    mensaje: ok
      ? "Schema Aprobaciones OK"
      : !fechaConfirmacionColumn
        ? "Falta columna fecha_confirmacion — ejecutar migrations/114"
        : "Falta trigger trg_fi_fecha_confirmacion — ejecutar migrations/114",
  };
  cachedAt = now;
  return cached;
}

export function invalidateAprobacionesDbSchemaCache(): void {
  cached = null;
  cachedAt = 0;
}
