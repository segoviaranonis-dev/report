import { getRimecPool } from "@/lib/rimec/pool";
import type { CompraDistribuida, DepositoKpis, DepositoSaldoRow } from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function filtroCl(idCl: number | null): { sql: string; params: unknown[] } {
  if (idCl != null) {
    return {
      sql: `
        AND ppd.pedido_proveedor_id IN (
          SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
          JOIN compra_legal cl ON cl.id = clp.compra_legal_id
          WHERE clp.compra_legal_id = $1 AND cl.estado IN ('DISTRIBUIDA', 'CERRADA')
        )
      `,
      params: [idCl],
    };
  }
  return {
    sql: `
      AND ppd.pedido_proveedor_id IN (
        SELECT clp.pedido_proveedor_id FROM compra_legal_pedido clp
        JOIN compra_legal cl ON cl.id = clp.compra_legal_id
        WHERE cl.estado IN ('DISTRIBUIDA', 'CERRADA')
      )
    `,
    params: [],
  };
}

/** OR-NEXUS-DEPOSITO-RIMEC-CONSISTENCIA-001 — vendido desde factura_interna_detalle */
export async function getStockDeposito(idCl: number | null = null): Promise<DepositoSaldoRow[]> {
  const pool = getRimecPool();
  const { sql: filtro, params } = filtroCl(idCl);

  const { rows } = await pool.query<DepositoSaldoRow>(
    `
    SELECT ppd_id, marca, pedido, linea::text AS linea, referencia::text AS referencia,
           material, color, grada, cantidad_inicial::int, vendido::int, saldo::int
    FROM (
      SELECT ppd.id AS ppd_id,
             COALESCE(mv.descp_marca, '—') AS marca,
             pp.numero_registro AS pedido,
             ppd.linea, ppd.referencia, ppd.descp_material AS material,
             ppd.descp_color AS color, COALESCE(ppd.grada, '—') AS grada,
             ppd.cantidad_pares AS cantidad_inicial,
             COALESCE(
               (SELECT SUM(fid.pares) FROM factura_interna_detalle fid
                JOIN factura_interna fi ON fi.id = fid.factura_id
                WHERE fid.ppd_id = ppd.id AND fi.estado != 'ANULADA'),
               0
             ) AS vendido,
             ppd.cantidad_pares - COALESCE(
               (SELECT SUM(fid.pares) FROM factura_interna_detalle fid
                JOIN factura_interna fi ON fi.id = fid.factura_id
                WHERE fid.ppd_id = ppd.id AND fi.estado != 'ANULADA'),
               0
             ) AS saldo
      FROM pedido_proveedor_detalle ppd
      JOIN pedido_proveedor pp ON pp.id = ppd.pedido_proveedor_id
      LEFT JOIN marca_v2 mv ON mv.id_marca = ppd.id_marca
      WHERE ppd.linea IS NOT NULL AND ppd.cantidad_pares > 0
        ${filtro}
    ) sub
    WHERE saldo > 0
    ORDER BY marca, pedido, linea, referencia, material, color, grada
    `,
    params,
  );

  return rows.map((r) => ({
    ...r,
    cantidad_inicial: num(r.cantidad_inicial),
    vendido: num(r.vendido),
    saldo: num(r.saldo),
  }));
}

export async function getComprasDistribuidas(): Promise<CompraDistribuida[]> {
  const pool = getRimecPool();
  const { rows } = await pool.query<CompraDistribuida>(
    `SELECT id, numero_registro, estado FROM compra_legal
     WHERE estado IN ('DISTRIBUIDA', 'CERRADA', 'ENVIADO') ORDER BY id DESC`,
  );
  return rows;
}

export function summarizeDeposito(rows: DepositoSaldoRow[]): DepositoKpis {
  return {
    filas: rows.length,
    total_inicial: rows.reduce((a, r) => a + r.cantidad_inicial, 0),
    total_vendido: rows.reduce((a, r) => a + r.vendido, 0),
    total_saldo: rows.reduce((a, r) => a + r.saldo, 0),
  };
}
