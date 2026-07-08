"use client";

import { useCallback, useEffect, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { GrillaPeImportadora } from "@/components/stock-pronta-entrega/GrillaPeImportadora";
import type { EntidadActivoResumen } from "@/lib/panel-control/queries-resumen";

const fmtN = (n: number) => new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);

type Props = {
  entidad: EntidadActivoResumen["entidad"];
  showLlegada?: boolean;
};

type Payload = {
  productos: DepositoRow[];
  moleculas: number;
  pares_comprados: number;
  pares_vendidos: number;
  pares_saldo: number;
};

export function PanelSectorGrilla({ entidad, showLlegada = false }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/rimec/panel-control/productos?entidad=${entidad}`, {
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Error al cargar grilla");
      setData({
        productos: j.productos ?? [],
        moleculas: j.moleculas ?? 0,
        pares_comprados: j.pares_comprados ?? 0,
        pares_vendidos: j.pares_vendidos ?? 0,
        pares_saldo: j.pares_saldo ?? 0,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entidad]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="py-4 text-center text-xs text-neutral-ink-muted">Cargando moléculas…</p>;
  }

  if (err) {
    return (
      <div className="rounded-lg border border-semantic-error/30 bg-semantic-error/10 px-3 py-2 text-xs text-semantic-error">
        {err}
        <button type="button" onClick={() => void load()} className="ml-2 underline">
          Reintentar
        </button>
      </div>
    );
  }

  if (!data?.productos.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-6 text-center text-xs text-slate-500">
        Sin moléculas en este sector.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-center">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Comprado</p>
          <p className="font-serif text-base font-semibold tabular-nums text-rimec-azul">
            {fmtN(data.pares_comprados)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Vendido</p>
          <p className="font-serif text-base font-semibold tabular-nums text-rose-700">
            {fmtN(data.pares_vendidos)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Saldo</p>
          <p className="font-serif text-base font-semibold tabular-nums text-slate-800">
            {fmtN(data.pares_saldo)}
          </p>
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
        <GrillaPeImportadora
          productos={data.productos}
          showLlegada={showLlegada}
          showVentas
        />
      </div>
    </div>
  );
}
