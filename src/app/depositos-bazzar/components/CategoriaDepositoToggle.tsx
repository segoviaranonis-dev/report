"use client";

import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import { CATEGORIA_DEPOSITO_META } from "@/lib/depositos/depositos-config";

type Props = {
  value: CategoriaDeposito;
  onChange: (c: CategoriaDeposito) => void;
};

const ORDER: CategoriaDeposito[] = ["tienda", "guardado", "averiado"];

export function CategoriaDepositoToggle({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((cat) => {
        const meta = CATEGORIA_DEPOSITO_META[cat];
        const active = value === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? "bg-bazzar-naranja text-white shadow"
                : "border-2 border-bazzar-naranja/30 bg-white text-bazzar-text-dark hover:border-bazzar-naranja"
            }`}
            title={meta.descripcion}
          >
            {meta.label}
            {meta.tablet ? " · Tablet" : ""}
          </button>
        );
      })}
    </div>
  );
}
