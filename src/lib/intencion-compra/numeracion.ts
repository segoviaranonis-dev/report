import type { Pool } from "pg";

export async function getNextNumeroRegistro(pool: Pool, anio?: number): Promise<string> {
  const year = anio ?? new Date().getFullYear();
  const { rows } = await pool.query<{ ultimo: string }>(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_registro, '-', 3) AS INTEGER)), 0)::text AS ultimo
     FROM intencion_compra WHERE numero_registro LIKE $1`,
    [`IC-${year}-%`],
  );
  const ultimo = Number(rows[0]?.ultimo ?? 0);
  return `IC-${year}-${String(ultimo + 1).padStart(4, "0")}`;
}

export async function buscarCliente(pool: Pool, idCliente: number): Promise<string | null> {
  const { rows } = await pool.query<{ descp_cliente: string }>(
    "SELECT descp_cliente FROM cliente_v2 WHERE id_cliente = $1 LIMIT 1",
    [idCliente],
  );
  return rows[0]?.descp_cliente ?? null;
}
