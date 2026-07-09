import type { Pool } from "pg";

type Queryable = Pick<Pool, "query">;

export async function getNextNumeroPp(db: Queryable, anio?: number): Promise<string> {
  const year = anio ?? new Date().getFullYear();
  const { rows } = await db.query<{ ultimo: string }>(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_registro, '-', 3) AS INTEGER)), 0)::text AS ultimo
     FROM pedido_proveedor
     WHERE numero_registro ~ '^PP-[0-9]{4}-[0-9]+$'
       AND numero_registro LIKE $1`,
    [`PP-${year}-%`],
  );
  return `PP-${year}-${String(Number(rows[0]?.ultimo ?? 0) + 1).padStart(4, "0")}`;
}
