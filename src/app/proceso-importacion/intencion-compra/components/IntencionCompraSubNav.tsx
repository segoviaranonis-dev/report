"use client";

import Link from "next/link";
import { INTENCION_COMPRA_BANDEJA, INTENCION_COMPRA_NUEVA } from "@/lib/report/routes";

type Props = {
  activo: "registro" | "bandeja";
};

export function IntencionCompraSubNav({ activo }: Props) {
  const items = [
    { key: "registro" as const, href: INTENCION_COMPRA_NUEVA, code: "2.3.1.7.3.1", label: "Intención" },
    { key: "bandeja" as const, href: INTENCION_COMPRA_BANDEJA, code: "2.3.1.7.3.2", label: "Bandeja IC" },
  ];

  return (
    <nav className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
            activo === item.key
              ? "border-rimec-azul bg-rimec-azul text-white shadow-md"
              : "border-slate-200 bg-white text-rimec-azul-dark hover:border-rimec-azul/40"
          }`}
        >
          <span className="block text-[10px] font-bold uppercase tracking-widest opacity-80">{item.code}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
