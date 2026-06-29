"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const MODS = [
  { id: "operativa", label: "Caja operativa", sub: "Pendientes · CSV" },
  { id: "facturable", label: "Facturado", sub: "Archivo caja" },
  { id: "empaque", label: "Empaque", sub: "Bobeda · control QC" },
  { id: "metricas", label: "Métricas", sub: "KPIs · movimientos" },
] as const;

export type CajaMod = (typeof MODS)[number]["id"];

export function CajaSubNav({ clienteId, label }: { clienteId: number; label: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const mod = (sp.get("mod") as CajaMod) || "operativa";

  return (
    <div className="mb-8">
      <Link href="/tablet-bazzar" className="text-sm font-semibold text-bazzar-naranja hover:underline">
        ← Hub cajas
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-light text-neutral-ink">Caja · {label}</h1>
      <p className="text-sm text-neutral-muted">Tienda {clienteId} · módulo cajero Bazzar</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODS.map((m) => {
          const active = mod === m.id;
          const href = `${pathname}?mod=${m.id}`;
          return (
            <Link
              key={m.id}
              href={href}
              className={`rounded-2xl border-2 p-4 transition-shadow ${
                active
                  ? "border-bazzar-naranja bg-bazzar-naranja/10 shadow-md"
                  : "border-slate-200 bg-white hover:border-bazzar-naranja/40"
              }`}
            >
              <p className={`text-sm font-bold ${active ? "text-bazzar-naranja" : "text-neutral-ink"}`}>
                {m.label}
              </p>
              <p className="mt-1 text-xs text-neutral-muted">{m.sub}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
