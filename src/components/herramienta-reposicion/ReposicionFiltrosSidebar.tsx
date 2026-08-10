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
  cascadaDimensionesOperativa,
  cascadaEstiloOperativa,
  cascadaLineaOperativa,
  cascadaReferenciaOperativa,
  toggleEstiloCascadaOp,
  toggleLineaCascadaOp,
  toggleReferenciaCascadaOp,
  toggleMaterialCascadaOp,
} from "@/lib/depositos/operativa-cascada";
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  parsePeTipoSelected,
  togglePeTipoDiccionario,
  type PeTipoDiccionarioId,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import {
  TIPO_GRUPO_OPCIONES,
  sanitizeTipoGruposParaRamo,
  tipoGrupoOpcionesVisibles,
  toggleTipoGrupo,
  type TipoGrupoId,
} from "@/lib/filtros/filtro-tipo-canonico";
import {
  tituloAbcrSidebar,
  esRamoAccesorios,
} from "@/lib/filtros/modulo-accesorios";
import {
  toggleFamiliaKey,
  type FamiliaPilarItem,
} from "@/lib/pilares/agrupar-etiqueta-pilar";
import { RIMEC_SDRM_DEPOSIT_MAP } from "@/lib/deposito-rimec/rimec-csv-sdrm";
import type { OperativaRamoTipo } from "@/lib/depositos/operativa-filters";

const SEG_BTN =
  "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition";
const SEG_ON = "border-rimec-azul bg-rimec-azul text-white";
const SEG_OFF = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

const PE_RAMO_LABEL: Record<Exclude<OperativaRamoTipo, "">, string> = {
  CALZADO: "Calzado",
  CONFECCIONES: "Confecciones",
  ACCESORIOS: "Carteras y accesorios",
};

