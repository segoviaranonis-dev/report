import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";

import { StockTransitoHubClient } from "@/components/stock-transito/StockTransitoHubClient";

import { getStockTransitoResumen } from "@/lib/stock-transito/queries-resumen";

import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";



export const dynamic = "force-dynamic";



const EMPTY_RESUMEN = {

  pedidos_pp: 0,

  moleculas: 0,

  pares_inicial: 0,

  pares_vendidos: 0,

  pares_saldo: 0,

  por_quincena: [],

};



export default async function StockTransitoHubPage() {

  const resumen = isRimecDatabaseConfigured()

    ? await getStockTransitoResumen(getRimecPool())

    : EMPTY_RESUMEN;



  return (

    <DepositoRimecShell footer="Compra previa · Tránsito · hub Disponible + Ventas · Alejandro Magno">

      <StockTransitoHubClient resumen={resumen} />

    </DepositoRimecShell>

  );

}

