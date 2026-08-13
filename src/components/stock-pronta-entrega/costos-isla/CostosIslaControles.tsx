"use client";

import type { ReactNode } from "react";
import type {
  CostosDepositoSlot,
  CostosSimulacion,
  ListaCostosTier,
} from "@/lib/costos-rimec-isla/types";
import { COSTOS_DEPOSITOS, LISTA_COSTOS_TIERS } from "@/lib/costos-rimec-isla/types";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

type Props = {
  sim: CostosSimulacion;
  onSimChange: (p: Partial<CostosSimulacion>) => void;
  depositosSel: Set<CostosDepositoSlot>;
  onDepositoToggle: (d: CostosDepositoSlot) => void;
};

export function CostosIslaControles({
  sim,
  onSimChange,
  depositosSel,
  onDepositoToggle,
}: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Gerencia · lista + descuento cliente
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-slate-600">Listado</span>
            <select
              value={sim.listaTier}
              onChange={(e) => onSimChange({ listaTier: e.target.value as ListaCostosTier })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold"
            >
              {LISTA_COSTOS_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.hint})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-slate-600">Descuentos cliente D1–D4 %</span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["descuento1", "D1"],
                  ["descuento2", "D2"],
                  ["descuento3", "D3"],
                  ["descuento4", "D4"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase text-slate-500">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={sim[key]}
                    onChange={(e) =>
                      onSimChange({ [key]: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="w-14 rounded-lg border border-slate-300 px-1.5 py-1.5 text-center text-sm font-bold tabular-nums"
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-[9px] text-slate-500">
              Cascada FI · D1 diccionario cadena · D2–D4 cliente/vendedor
            </p>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-slate-600">Cotiz. USD → Gs</span>
            <input
              type="number"
              min={1}
              step={100}
              value={sim.cotizUsd}
              onChange={(e) => onSimChange({ cotizUsd: Number(e.target.value) || 7500 })}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-slate-600">Costo base</span>
            <select
              value={sim.baseCosto}
              onChange={(e) => onSimChange({ baseCosto: e.target.value as "lpn" | "dls" })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="lpn">LPN TXT (Gs)</option>
              <option value="dls">Dls × cotiz.</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Depósitos activos (TXT)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COSTOS_DEPOSITOS.map((d) => (
            <Chip
              key={d.slot}
              active={depositosSel.has(d.slot)}
              onClick={() => onDepositoToggle(d.slot)}
            >
              {d.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