type Props = {
  filtros: OperativaFilterState;
  onChange: React.Dispatch<React.SetStateAction<OperativaFilterState>>;
  opciones: OperativaOpciones;
  emptyFilters: OperativaFilterState;
  soloConStock?: boolean;
  onSoloConStockChange?: (v: boolean) => void;
  trailing?: React.ReactNode;
  className?: string;
  /** `pe` = Stock / Depósito / Categoría segmentados (paridad RIMEC Web). */
  variant?: "default" | "pe" | "am";
  depositoLegal?: string;
  onDepositoLegalChange?: (v: string) => void;
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

function PeTipoDiccionarioMultiSelectGroup({
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
          Diccionario pronta entrega · COD.GRUPO
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

function TipoMultiSelectGroup({
  selected,
  onToggle,
  onClear,
  opciones = TIPO_GRUPO_OPCIONES,
}: {
  selected: TipoGrupoId[];
  onToggle: (id: TipoGrupoId) => void;
  onClear: () => void;
  opciones?: typeof TIPO_GRUPO_OPCIONES;
}) {
  if (!opciones.length) return null;
  const n = selected.length;
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title="Tipo" count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        <ul className="max-h-36 space-y-0.5 overflow-y-auto" role="group" aria-label="Tipo · multi-selección">
          {opciones.map((item) => {
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
    <div className="flex max-h-[calc(100vh-5rem)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-sm sm:min-w-[13.5rem] lg:w-64 lg:min-w-[16rem]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
        <div className="flex flex-col gap-2">{children}</div>
      </div>
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
  soloConStock = false,
  onSoloConStockChange,
  trailing,
  className = "",
  variant = "default",
  depositoLegal = "",
  onDepositoLegalChange,
}: Props) {
  const [bloqueDimOpen, setBloqueDimOpen] = useState(true);
  const [bloqueMolOpen, setBloqueMolOpen] = useState(true);
  const esPe = variant === "pe" || variant === "am";

  const patch = (p: Partial<OperativaFilterState>) =>
    onChange((prev) => ({ ...prev, ...p }));

  const dirty =
    hayFiltrosActivos(filtros) ||
    JSON.stringify(filtros) !== JSON.stringify(emptyFilters) ||
    (esPe && !!depositoLegal);

  const setRamo = (next: OperativaRamoTipo) => {
    const clear = filtros.ramoTipo === next;
    const ramoTipo: OperativaRamoTipo = clear ? "" : next;
    onChange((prev) => ({
      ...prev,
      ramoTipo,
      tipoV2Ids: [],
      tipoGrupos: sanitizeTipoGruposParaRamo(prev.tipoGrupos, ramoTipo),
      grupoEstiloIds: [],
      tipo1Ids: [],
      lineaIds: [],
      referenciaIds: [],
      materialFamilias: [],
      colorFamilias: [],
    }));
  };

  const ramo = (filtros.ramoTipo ?? "") as OperativaRamoTipo;

  const peTipoSelected = parsePeTipoSelected(filtros.tipoGrupos);

  const badgeDim =
    (ramo ? 1 : 0) +
    filtros.tipoV2Ids.length +
    filtros.tipo1Ids.length +
    filtros.marcaIds.length +
    (esPe ? peTipoSelected.length : filtros.tipoGrupos.length) +
    filtros.generoIds.length +
    (esPe && depositoLegal ? 1 : 0);

  const badgeMol =
    filtros.grupoEstiloIds.length +
    filtros.lineaIds.length +
    filtros.referenciaIds.length +
    filtros.materialFamilias.length +
    filtros.colorFamilias.length;

  return (
    <div
      className={`flex w-auto max-w-full min-h-0 flex-col gap-3 sm:flex-row sm:items-start ${className}`}
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
              onClick={() => {
                onChange(emptyFilters);
                onDepositoLegalChange?.("");
              }}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
            >
              Reset
            </button>
          ) : null}
        </div>

        {esPe ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Stock
            </span>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <button
                type="button"
                disabled
                title="Compra previa · usar Alejandro Magno / catálogo CP"
                className={`${SEG_BTN} ${SEG_OFF} cursor-not-allowed opacity-60`}
              >
                🚢 Compra previa
              </button>
              <button
                type="button"
                className={`${SEG_BTN} ${SEG_ON}`}
                aria-pressed
              >
                📦 Pronta entrega
              </button>
            </div>
          </div>
        ) : null}

        {esPe && onDepositoLegalChange ? (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Depósito
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => onDepositoLegalChange("")}
                className={`${SEG_BTN} ${!depositoLegal ? SEG_ON : SEG_OFF}`}
              >
                Todos
              </button>
              {RIMEC_SDRM_DEPOSIT_MAP.map((d) => (
                <button
                  key={d.csvColumn}
                  type="button"
                  onClick={() =>
                    onDepositoLegalChange(
                      depositoLegal === d.csvColumn ? "" : d.csvColumn,
                    )
                  }
                  className={`${SEG_BTN} ${
                    depositoLegal === d.csvColumn ? SEG_ON : SEG_OFF
                  }`}
                >
                  {d.deposito_codigo}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Categoría
          </span>
          <div className="flex flex-wrap gap-1">
            {(["CALZADO", "CONFECCIONES"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRamo(id)}
                className={`${SEG_BTN} ${ramo === id ? SEG_ON : SEG_OFF}`}
              >
                {PE_RAMO_LABEL[id]}
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

        <MultiSelectGroup
          title={tituloAbcrSidebar(filtros.ramoTipo)}
          items={opciones.tipo1}
          selected={filtros.tipo1Ids}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimensionesOperativa({
                tipo1Ids: toggleOperativaId(prev.tipo1Ids, id),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimensionesOperativa({ tipo1Ids: [] }) }))
          }
          defaultOpen={esPe}
        />

        <MultiSelectGroup
          title="Marca"
          items={opciones.marcas.map((m) => ({ ...m, label: cap(m.label) }))}
          selected={filtros.marcaIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimensionesOperativa({
                marcaIds: toggleOperativaId(prev.marcaIds, id),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimensionesOperativa({ marcaIds: [] }) }))
          }
          maxH="max-h-44"
        />

        {esPe ? (
          <PeTipoDiccionarioMultiSelectGroup
            selected={peTipoSelected}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                ...cascadaDimensionesOperativa({
                  tipoGrupos: togglePeTipoDiccionario(peTipoSelected, id),
                  cadenaComercial: null,
                }),
              }))
            }
            onClear={() =>
              onChange((prev) => ({
                ...prev,
                ...cascadaDimensionesOperativa({ tipoGrupos: [], cadenaComercial: null }),
              }))
            }
          />
        ) : (
          <TipoMultiSelectGroup
            selected={filtros.tipoGrupos.filter((g): g is TipoGrupoId => g !== "comun")}
            opciones={tipoGrupoOpcionesVisibles(filtros.ramoTipo)}
            onToggle={(id) =>
              onChange((prev) => ({
                ...prev,
                ...cascadaDimensionesOperativa({
                  tipoGrupos: sanitizeTipoGruposParaRamo(
                    toggleTipoGrupo(prev.tipoGrupos, id),
                    prev.ramoTipo,
                  ),
                }),
              }))
            }
            onClear={() =>
              onChange((prev) => ({
                ...prev,
                ...cascadaDimensionesOperativa({ tipoGrupos: [] }),
              }))
            }
          />
        )}

        <MultiSelectGroup
          title="Género"
          items={opciones.generos.map((g) => ({ ...g, label: cap(g.label) }))}
          selected={filtros.generoIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...cascadaDimensionesOperativa({
                generoIds: toggleOperativaId(prev.generoIds, id),
              }),
            }))
          }
          onClear={() =>
            onChange((prev) => ({ ...prev, ...cascadaDimensionesOperativa({ generoIds: [] }) }))
          }
        />

        {!esPe && onSoloConStockChange ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(e) => onSoloConStockChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-rimec-azul"
            />
            Solo con stock disponible
          </label>
        ) : null}

        {trailing}
      </BloqueColapsable>

      <BloqueColapsable
        title="Molécula"
        railLabel="L · R · M · C"
        badge={badgeMol}
        open={bloqueMolOpen}
        onToggle={() => setBloqueMolOpen((v) => !v)}
      >
        <p className="text-[10px] text-slate-500">
          Cascada: Estilo → Línea → Referencia → Material → Color · L-R-M-C 100%
        </p>

        <MultiSelectGroup
          title="Estilo"
          items={opciones.estilos}
          selected={filtros.grupoEstiloIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...toggleEstiloCascadaOp(prev.grupoEstiloIds, id),
            }))
          }
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              ...cascadaEstiloOperativa([]),
            }))
          }
          defaultOpen
        />

        <MultiSelectGroup
          title="Línea"
          items={opciones.lineas}
          selected={filtros.lineaIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...toggleLineaCascadaOp(prev.lineaIds, id),
            }))
          }
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              ...cascadaLineaOperativa([]),
            }))
          }
          maxH="max-h-48"
        />

        <MultiSelectGroup
          title="Referencia"
          items={opciones.referencias}
          selected={filtros.referenciaIds}
          onToggle={(id) =>
            onChange((prev) => ({
              ...prev,
              ...toggleReferenciaCascadaOp(prev.referenciaIds, id),
            }))
          }
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              ...cascadaReferenciaOperativa([]),
            }))
          }
          maxH="max-h-48"
        />

        <FamiliaMultiSelectGroup
          title="Material"
          items={opciones.materiales}
          selected={filtros.materialFamilias}
          onToggle={(key) =>
            onChange((prev) => ({
              ...prev,
              ...toggleMaterialCascadaOp(prev.materialFamilias, key),
            }))
          }
          onClear={() =>
            onChange((prev) => ({
              ...prev,
              materialFamilias: [],
              colorFamilias: [],
            }))
          }
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
