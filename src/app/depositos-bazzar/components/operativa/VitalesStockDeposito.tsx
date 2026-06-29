"use client";

type Props = {
  productos: number;
  pares: number;
  valorInventario?: number;
  variant?: "hero" | "inline";
};

import { formatPrecioGs } from "@/lib/depositos/precio-venta";

export function VitalesStockDeposito({ productos, pares, valorInventario = 0, variant = "hero" }: Props) {
  const paresRedondeados = Math.round(pares);

  if (variant === "inline") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-rimec-azul/10 px-2.5 py-1 text-sm font-black tabular-nums text-rimec-azul">
          {productos.toLocaleString("es-PY")}{" "}
          <span className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul/80">
            prod.
          </span>
        </span>
        <span className="rounded-lg bg-bazzar-naranja/15 px-2.5 py-1 text-sm font-black tabular-nums text-bazzar-naranja-dark">
          {paresRedondeados.toLocaleString("es-PY")}{" "}
          <span className="text-[10px] font-bold uppercase tracking-wide text-bazzar-naranja">
            pares
          </span>
        </span>
        {valorInventario > 0 ? (
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-black tabular-nums text-emerald-800">
            {formatPrecioGs(valorInventario)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 border-bazzar-naranja/50 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-4 py-4 shadow-md ring-2 ring-bazzar-naranja/20"
      role="status"
      aria-live="polite"
      aria-label={`${productos} productos, ${paresRedondeados} pares`}
    >
      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-bazzar-naranja">
        Dato vital · stock filtrado
      </p>
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4">
        <div className="flex flex-1 flex-col items-center rounded-xl border-2 border-rimec-azul/30 bg-white px-4 py-3 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-rimec-azul">
            Productos
          </span>
          <span className="mt-1 text-4xl font-black tabular-nums leading-none text-rimec-azul sm:text-5xl">
            {productos.toLocaleString("es-PY")}
          </span>
          <span className="mt-1 text-xs font-medium text-gray-500">moléculas · con imagen</span>
        </div>
        <div className="hidden w-px shrink-0 bg-bazzar-naranja/30 sm:block" aria-hidden />
        {valorInventario > 0 ? (
          <>
            <div className="flex flex-1 flex-col items-center rounded-xl border-2 border-emerald-500/40 bg-emerald-50 px-4 py-3 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                Valor stock
              </span>
              <span className="mt-1 text-2xl font-black tabular-nums leading-none text-emerald-800 sm:text-3xl">
                {formatPrecioGs(valorInventario)}
              </span>
              <span className="mt-1 text-xs font-medium text-emerald-700/80">precio CSV × pares</span>
            </div>
            <div className="hidden w-px shrink-0 bg-bazzar-naranja/30 sm:block" aria-hidden />
          </>
        ) : null}
        <div className="flex flex-1 flex-col items-center rounded-xl border-2 border-bazzar-naranja bg-bazzar-naranja/5 px-4 py-3 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-bazzar-naranja-dark">
            Pares
          </span>
          <span className="mt-1 text-4xl font-black tabular-nums leading-none text-bazzar-naranja-dark sm:text-5xl">
            {paresRedondeados.toLocaleString("es-PY")}
          </span>
          <span className="mt-1 text-xs font-medium text-gray-600">unidades en piso</span>
        </div>
      </div>
    </div>
  );
}
