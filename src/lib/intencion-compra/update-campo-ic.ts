import type { Pool } from "pg";
import { FECHA_DE_EMBARQUE_CAMPO, quincenaDbValue } from "./quincena-arribo";

const CAMPOS_PERMITIDOS = new Set([
  "tipo_id",
  "categoria_id",
  "id_marca",
  "fecha_llegada",
  FECHA_DE_EMBARQUE_CAMPO,
  "cantidad_total_pares",
  "precio_evento_id",
  "nota_pedido",
  "monto_neto",
]);

function normalizeValor(campo: string, valor: unknown): unknown {
  if (campo === FECHA_DE_EMBARQUE_CAMPO) {
    const n = Number(valor);
    return quincenaDbValue(Number.isFinite(n) ? n : 0);
  }
  if (campo === "precio_evento_id" && (valor === "" || valor === 0 || valor === "0")) return null;
  if (campo === "cantidad_total_pares") return Math.max(0, Math.trunc(Number(valor) || 0));
  if (campo === "monto_neto") return Math.max(0, Number(valor) || 0);
  if (campo === "nota_pedido") return valor === "" ? null : valor;
  return valor;
}

export async function updateCampoIc(
  pool: Pool,
  icId: number,
  campo: string,
  valor: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!CAMPOS_PERMITIDOS.has(campo)) {
    return { ok: false, error: `Campo no permitido: ${campo}` };
  }

  const v = normalizeValor(campo, valor);
  const { rowCount } = await pool.query(
    `UPDATE intencion_compra SET ${campo} = $1
     WHERE id = $2 AND estado IN ('PENDIENTE_OPERATIVO', 'DEVUELTO_ADMIN')`,
    [v, icId],
  );

  if (!rowCount) {
    return { ok: false, error: "IC no editable (estado o id inválido)" };
  }
  return { ok: true };
}
