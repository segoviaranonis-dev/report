"use client";

import { useState } from "react";
import {
  cascadaDimCostos,
  EMPTY_COSTOS_SIAMESE,
  hayCostosSiameseActivos,
  toggleLineaCascadaCostos,
  toggleMaterialCascadaCostos,
  togglePeTipoDiccionario,
  toggleReferenciaCascadaCostos,
  toggleStrArr,
  type CostosSiameseFiltros,
  type PeTipoDiccionarioId,
} from "@/lib/costos-rimec-isla/costos-siamese-filtros";
import { PE_TIPO_DICCIONARIO_OPCIONES } from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";

const SEG_BTN =
  "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition";
const SEG_ON = "border-rimec-azul bg-rimec-azul text-white";
const SEG_OFF = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

function AcordeonHeader({
  title,
  count,
  onClear,
}: {
  title: string;
  count: number;
  onClear?: () => void;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-1.5">
        <span className="text-rimec-azul transition group-open:rotate-90" aria-hidden>
          ▸
        </span>
        {title}
        {count > 0 ? (
          <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white">
            {count}
          </span>
        ) : null}
      </span>
      {count > 0 && onClear ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }
          }}
          className="text-[10px] font-semibold text-red-600 hover:underline"
        >
          Limpiar
        </span>
      ) : null}
    </summary>
  );
}

