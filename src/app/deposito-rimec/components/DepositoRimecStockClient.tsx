"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { GrillaOperativaDeposito } from "@/app/depositos-bazzar/components/operativa/GrillaOperativaDeposito";
import { agruparProductosOperativa } from "@/lib/depositos/agrupar-operativa";

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

type Props = {
  apiPath: string;
  titulo: string;
  subtitulo: string;
  badgeClass: string;
  badgeLabel: string;
  extraBanner?: React.ReactNode;
};

export function DepositoRimecStockClient({
  apiPath,
  titulo,
  subtitulo,
  badgeClass,
  badgeLabel,
  extraBanner,
}: Props) {
  const [productos, setProductos] = useState<DepositoRow[]>([]);
  const [meta, setMeta] = useState<{ cajas: number; pares: number; codigo: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(apiPath, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error ?? "Error");
        setProductos(j.productos ?? []);
        setMeta({ cajas: j.cajas ?? 0, pares: j.pares ?? 0, codigo: j.codigo ?? "—" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [apiPath]);

  const cards = useMemo(() => agruparProductosOperativa(productos, null), [productos]);

  return (
    <main className="pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <Link href="/deposito-rimec" className="text-sm text-rimec-azul hover:underline">
            ← Depósito RIMEC
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
                {badgeLabel}
              </span>
              <h1 className="mt-1 font-serif text-2xl font-semibold text-slate-900">{titulo}</h1>
              <p className="text-sm text-slate-600">{subtitulo}</p>
            </div>
            {meta ? (
              <p className="text-sm font-medium text-slate-700">
                {fmtInt(cards.length)} cajas · {fmtInt(meta.pares)} pares · {meta.codigo}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {extraBanner}

      {error ? (
        <div className="mx-auto mt-6 max-w-7xl px-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="mx-auto mt-8 max-w-7xl px-4 text-sm text-slate-500">Cargando stock…</p>
      ) : (
        <div className="mt-6">
          <GrillaOperativaDeposito productos={productos} tienda="RIMEC" />
        </div>
      )}
    </main>
  );
}
