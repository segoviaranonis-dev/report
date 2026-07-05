import type { Pool } from "pg";

export type DepositoProcesoRow = {
  id: number;
  marca: string;
  pp: string;
  lr: string;
  material: string;
  color: string;
  grada: string;
  inicial: number;
  vendido: number;
  saldo: number;
};

export type DepositoProcesoSummary = {
  moleculas: number;
  pares_inicial: number;
  vendido: number;
  saldo: number;
};

export type CompraLegalOption = {
  id: number;
  numero_registro: string;
  estado: string;
};

export async function listComprasDistribuidas(pool: Pool): Promise<CompraLegalOption[]> {
  const { rows } = await pool.query<{
    id: string;
    numero_registro: string;
    estado: string;
  }>(
    `
    SELECT cl.id, cl.numero_registro, cl.estado
    FROM compra_legal cl
    WHERE EXISTS (
      SELECT 1 FROM compra_legal_pedido clp WHERE clp.compra_legal_id = cl.id
    )
    ORDER BY cl.id DESC
    LIMIT 200
    `,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    numero_registro: r.numero_registro,
    estado: r.estado,
  }));
}

export async function getSaldoProceso(
  pool: Pool,
  compraLegalId?: number,
): Promise<{ rows: DepositoProcesoRow[]; summary: DepositoProcesoSummary }> {
  const params: unknown[] = [];
  let clFilter = "";
  if (compraLegalId != null && Number.isFinite(compraLegalId)) {
    params.push(compraLegalId);
    clFilter = `
      AND pp.id IN (
        SELECT clp.pedido_proveedor_id
        FROM compra_legal_pedido clp
        WHERE clp.compra_legal_id = $1
      )
    `;
  } else {
    clFilter = `AND pp.estado_transito = 'EN_DEPOSITO'`;
  }

  const { rows } = await pool.query<{
    id: string;
    marca: string;
    pp: string;
    lr: string;
    material: string;
    color: string;
    grada: string | null;
    inicial: string;
    vendido: string;
    saldo: string;
  }>(
    `
    SELECT
      ppd.id,
      COALESCE(mv.descp_marca, '—') AS marca,
      pp.numero_registro AS pp,
      TRIM(BOTH FROM CONCAT(ppd.linea, '.', ppd.referencia)) AS lr,
      COALESCE(ppd.descp_material, '—') AS material,
      COALESCE(ppd.descp_color, '—') AS color,
      COALESCE(ppd.grada, '—') AS grada,
      COALESCE(ppd.cantidad_pares, 0)::text AS inicial,
      GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE(SUM(vt.cantidad_vendida), 0)
      )::text AS vendido,
      (
        COALESCE(ppd.cantidad_pares, 0) - GREATEST(
          COALESCE(ppd.pares_vendidos, 0),
          COALESCE(SUM(vt.cantidad_vendida), 0)
        )
      )::text AS saldo
    FROM pedido_proveedor_detalle ppd
    JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
    LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
    LEFT JOIN venta_transito vt ON vt.pedido_proveedor_detalle_id = ppd.id
    WHERE ppd.referencia IS NOT NULL
      ${clFilter}
    GROUP BY ppd.id, mv.descp_marca, pp.numero_registro, ppd.linea, ppd.referencia,
             ppd.descp_material, ppd.descp_color, ppd.grada,
             ppd.cantidad_pares, ppd.pares_vendidos
    HAVING (
      COALESCE(ppd.cantidad_pares, 0) - GREATEST(
        COALESCE(ppd.pares_vendidos, 0),
        COALESCE(SUM(vt.cantidad_vendida), 0)
      )
    ) > 0
    ORDER BY pp.numero_registro, ppd.id
    LIMIT 5000
    `,
    params,
  );

  const mapped: DepositoProcesoRow[] = rows.map((r) => ({
    id: Number(r.id),
    marca: r.marca,
    pp: r.pp,
    lr: r.lr,
    material: r.material,
    color: r.color,
    grada: r.grada ?? "—",
    inicial: Number(r.inicial ?? 0),
    vendido: Number(r.vendido ?? 0),
    saldo: Number(r.saldo ?? 0),
  }));

  const summary = mapped.reduce<DepositoProcesoSummary>(
    (acc, r) => ({
      moleculas: acc.moleculas + 1,
      pares_inicial: acc.pares_inicial + r.inicial,
      vendido: acc.vendido + r.vendido,
      saldo: acc.saldo + r.saldo,
    }),
    { moleculas: 0, pares_inicial: 0, vendido: 0, saldo: 0 },
  );

  return { rows: mapped, summary };
}
