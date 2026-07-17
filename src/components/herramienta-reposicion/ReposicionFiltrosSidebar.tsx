"use client";

import { useState } from "react";
import type { DepositoFilterItem } from "@/app/api/depositos/[cliente_id]/filtros/route";
import {
  hayFiltrosActivos,
  toggleOperativaId,
  type OperativaFilterState,
  type OperativaOpciones,
} from "@/lib/depositos/operativa-filters";
import {
  TIPO_GRUPO_OPCIONES,
  toggleTipoGrupo,
  type TipoGrupoId,
} from "@/lib/filtros/filtro-tipo-canonico";
import {
  toggleFamiliaKey,
  type FamiliaPilarItem,
} from "@/lib/pilares/agrupar-etiqueta-pilar";
import { TIPO_V2_CALZADO, TIPO_V2_CONFECCIONES } from "@/lib/retail/product-image-protocol";

type Props = {
  filtros: OperativaFilterState;
  onChange: React.Dispatch<React.SetStateAction<OperativaFilterState>>;
  opciones: OperativaOpciones;
  emptyFilters: OperativaFilterState;
  soloConStock: boolean;
  onSoloConStockChange: (v: boolean) => void;
  trailing?: React.ReactNode;
  className?: string;
};

function cap(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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

function MultiSelectGroup({
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
  items: DepositoFilterItem[];
  selected: number[];
  onToggle: (id: number) => void;
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
              const id = Number(item.id);
              if (!Number.isFinite(id)) return null;
              const on = selected.includes(id);
              return (
                <li key={id}>
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
                      onChange={() => onToggle(id)}
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
        )}
      </div>
    </details>
  );
}

