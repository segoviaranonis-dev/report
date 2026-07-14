import type { Pool } from "pg";

import {

  getCompraPreviaKpiCanon,

  SQL_MOL_CP_BASE,

} from "@/lib/panel-control/compra-previa-canonical";



export type TransitoResumenQuincena = {

  quincena_arribo_id: number;

  label: string;

  pp_count: number;

  pares_saldo: number;

  pares_vendidos: number;

  pares_inicial: number;

};



export type StockTransitoResumen = {

  pedidos_pp: number;

  moleculas: number;

  pares_inicial: number;

  pares_vendidos: number;

  pares_saldo: number;

  por_quincena: TransitoResumenQuincena[];

};



export async function getStockTransitoResumen(pool: Pool): Promise<StockTransitoResumen> {

  const [kpi, quincenasQ] = await Promise.all([

    getCompraPreviaKpiCanon(pool),

    pool.query<{

      quincena_id: string;

      label: string;

      pp_count: string;

      inicial: string;

      vendido: string;

      saldo: string;

    }>(

      `

      ${SQL_MOL_CP_BASE}

      SELECT

        COALESCE(m.quincena_arribo_id, 0)::text AS quincena_id,

        COALESCE(qa.descripcion, 'Sin quincena') AS label,

        COUNT(DISTINCT m.pp_id)::text AS pp_count,

        COALESCE(SUM(m.inicial), 0)::text AS inicial,

        COALESCE(SUM(m.vendido), 0)::text AS vendido,

        COALESCE(SUM(m.inicial - m.vendido), 0)::text AS saldo

      FROM mol_activa m

      LEFT JOIN quincena_arribo qa ON qa.id = m.quincena_arribo_id

      GROUP BY m.quincena_arribo_id, qa.descripcion

      ORDER BY m.quincena_arribo_id NULLS LAST

      `,

    ),

  ]);



  return {

    pedidos_pp: kpi.pedidos_abiertos,

    moleculas: kpi.moleculas,

    pares_inicial: kpi.pares_inicial,

    pares_vendidos: kpi.pares_vendidos,

    pares_saldo: kpi.pares_saldo,

    por_quincena: quincenasQ.rows.map((r) => ({

      quincena_arribo_id: Number(r.quincena_id),

      label: r.label,

      pp_count: Number(r.pp_count),

      pares_inicial: Number(r.inicial),

      pares_vendidos: Number(r.vendido),

      pares_saldo: Number(r.saldo),

    })),

  };

}