function StrMultiSelectGroup({
  title,
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel = "Sin opciones",
  maxH = "max-h-36",
  defaultOpen = false,
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  emptyLabel?: string;
  maxH?: string;
  defaultOpen?: boolean;
}) {
  const n = selected.length;
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-slate-200/90 bg-white"
    >
      <AcordeonHeader title={title} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <ul
            className={`${maxH} space-y-0.5 overflow-y-auto`}
            role="group"
            aria-label={`${title} · multi-selección`}
          >
            {items.map((item) => {
              const on = selected.includes(item);
              return (
                <li key={item}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      on
                        ? "bg-rimec-azul/10 font-semibold text-rimec-azul-dark"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(item)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                    />
                    <span className="min-w-0 flex-1 truncate font-mono" title={item}>
                      {item}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

function PeTipoDiccionarioGroup({
  selected,
  onToggle,
  onClear,
}: {
  selected: PeTipoDiccionarioId[];
  onToggle: (id: PeTipoDiccionarioId) => void;
  onClear: () => void;
}) {
  const n = selected.length;
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title="Tipo" count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <p className="px-1 pb-1 text-[10px] uppercase tracking-wide text-slate-500">
          Diccionario pronta entrega · grupo uno
        </p>
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · diccionario PE">
          {PE_TIPO_DICCIONARIO_OPCIONES.map((item) => {
            const on = selected.includes(item.id);
            return (
              <li key={item.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                    on
                      ? "bg-rimec-azul/10 font-semibold text-rimec-azul-dark"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(item.id)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-rimec-azul focus:ring-rimec-azul/30"
                  />
                  <span className="min-w-0 flex-1 truncate" title={item.label}>
                    {item.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

function BloqueColapsable({
  title,
  badge,
  open,
  onToggle,
  children,
  railLabel,
}: {
  title: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  railLabel: string;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={`Mostrar ${title}`}
        className="flex h-full min-h-[12rem] w-9 shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 shadow-sm transition hover:border-rimec-azul/40 hover:bg-slate-50"
        aria-expanded={false}
        aria-label={`Mostrar bloque ${title}`}
      >
        <span className="text-rimec-azul" aria-hidden>
          ▸
        </span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
            {badge}
          </span>
        ) : null}
        <span
          className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {railLabel}
        </span>
      </button>
    );
  }

  return (
    <div className="flex max-h-[calc(100vh-5rem)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-sm sm:min-w-[13.5rem] lg:w-64 lg:min-w-[16rem]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rimec-azul">{title}</p>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-rimec-azul"
          aria-expanded
          aria-label={`Ocultar bloque ${title}`}
          title="Ocultar"
        >
          ◂
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

type Props = {
  filtros: CostosSiameseFiltros;
  onChange: React.Dispatch<React.SetStateAction<CostosSiameseFiltros>>;
  opciones: {
    marcas: string[];
    tipo1: string[];
    lineas: string[];
    referencias: string[];
    materiales: string[];
    colores: string[];
  };
};

/** Sidebar isla COSTOS — réplica visual ReposicionFiltrosSidebar PE (2.2.1.44). */
export function CostosSiameseSidebar({ filtros, onChange, opciones }: Props) {
  const [bloqueDimOpen, setBloqueDimOpen] = useState(true);
  const [bloqueMolOpen, setBloqueMolOpen] = useState(true);

  const patch = (p: Partial<CostosSiameseFiltros>) =>
    onChange((prev) => ({ ...prev, ...p }));

  const dirty = hayCostosSiameseActivos(filtros);

  const setRamo = (next: "CALZADOS" | "CONFECCIONES") => {
    const clear = filtros.ramo === next;
    onChange((prev) => ({
      ...EMPTY_COSTOS_SIAMESE,
      q: prev.q,
      ramo: clear ? "" : next,
    }));
  };

  const badgeDim =
    (filtros.ramo ? 1 : 0) +
    filtros.marcas.length +
    filtros.tipo1.length +
    filtros.tipoPe.length;

  const badgeMol =
    filtros.lineas.length +
    filtros.referencias.length +
    filtros.materiales.length +
    filtros.colores.length;

  return (
    <div
      className="flex w-auto max-w-full min-h-0 flex-col gap-3 sm:flex-row sm:items-start"
      aria-label="Filtros COSTOS · hermanos siameses"
    >
      <BloqueColapsable
        title="Dimensiones"
        railLabel="Dimensiones"
        badge={badgeDim}
        open={bloqueDimOpen}
        onToggle={() => setBloqueDimOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-slate-500">Multi-selección · TXT Carlos</p>
          {dirty ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_COSTOS_SIAMESE)}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Stock
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <button type="button" className={`${SEG_BTN} ${SEG_ON}`} aria-pressed>
              📦 Isla COSTOS · TXT
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Categoría
          </span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["CALZADOS", "Calzado"],
                ["CONFECCIONES", "Confecciones"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRamo(id)}
                className={`${SEG_BTN} ${filtros.ramo === id ? SEG_ON : SEG_OFF}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Buscar
          </span>
          <input
            type="search"
            value={filtros.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder="Línea, ref, marca…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          />
        </label>

        <StrMultiSelectGroup
          title="Abierto / cerrado"
          items={opciones.tipo1}
          selected={filtros.tipo1}
          onToggle={(v) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimCostos({
                tipo1: toggleStrArr(prev.tipo1, v),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimCostos({ tipo1: [] }) }))
          }
          defaultOpen
        />

        <StrMultiSelectGroup
          title="Marca"
          items={opciones.marcas}
          selected={filtros.marcas}
          onToggle={(v) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimCostos({
                marcas: toggleStrArr(prev.marcas, v),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimCostos({ marcas: [] }) }))
          }
          maxH="max-h-44"
        />

        <PeTipoDiccionarioGroup
          selected={filtros.tipoPe}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimCostos({
                tipoPe: togglePeTipoDiccionario(prev.tipoPe, id),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimCostos({ tipoPe: [] }) }))
          }
        />
      </BloqueColapsable>

      <BloqueColapsable
        title="Molécula"
        railLabel="L · R · M · C"
        badge={badgeMol}
        open={bloqueMolOpen}
        onToggle={() => setBloqueMolOpen((v) => !v)}
      >
        <p className="text-[10px] text-slate-500">
          Cascada Línea → Referencia → Material → Color · paridad RIMEC Web
        </p>

        <StrMultiSelectGroup
          title="Línea"
          items={opciones.lineas}
          selected={filtros.lineas}
          onToggle={(v) => onChange((prev) => toggleLineaCascadaCostos(prev, v))}
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              lineas: [],
              referencias: [],
              materiales: [],
              colores: [],
            }))
          }
          maxH="max-h-48"
          defaultOpen
        />

        <StrMultiSelectGroup
          title="Referencia"
          items={opciones.referencias}
          selected={filtros.referencias}
          onToggle={(v) => onChange((prev) => toggleReferenciaCascadaCostos(prev, v))}
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              referencias: [],
              materiales: [],
              colores: [],
            }))
          }
          maxH="max-h-48"
        />

        <StrMultiSelectGroup
          title="Material"
          items={opciones.materiales}
          selected={filtros.materiales}
          onToggle={(v) => onChange((prev) => toggleMaterialCascadaCostos(prev, v))}
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              materiales: [],
              colores: [],
            }))
          }
          maxH="max-h-52"
        />

        <StrMultiSelectGroup
          title="Color"
          items={opciones.colores}
          selected={filtros.colores}
          onToggle={(v) =>
            onChange((prev) => ({
              ...prev,
              colores: toggleStrArr(prev.colores, v),
            }))
          }
          onClear={() => patch({ colores: [] })}
          maxH="max-h-52"
        />
      </BloqueColapsable>
    </div>
  );
}
