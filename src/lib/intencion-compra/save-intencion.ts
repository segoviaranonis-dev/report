import type { Pool } from "pg";
import { calcularNeto } from "./calcular-neto";
import { getNextNumeroRegistro } from "./numeracion";
import { quincenaDbValue } from "./quincena-arribo";

export type SaveIntencionInput = {
  id_proveedor: number;
  id_cliente: number;
  id_vendedor: number;
  id_marca: number;
  id_plazo?: number | null;
  tipo_id: number;
  categoria_id: number;
  cantidad_total_pares: number;
  monto_bruto?: number;
  descuento_1?: number;
  descuento_2?: number;
  descuento_3?: number;
  descuento_4?: number;
  fecha_registro: string;
  quincena_arribo_id?: number | null;
  nota_pedido?: string | null;
  observaciones?: string | null;
  precio_evento_id?: number | null;
  listado_precio_id?: number | null;
  comision_vendedor_id?: number | null;
  comision_porcentaje_snap?: number | null;
};

export async function saveIntencion(
  pool: Pool,
  data: SaveIntencionInput,
): Promise<{ ok: true; numero_registro: string; id: number } | { ok: false; error: string }> {
  if (!data.cantidad_total_pares || data.cantidad_total_pares <= 0) {
    return { ok: false, error: "Ingresá la cantidad de pares antes de registrar." };
  }
  const quincena = quincenaDbValue(data.quincena_arribo_id ?? 0);
  if (!quincena) {
    return { ok: false, error: "La FECHA DE EMBARQUE (quincena) es obligatoria." };
  }

  const cliente = await pool.query("SELECT 1 FROM cliente_v2 WHERE id_cliente = $1", [data.id_cliente]);
  if (!cliente.rowCount) {
    return { ok: false, error: `El código de cliente ${data.id_cliente} no existe.` };
  }

  const vendedor = await pool.query("SELECT 1 FROM vendedor_v2 WHERE id_vendedor = $1", [data.id_vendedor]);
  if (!vendedor.rowCount) {
    return { ok: false, error: `El vendedor ${data.id_vendedor} no existe en vendedor_v2.` };
  }

  const bruto = Number(data.monto_bruto ?? 0);
  const d1 = Number(data.descuento_1 ?? 0);
  const d2 = Number(data.descuento_2 ?? 0);
  const d3 = Number(data.descuento_3 ?? 0);
  const d4 = Number(data.descuento_4 ?? 0);
  const neto = calcularNeto(bruto, d1, d2, d3, d4);
  const numero = await getNextNumeroRegistro(pool);

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO intencion_compra (
        numero_registro, id_proveedor, id_cliente, id_vendedor, id_marca, id_plazo,
        tipo_id, categoria_id, cantidad_total_pares,
        monto_bruto, descuento_1, descuento_2, descuento_3, descuento_4,
        monto_neto, fecha_registro, quincena_arribo_id,
        estado, nota_pedido, observaciones, precio_evento_id,
        listado_precio_id, comision_vendedor_id, comision_porcentaje_snap
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        'PENDIENTE_OPERATIVO',$18,$19,$20,$21,$22,$23
      ) RETURNING id`,
      [
        numero,
        data.id_proveedor,
        data.id_cliente,
        data.id_vendedor,
        data.id_marca,
        data.id_plazo ?? null,
        data.tipo_id,
        data.categoria_id,
        data.cantidad_total_pares,
        bruto,
        d1,
        d2,
        d3,
        d4,
        neto,
        data.fecha_registro,
        quincena,
        data.nota_pedido ?? null,
        data.observaciones ?? null,
        data.precio_evento_id ?? null,
        data.listado_precio_id ?? null,
        data.comision_vendedor_id ?? null,
        data.comision_porcentaje_snap ?? null,
      ],
    );
    return { ok: true, numero_registro: numero, id: Number(rows[0].id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error en INSERT";
    return { ok: false, error: msg };
  }
}
