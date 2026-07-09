import type { Pool, PoolClient } from "pg";
import type { ProformaRow } from "./parse-proforma";

let tableReady = false;

export async function ensureProformaFilasTable(pool: Pool | PoolClient): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pp_proforma_filas (
      pp_id bigint PRIMARY KEY REFERENCES pedido_proveedor(id) ON DELETE CASCADE,
      filas jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

export async function saveProformaFilas(
  client: Pool | PoolClient,
  ppId: number,
  filas: ProformaRow[],
): Promise<void> {
  await ensureProformaFilasTable(client);
  await client.query(
    `INSERT INTO pp_proforma_filas (pp_id, filas, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (pp_id) DO UPDATE SET filas = EXCLUDED.filas, updated_at = now()`,
    [ppId, JSON.stringify(filas)],
  );
}

export async function loadProformaFilas(pool: Pool | PoolClient, ppId: number): Promise<ProformaRow[] | null> {
  await ensureProformaFilasTable(pool);
  const { rows } = await pool.query<{ filas: ProformaRow[] | string }>(
    "SELECT filas FROM pp_proforma_filas WHERE pp_id = $1",
    [ppId],
  );
  const raw = rows[0]?.filas;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ProformaRow[];
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? (raw as ProformaRow[]) : null;
}

export async function hasProformaFilas(pool: Pool | PoolClient, ppId: number): Promise<boolean> {
  await ensureProformaFilasTable(pool);
  const { rows } = await pool.query<{ ok: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pp_proforma_filas WHERE pp_id = $1) AS ok",
    [ppId],
  );
  return rows[0]?.ok === true;
}
