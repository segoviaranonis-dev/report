"use client";

import { useMemo } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { agruparProductosOperativa } from "@/lib/depositos/agrupar-operativa";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import { DepositoProductThumb } from "../DepositoProductThumb";
import { TablaGradaOperativa } from "./TablaGradaOperativa";

type Props = {
  productos: DepositoRow[];
  tienda?: string;
  casoPorLinea?: Map<string, string> | null;
};

export function GrillaOperativaDeposito({ productos, tienda = "", casoPorLinea = null }: Props) {
  const cards = useMemo(
    () => agruparProductosOperativa(productos, casoPorLinea),
    [productos, casoPorLinea],
  );

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4">
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg text-gray-600">Sin productos o sin coincidencias con los filtros.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12">
      <div className="flex flex-wrap justify-center gap-3">
        {cards.map((card) => {
          const p = card.producto;
          return (
            <article
              key={card.key}
              className="flex w-[calc(50%-0.375rem)] max-w-[220px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:w-[180px] md:w-[200px]"
            >
              <div className="relative flex aspect-square items-center justify-center bg-gray-100">
                <DepositoProductThumb
                  linea={p.linea_codigo_proveedor}
                  referencia={p.referencia_codigo_proveedor}
                  material={p.material_code}
                  color={p.color_code}
                  imagenNombre={p.imagen_nombre}
                  size={180}
                />
                <span className="absolute right-2 top-2 rounded-full bg-bazzar-naranja px-2 py-1 text-xs font-bold text-white">
                  {Math.round(card.totalPares)} p
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="text-xs font-bold uppercase text-rimec-azul">{p.marca}</p>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  {p.linea_codigo_proveedor}.{p.referencia_codigo_proveedor}
                </p>
                <p className="line-clamp-2 text-xs text-gray-600">
                  {[p.descp_material, p.descp_color].filter(Boolean).join(" · ") ||
                    `${p.material_code} / ${p.color_code}`}
                </p>
                {card.precioVenta != null ? (
                  <p className="text-sm font-bold tabular-nums text-bazzar-naranja-dark">
                    {formatPrecioGs(card.precioVenta)}
                    <span className="ml-1 text-[10px] font-semibold text-gray-500">/ par</span>
                  </p>
                ) : null}
                {card.casoComercial ? (
                  <p
                    className="rounded-md border border-emerald-500/50 bg-emerald-50 px-2 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-emerald-800"
                    title="Caso comercial · biblioteca motor"
                  >
                    {card.casoComercial}
                  </p>
                ) : casoPorLinea?.size ? (
                  <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-center text-[10px] text-gray-400">
                    Sin caso BCL
                  </p>
                ) : null}
                <div className="mt-auto">
                  <TablaGradaOperativa
                    tienda={tienda}
                    estilo={card.estilo}
                    tallas={card.tallas}
                    stock={card.stock}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-gray-500">
        Ordenado por pares totales (mayor a menor) · stock por talla
      </p>
    </div>
  );
}
