"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";
import { VENTA_VISUAL } from "@/lib/nexus/venta-visual";

const STORAGE_PREFIX = "pe-ventas-demo";

type VentasDemo = { calzado: number; confecciones: number };

function loadVentas(batch: string): VentasDemo {
  if (typeof window === "undefined") return { calzado: 0, confecciones: 0 };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${batch}`);
    if (!raw) return { calzado: 0, confecciones: 0 };
    const j = JSON.parse(raw) as Partial<VentasDemo>;
    return {
      calzado: Math.max(0, Number(j.calzado) || 0),
      confecciones: Math.max(0, Number(j.confecciones) || 0),
    };
  } catch {
    return { calzado: 0, confecciones: 0 };
  }
}

function saveVentas(batch: string, data: VentasDemo) {
  localStorage.setItem(`${STORAGE_PREFIX}:${batch}`, JSON.stringify(data));
}

type Ramo = "calzado" | "confecciones";

type Props = {
  batchLabel: string;
  calzadoPares: number;
  confeccionesPares: number;
  calzadoGs: number;
  confeccionesGs: number;
};

export function PeVentasRegistroBar({
  batchLabel,
  calzadoPares,
  confeccionesPares,
  calzadoGs,
  confeccionesGs,
}: Props) {
  const [ventas, setVentas] = useState<VentasDemo>({ calzado: 0, confecciones: 0 });
  const [editing, setEditing] = useState<Ramo | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setVentas(loadVentas(batchLabel));
  }, [batchLabel]);

  const maxFor = (ramo: Ramo) => Math.round(ramo === "calzado" ? calzadoPares : confeccionesPares);
  const gsFor = (ramo: Ramo) => (ramo === "calzado" ? calzadoGs : confeccionesGs);
  const vendidoGs = (ramo: Ramo, pares: number) => {
    const max = maxFor(ramo);
    const gs = gsFor(ramo);
    return max > 0 && gs > 0 ? Math.round((pares / max) * gs) : 0;
  };

  const totalVendido = ventas.calzado + ventas.confecciones;
  const totalStock = Math.round(calzadoPares + confeccionesPares);
  const totalSaldo = Math.max(totalStock - totalVendido, 0);
  const totalVendidoGs =
    vendidoGs("calzado", ventas.calzado) + vendidoGs("confecciones", ventas.confecciones);

  const commit = useCallback(
    (ramo: Ramo, n: number) => {
      const capped = Math.min(Math.max(0, Math.round(n)), maxFor(ramo));
      setVentas((prev) => {
        const next = { ...prev, [ramo]: capped };
        saveVentas(batchLabel, next);
        return next;
      });
      setEditing(null);
    },
    [batchLabel, calzadoPares, confeccionesPares],
  );

  const openEdit = (ramo: Ramo) => {
    setDraft(String(ventas[ramo]));
    setEditing(ramo);
  };

  const ramos: { key: Ramo; icon: string; label: string; accent: string }[] = [
    { key: "calzado", icon: "👟", label: "Calzado", accent: `${VENTA_VISUAL.chipBorder} ${VENTA_VISUAL.chipBg} hover:bg-emerald-100 ${VENTA_VISUAL.valueStrong}` },
    {
      key: "confecciones",
      icon: "👕",
      label: "Confecciones",
      accent: "border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-900",
    },
  ];

  return (
    <>
      {ramos.map(({ key, icon, label, accent }) => {
        const vendido = ventas[key];
        const max = maxFor(key);
        const gs = vendidoGs(key, vendido);
        return (
          <button
            key={key}
            type="button"
            onClick={() => openEdit(key)}
            title={`Registrar venta ${label.toLowerCase()}`}
            className={`rounded-lg border-2 px-3 py-1.5 text-left transition ${accent}`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-wider opacity-80">
              {icon} Vendido · {label}
            </span>
            <span className="block font-black tabular-nums">
              {vendido.toLocaleString("es-PY")}
              <span className="text-[10px] font-bold opacity-70">
                {" "}
                / {max.toLocaleString("es-PY")} pares
              </span>
            </span>
            {gs > 0 ? (
              <span className="block text-[10px] font-semibold tabular-nums opacity-90">
                {formatPrecioGs(gs)}
              </span>
            ) : null}
          </button>
        );
      })}

      <span
        className="hidden rounded-lg border-2 border-rimec-azul/25 bg-rimec-azul/5 px-3 py-1.5 sm:inline-block"
        title="Saldo total filtrado"
      >
        <span className="block text-[9px] font-bold uppercase tracking-wider text-rimec-azul">
          Saldo total
        </span>
        <span className="block font-black tabular-nums text-rimec-azul">
          {totalSaldo.toLocaleString("es-PY")}{" "}
          <span className="text-[10px] font-bold uppercase">pares</span>
        </span>
        {totalVendidoGs > 0 ? (
          <span className="block text-[10px] font-semibold tabular-nums text-rimec-azul/80">
            vendido {formatPrecioGs(totalVendidoGs)}
          </span>
        ) : null}
      </span>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Registrar venta pronta entrega"
        >
          <form
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(e) => {
              e.preventDefault();
              commit(editing, Number(draft.replace(/\./g, "").replace(/,/g, "")));
            }}
          >
            <p className="font-serif text-lg font-semibold text-slate-900">
              Venta · {editing === "calzado" ? "Calzado" : "Confecciones"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Demo presentación — batch {batchLabel}. Se reinicia con cada importación.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pares vendidos
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg font-bold tabular-nums"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              Máximo: {maxFor(editing).toLocaleString("es-PY")} pares
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-rimec-azul py-2 text-sm font-semibold text-white hover:bg-rimec-azul/90"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
