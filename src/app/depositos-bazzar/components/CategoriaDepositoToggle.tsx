"use client";

import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import { CATEGORIA_DEPOSITO_META } from "@/lib/depositos/depositos-config";

const OPCIONES: CategoriaDeposito[] = ["tienda", "guardado", "averiado"];

type Props = {
  categoria: CategoriaDeposito;
  onChange: (categoria: CategoriaDeposito) => void;
};

export function CategoriaDepositoToggle({ categoria, onChange }: Props) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-gray-500">
        Vista de los 6 depósitos
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border-4 border-gray-800 bg-gray-800 shadow-xl">
        {OPCIONES.map((cat) => {
          const meta = CATEGORIA_DEPOSITO_META[cat];
          const active = categoria === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={`relative px-3 py-5 text-center transition-all sm:px-6 sm:py-6 ${
                active
                  ? cat === "tienda"
                    ? "bg-gradient-to-b from-bazzar-naranja to-bazzar-naranja-dark text-white"
                    : cat === "guardado"
                      ? "bg-gradient-to-b from-slate-600 to-slate-800 text-white"
                      : "bg-gradient-to-b from-red-500 to-red-700 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div
                className={`text-lg font-black tracking-tight sm:text-2xl ${
                  active ? "text-white" : "text-gray-800"
                }`}
              >
                {meta.label}
              </div>
              <div
                className={`mt-1 text-[10px] font-medium leading-tight sm:text-xs ${
                  active ? "text-white/90" : "text-gray-500"
                }`}
              >
                {meta.descripcion}
              </div>
              {meta.tablet && (
                <div
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    active ? "bg-white/20 text-white" : "bg-bazzar-naranja/15 text-bazzar-naranja"
                  }`}
                >
                  Tablet POS
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
