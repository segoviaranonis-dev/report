"use client";

import { formatPrecioGs } from "@/lib/depositos/precio-venta";

type Props = {
  paresInicial: number;
  paresVendidos: number;
  paresSaldo: number;
  valorInventario: number;
  modo?: "canonico" | "filtrado";
};

export function ProgramadoVentasVitales({
  paresInicial,
  paresVendidos,
  paresSaldo,
  valorInventario,
  modo = "canonico",
}: Props) {
  const vendidoGs =
    paresInicial > 0 && valorInventario > 0
      ? Math.round((paresVendidos / paresInicial) * valorInventario)
      : 0;
  const pct = paresInicial > 0 ? ((paresVendidos / paresInicial) * 100).toFixed(1) : "0";

  return (
    <>
      <span className="rounded-lg border-2 border-rose-300 bg-rose-50 px-3 py-1.5">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-rose-700">
          Vendido · programado
        </span>
        <span className="block font-black tabular-nums text-rose-900">
          {Math.round(paresVendidos).toLocaleString("es-PY")}{" "}
          <span className="text-[10px] font-bold uppercase">pares</span>
        </span>
        {vendidoGs > 0 ? (
          <span className="block text-[10px] font-semibold tabular-nums text-rose-800/80">
            {formatPrecioGs(vendidoGs)} · {pct}%
          </span>
        ) : null}
      </span>

      <span className="rounded-lg border-2 border-amber-400/50 bg-white px-3 py-1.5">
        <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-900">
          Saldo · programado
        </span>
        <span className="block font-black tabular-nums text-amber-950">
          {Math.round(paresSaldo).toLocaleString("es-PY")}{" "}
          <span className="text-[10px] font-bold uppercase">pares</span>
        </span>
        <span className="block text-[10px] font-semibold tabular-nums text-amber-800/80">
          inicial {Math.round(paresInicial).toLocaleString("es-PY")}
          {modo === "filtrado" ? " · filtrado" : " · canónico"}
        </span>
      </span>
    </>
  );
}