function TipoMultiSelectGroup({
  selected,
  onToggle,
  onClear,
}: {
  selected: TipoGrupoId[];
  onToggle: (id: TipoGrupoId) => void;
  onClear: () => void;
}) {
  const n = selected.length;
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title="Tipo" count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · multi-selección">
          {TIPO_GRUPO_OPCIONES.map((item) => {
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

/** Familias Material/Color — una opción agrupa variantes (Napa·Nap·Np). */
function FamiliaMultiSelectGroup({
  title,
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel = "Sin descripción de pilar",
  maxH = "max-h-52",
  defaultOpen = false,
}: {
  title: string;
  items: FamiliaPilarItem[];
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
            aria-label={`${title} · familias agrupadas`}
          >
            {items.map((item) => {
              const on = selected.includes(item.key);
              return (
                <li key={item.key}>
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
                      onChange={() => onToggle(item.key)}
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
        )}
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
    <div className="flex w-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-sm lg:w-56">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rimec-azul">{title}</p>
        </div>
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
      <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-2 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

/**
 * Dos bloques ocultables — Dimensiones + Molécula (Material/Color).
 * Orden bloque 1: Categoría → AB-CR → Marca → Tipo → Género → Estilo → Línea
 * Etiquetas Material/Color = 1ª palabra pilar (espacio · / · -).
 */
export function ReposicionFiltrosSidebar({
  filtros,
  onChange,
  opciones,
  emptyFilters,
  soloConStock,
  onSoloConStockChange,
  trailing,
  className = "",
}: Props) {
  const [bloqueDimOpen, setBloqueDimOpen] = useState(true);
  const [bloqueMolOpen, setBloqueMolOpen] = useState(true);

  const patch = (p: Partial<OperativaFilterState>) =>
    onChange((prev) => ({ ...prev, ...p }));

  const dirty =
    hayFiltrosActivos(filtros) ||
    JSON.stringify(filtros) !== JSON.stringify(emptyFilters);

  const catItems: DepositoFilterItem[] =
    opciones.tipoV2.length > 0
      ? opciones.tipoV2
      : [
          { id: TIPO_V2_CALZADO, label: "Calzado" },
          { id: TIPO_V2_CONFECCIONES, label: "Confecciones" },
        ];

  const badgeDim =
    filtros.tipoV2Ids.length +
    filtros.tipo1Ids.length +
    filtros.marcaIds.length +
    filtros.tipoGrupos.length +
    filtros.generoIds.length;

  const badgeMol =
    filtros.grupoEstiloIds.length +
    filtros.lineaIds.length +
    filtros.materialFamilias.length +
    filtros.colorFamilias.length;

  return (
    <div
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-stretch ${className}`}
      aria-label="Filtros reposición · dos bloques ocultables"
    >
      <BloqueColapsable
        title="Dimensiones"
        railLabel="Dimensiones"
        badge={badgeDim}
        open={bloqueDimOpen}
        onToggle={() => setBloqueDimOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-slate-500">Multi-selección</p>
          {dirty ? (
            <button
              type="button"
              onClick={() => onChange(emptyFilters)}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
            >
              Reset
            </button>
          ) : null}
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

        {/* Orden canónico: 1 Categoría · 2 AB-CR · 3 Marca · 4 Tipo */}
        <MultiSelectGroup
          title="Categoría"
          items={catItems.map((x) => ({
            ...x,
            label: cap(String(x.label)),
          }))}
          selected={filtros.tipoV2Ids}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              tipoV2Ids: toggleOperativaId(prev.tipoV2Ids, id),
            }))
          }
          onClear={() => patch({ tipoV2Ids: [] })}
          maxH="max-h-24"
          defaultOpen
        />

        <MultiSelectGroup
          title="AB - CR"
          items={opciones.tipo1}
          selected={filtros.tipo1Ids}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              tipo1Ids: toggleOperativaId(prev.tipo1Ids, id),
            }))
          }
          onClear={() => patch({ tipo1Ids: [] })}
        />

        <MultiSelectGroup
          title="Marca"
          items={opciones.marcas.map((m) => ({ ...m, label: cap(m.label) }))}
          selected={filtros.marcaIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              marcaIds: toggleOperativaId(prev.marcaIds, id),
            }))
          }
          onClear={() => patch({ marcaIds: [] })}
          maxH="max-h-44"
        />

        <TipoMultiSelectGroup
          selected={filtros.tipoGrupos}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              tipoGrupos: toggleTipoGrupo(prev.tipoGrupos, id),
            }))
          }
          onClear={() => patch({ tipoGrupos: [] })}
        />

        <MultiSelectGroup
          title="Género"
          items={opciones.generos.map((g) => ({ ...g, label: cap(g.label) }))}
          selected={filtros.generoIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              generoIds: toggleOperativaId(prev.generoIds, id),
            }))
          }
          onClear={() => patch({ generoIds: [] })}
        />

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => onSoloConStockChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-rimec-azul"
          />
          Solo con stock disponible
        </label>

        {trailing}
      </BloqueColapsable>

      <BloqueColapsable
        title="Molécula"
        railLabel="Estilo · Línea · Mat · Color"
        badge={badgeMol}
        open={bloqueMolOpen}
        onToggle={() => setBloqueMolOpen((v) => !v)}
      >
        <p className="text-[10px] text-slate-500">
          Cascada: Estilo → Línea → Material → Color · familias texto · NN
        </p>

        <MultiSelectGroup
          title="Estilo"
          items={opciones.estilos}
          selected={filtros.grupoEstiloIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              grupoEstiloIds: toggleOperativaId(prev.grupoEstiloIds, id),
            }))
          }
          onClear={() => patch({ grupoEstiloIds: [] })}
          defaultOpen
        />

        <MultiSelectGroup
          title="Línea"
          items={opciones.lineas}
          selected={filtros.lineaIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              lineaIds: toggleOperativaId(prev.lineaIds, id),
            }))
          }
          onClear={() => patch({ lineaIds: [] })}
          maxH="max-h-48"
        />

        <FamiliaMultiSelectGroup
          title="Material"
          items={opciones.materiales}
          selected={filtros.materialFamilias}
          onToggle={(key) =>
            onChange((prev) => ({
              ...prev,
              materialFamilias: toggleFamiliaKey(prev.materialFamilias, key),
            }))
          }
          onClear={() => patch({ materialFamilias: [] })}
          maxH="max-h-52"
        />
        <FamiliaMultiSelectGroup
          title="Color"
          items={opciones.colores}
          selected={filtros.colorFamilias}
          onToggle={(key) =>
            onChange((prev) => ({
              ...prev,
              colorFamilias: toggleFamiliaKey(prev.colorFamilias, key),
            }))
          }
          onClear={() => patch({ colorFamilias: [] })}
          maxH="max-h-52"
        />
      </BloqueColapsable>
    </div>
  );
}
