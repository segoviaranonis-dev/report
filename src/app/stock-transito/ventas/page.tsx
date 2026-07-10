import { DepositoRimecShell } from "@/app/deposito-rimec/components/DepositoRimecShell";

import { StockTransitoClient } from "@/components/stock-transito/StockTransitoClient";

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



export default async function StockTransitoVentasPage() {

  const resumen = isRimecDatabaseConfigured()

    ? await getStockTransitoResumen(getRimecPool())

    : EMPTY_RESUMEN;



  return (

    <DepositoRimecShell footer="Ventas ejecutadas · Compra previa tránsito · Panel Alejandro Magno">

      <StockTransitoClient resumenInicial={resumen} vista="ventas" />

    </DepositoRimecShell>

  );

}

