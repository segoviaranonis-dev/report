"use client";

/**
 * DIMENSIONES ∥ MOLÉCULA — paridad rimec-web CatalogoFiltrosSidebar
 * (captura Director · protocolo siameses · hermano AP).
 */

import { useEffect, useRef, useState } from "react";
import type { LineaReferenciaCascada, PilaresMaestras } from "@/lib/pilares/types";
import { TIPO1_UI_LABEL } from "@/lib/pilares/constants";
import { tipoGrupoOpcionesVisibles } from "@/lib/filtros/filtro-tipo-canonico";
import {
  cascadaColor,
  cascadaDimensiones,
  cascadaEstilo,
  cascadaLinea,
  cascadaMaterial,
  cascadaProblemasEstilo,
  cascadaReferencia,
  resetCascadaAlCambiarTipoV2,
  toggleId,
  toggleStr,
  type LrCabeceraPatch,
  type LrCabeceraState,
  type LrDepositoCodigo,
  type LrOrigenTipo,
} from "@/lib/pilares/lr-cascada-molecula";

const DEPOSITOS: { codigo: LrDepositoCodigo; label: string }[] = [
  { codigo: "D1", label: "D1" },
  { codigo: "DEP2", label: "DEP2" },
  { codigo: "D3", label: "D3" },
];

type FilterItem = { id: number; label: string };

type Props = {
  state: LrCabeceraState;
  onPatch: (patch: LrCabeceraPatch) => void;
  onLimpiar: () => void;
  maestras: PilaresMaestras;
  cascada: LineaReferenciaCascada;
  problemasResumen?: { total: number; con_imagen: number; sin_imagen: number } | null;
  loading?: boolean;
  /** split = 2 celdas del grid padre (Dim | Mol) · stack = columna única */
  layout?: "split" | "stack";
};

function cascadaToItems(items: { key: string; label: string; count: number }[]): FilterItem[] {
  return items
    .map((x) => ({ id: Number(x.key), label: `${x.label} (${x.count})` }))
    .filter((x) => Number.isFinite(x.id));
}

export function PilaresLrFiltrosSidebar({
  state,
  onPatch,
  onLimpiar,
  maestras,
  cascada,
  problemasResumen,
  loading,
  layout = "split",
}: Props) {
  const [bloqueDimOpen, setBloqueDimOpen] = useState(true);
  const [bloqueMolOpen, setBloqueMolOpen] = useState(true);
  const [buscarLocal, setBuscarLocal] = useState(state.buscar);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => setBuscarLocal(state.buscar), [state.buscar]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (buscarLocal !== stateRef.current.buscar) onPatch({ buscar: buscarLocal });
    }, 400);
    return () => clearTimeout(t);
  }, [buscarLocal, onPatch]);

  const esTodos = state.origen_tipo === "TODOS";
  const esCp = state.origen_tipo === "CP";
  const esPe = state.origen_tipo === "PRONTA_ENTREGA";
  const ramo = state.tipo_v2_id === 2 ? "CONFECCIONES" : "CALZADO";
  const abcrLabel = state.tipo_v2_id === 2 ? TIPO1_UI_LABEL[2] : "AB - CR";

  const badgeDim =
    (state.origen_tipo !== "TODOS" ? 1 : 0) +
    (state.deposito_codigo ? 1 : 0) +
    state.tipo_1_ids.length +
    state.marca_ids.length +
    state.tipo_grupos.length +
    state.genero_ids.length +
    (state.buscar.trim() ? 1 : 0);

  const badgeMol =
    state.estilo_ids.length +
    (state.estilo_null || state.problemas_estilo ? 1 : 0) +
    state.linea_ids.length +
    state.referencia_ids.length +
    state.material_familias.length +
    state.color_familias.length;

  const dirty = badgeDim + badgeMol > 0;
  const tipoOpts = tipoGrupoOpcionesVisibles(ramo);

  const setOrigen = (origen_tipo: LrOrigenTipo) => {
    onPatch(
      cascadaDimensiones({
        origen_tipo,
        deposito_codigo:
          origen_tipo === "PRONTA_ENTREGA" || origen_tipo === "TODOS"
            ? state.deposito_codigo
            : "",
      }),
    );
    if (origen_tipo === "PRONTA_ENTREGA") setBloqueMolOpen(true);
  };

  const lineasItems = cascadaToItems(cascada.lineas);
  const refsItems = cascadaToItems(cascada.referencias);
  const marcasItems = maestras.marcas.map((m) => ({ id: Number(m.id), label: m.label }));
  /** Estilo = cascada del universo filtrado (PE→SDRM venta hoy prioriza por count). */
  const estilosItems =
    cascada.estilos.length > 0
      ? cascadaToItems(cascada.estilos)
      : maestras.estilos.map((e) => ({ id: Number(e.id), label: e.label }));
  const tipos1Items = maestras.tipos1.map((t) => ({ id: Number(t.id), label: t.label }));
  const generosItems = maestras.generos.map((g) => ({ id: Number(g.id), label: g.label }));

  return (
    <>
      <aside
        className={`min-w-0 xl:sticky xl:top-3 xl:z-20 xl:self-start ${
          layout === "stack" ? "" : ""
        }`}
      >
        <div className="rounded-2xl border border-rimec-azul/25 bg-white/95 p-3 shadow-lg shadow-slate-900/10 ring-1 ring-black/5 backdrop-blur-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rimec-azul">
            Dimensiones
            {loading ? <span className="ml-2 font-normal text-slate-400">· …</span> : null}
          </p>
          {dirty ? (
            <button
              type="button"
              onClick={onLimpiar}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50"
            >
              Reset
            </button>
          ) : null}
        </div>
        <BloqueColapsable
          title="Dimensiones"
          railLabel="Dimensiones"
          badge={badgeDim}
          open={bloqueDimOpen}
          onToggle={() => setBloqueDimOpen((v) => !v)}
        >
          <p className="text-[11px] text-slate-500">Multi-selección</p>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Stock
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <StockBtn active={esTodos} onClick={() => setOrigen("TODOS")}>
                ⧉ Todos
              </StockBtn>
              <StockBtn active={esCp} onClick={() => setOrigen(esCp ? "TODOS" : "CP")}>
                🚢 Compra previa
              </StockBtn>
              <StockBtn
                active={esPe}
                onClick={() => setOrigen(esPe ? "TODOS" : "PRONTA_ENTREGA")}
                title="Artículos con stock SDRM disponible (venta hoy) ∩ PE"
              >
                📦 Pronta entrega
              </StockBtn>
            </div>
            {esPe ? (
              <p className="text-[10px] leading-snug text-emerald-800">
                <strong>Scope SDRM venta hoy</strong> (stock disponible ∩ PE). Estilos ordenados
                por ese universo. Lo que edites en la grilla sigue siendo la{" "}
                <strong>maestra L×R → FK filtros</strong>.
              </p>
            ) : null}
          </div>

          {(esPe || esTodos) && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Depósito
              </span>
              <div className="flex flex-wrap gap-1">
                <SegBtn
                  active={!state.deposito_codigo}
                  onClick={() => onPatch({ deposito_codigo: "" })}
                >
                  Todos
                </SegBtn>
                {DEPOSITOS.map((d) => (
                  <SegBtn
                    key={d.codigo}
                    active={state.deposito_codigo === d.codigo}
                    onClick={() =>
                      onPatch({
                        deposito_codigo:
                          state.deposito_codigo === d.codigo ? "" : d.codigo,
                        origen_tipo:
                          state.origen_tipo === "CP" ? "TODOS" : state.origen_tipo,
                      })
                    }
                  >
                    {d.label}
                  </SegBtn>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Categoría
            </span>
            <div className="flex flex-wrap gap-1">
              <SegBtn
                active={state.tipo_v2_id === 1}
                onClick={() => onPatch(resetCascadaAlCambiarTipoV2(1))}
              >
                Calzado
              </SegBtn>
              <SegBtn
                active={state.tipo_v2_id === 2}
                onClick={() => onPatch(resetCascadaAlCambiarTipoV2(2))}
              >
                Confecciones
              </SegBtn>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Buscar
            </span>
            <input
              type="search"
              value={buscarLocal}
              onChange={(e) => setBuscarLocal(e.target.value)}
              placeholder="L-R-M-C · línea · marca…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
            />
          </label>

          <MultiSelectGroup
            title={`${abcrLabel} · multi`}
            items={tipos1Items}
            selected={state.tipo_1_ids}
            onToggle={(id) =>
              onPatch(cascadaDimensiones({ tipo_1_ids: toggleId(state.tipo_1_ids, id) }))
            }
            onClear={() => onPatch(cascadaDimensiones({ tipo_1_ids: [] }))}
          />

          <MultiSelectGroup
            title="Marca · multi"
            items={marcasItems}
            selected={state.marca_ids}
            onToggle={(id) =>
              onPatch(cascadaDimensiones({ marca_ids: toggleId(state.marca_ids, id) }))
            }
            onClear={() => onPatch(cascadaDimensiones({ marca_ids: [] }))}
            filterable
          />

          <MultiSelectGroup
            title="Tipo · multi"
            items={tipoOpts.map((o) => ({ id: hashTipo(o.id), label: o.label }))}
            selected={state.tipo_grupos.map(hashTipo)}
            onToggle={(id) => {
              const opt = tipoOpts.find((o) => hashTipo(o.id) === id);
              if (!opt) return;
              onPatch(
                cascadaDimensiones({
                  tipo_grupos: toggleStr(state.tipo_grupos, opt.id),
                }),
              );
            }}
            onClear={() => onPatch(cascadaDimensiones({ tipo_grupos: [] }))}
          />

          <MultiSelectGroup
            title="Género · multi"
            items={generosItems}
            selected={state.genero_ids}
            onToggle={(id) =>
              onPatch(cascadaDimensiones({ genero_ids: toggleId(state.genero_ids, id) }))
            }
            onClear={() => onPatch(cascadaDimensiones({ genero_ids: [] }))}
          />
        </BloqueColapsable>
        </div>
      </aside>

      <aside className="min-w-0 xl:sticky xl:top-3 xl:z-20 xl:self-start">
        <div className="rounded-2xl border border-rimec-azul/25 bg-white/95 p-3 shadow-lg shadow-slate-900/10 ring-1 ring-black/5 backdrop-blur-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-rimec-azul">
          Molécula · herramientas
        </p>
        <BloqueColapsable
          title="Molécula"
          railLabel="L · R · M · C"
          badge={badgeMol}
          open={bloqueMolOpen}
          onToggle={() => setBloqueMolOpen((v) => !v)}
        >
          <p className="text-[10px] text-slate-500">
            Cascada: Estilo → Línea → Referencia → Material → Color
          </p>

          <div className="flex flex-wrap gap-1">
            <SegBtn
              active={state.problemas_estilo}
              onClick={() => onPatch(cascadaProblemasEstilo(!state.problemas_estilo))}
            >
              Problemas
              {problemasResumen != null ? ` (${problemasResumen.total})` : ""}
            </SegBtn>
          </div>

          {state.problemas_estilo ? (
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950">
                Foto · deuda estilo
              </p>
              <div className="flex flex-wrap gap-1">
                <SegBtn
                  active={state.con_imagen === ""}
                  onClick={() => onPatch({ con_imagen: "" })}
                >
                  Todas
                </SegBtn>
                <SegBtn
                  active={state.con_imagen === "1"}
                  onClick={() =>
                    onPatch({ con_imagen: state.con_imagen === "1" ? "" : "1" })
                  }
                >
                  Con imagen
                  {problemasResumen != null
                    ? ` (${problemasResumen.con_imagen})`
                    : ""}
                </SegBtn>
                <SegBtn
                  active={state.con_imagen === "0"}
                  onClick={() =>
                    onPatch({ con_imagen: state.con_imagen === "0" ? "" : "0" })
                  }
                >
                  Sin imagen
                  {problemasResumen != null
                    ? ` (${problemasResumen.sin_imagen})`
                    : ""}
                </SegBtn>
              </div>
              <p className="text-[10px] leading-snug text-amber-900/90">
                Problema = Sin estilo ∪ OTROS. Con foto → reclasificar; sin foto → COD.GRUPO /
                pedir foto. Sugerido no auto-guarda.
              </p>
            </div>
          ) : null}

          <MultiSelectGroup
            title={esPe ? "Estilo · venta hoy · multi" : "Estilo · multi"}
            items={estilosItems}
            selected={state.estilo_ids}
            onToggle={(id) => onPatch(cascadaEstilo(toggleId(state.estilo_ids, id)))}
            onClear={() => onPatch(cascadaEstilo([]))}
            defaultOpen
            filterable
          />

          <MultiSelectGroup
            title="Línea · multi"
            items={lineasItems}
            selected={state.linea_ids}
            onToggle={(id) => onPatch(cascadaLinea(toggleId(state.linea_ids, id)))}
            onClear={() => onPatch(cascadaLinea([]))}
          />

          <MultiSelectGroup
            title="Referencia · multi"
            items={refsItems}
            selected={state.referencia_ids}
            onToggle={(id) => onPatch(cascadaReferencia(toggleId(state.referencia_ids, id)))}
            onClear={() => onPatch(cascadaReferencia([]))}
          />

          <MultiSelectStrGroup
            title="Material · multi"
            items={cascada.materiales.map((m) => ({
              key: m.key,
              label: `${m.label} (${m.count})`,
            }))}
            selected={state.material_familias}
            onToggle={(key) =>
              onPatch(cascadaMaterial(toggleStr(state.material_familias, key)))
            }
            onClear={() => onPatch(cascadaMaterial([]))}
            emptyLabel="Sin material en universo filtrado (staging)"
          />

          <MultiSelectStrGroup
            title="Color · multi"
            items={cascada.colores.map((c) => ({
              key: c.key,
              label: `${c.label} (${c.count})`,
            }))}
            selected={state.color_familias}
            onToggle={(key) => onPatch(cascadaColor(toggleStr(state.color_familias, key)))}
            onClear={() => onPatch(cascadaColor([]))}
            emptyLabel="Sin color en universo filtrado (staging)"
          />
        </BloqueColapsable>
        </div>
      </aside>
    </>
  );
}

function hashTipo(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function BloqueColapsable({
  title,
  badge,
  open,
  onToggle,
  children,
  railLabel: _railLabel,
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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm hover:border-rimec-azul/40"
        aria-expanded={false}
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-rimec-azul">
          {title}
        </span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
            {badge}
          </span>
        ) : (
          <span className="text-rimec-azul">▸</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-full min-w-0 rounded-xl border border-slate-200/90 bg-white/95 p-2.5 shadow-sm ring-1 ring-black/5">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rimec-azul">
          {title}
          {badge && badge > 0 ? (
            <span className="ml-1.5 rounded-full bg-rimec-azul px-1.5 py-0.5 text-[9px] font-black text-white">
              {badge}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-rimec-azul"
          aria-label={`Ocultar ${title}`}
        >
          ▾
        </button>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
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
  defaultOpen = false,
  filterable = false,
}: {
  title: string;
  items: FilterItem[];
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  emptyLabel?: string;
  defaultOpen?: boolean;
  filterable?: boolean;
}) {
  const n = selected.length;
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const visible = needle
    ? items.filter((it) => String(it.label ?? "").toLowerCase().includes(needle))
    : items;
  return (
    <details open={defaultOpen} className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={`${title} · ${items.length}`} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <>
            {filterable && items.length > 6 ? (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar lista…"
                className="mb-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none"
              />
            ) : null}
            <ul className="space-y-0.5" role="group">
              {visible.map((item) => {
                const id = Number(item.id);
                if (!Number.isFinite(id)) return null;
                const on = selected.includes(id);
                return (
                  <li key={id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        on
                          ? "bg-rimec-azul/10 font-semibold text-rimec-azul"
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
          </>
        )}
      </div>
    </details>
  );
}

function MultiSelectStrGroup({
  title,
  items,
  selected,
  onToggle,
  onClear,
  emptyLabel = "Sin opciones",
}: {
  title: string;
  items: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  emptyLabel?: string;
}) {
  const n = selected.length;
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const visible = needle
    ? items.filter((it) => it.label.toLowerCase().includes(needle) || it.key.toLowerCase().includes(needle))
    : items;
  return (
    <details className="group rounded-lg border border-slate-200/90 bg-white">
      <AcordeonHeader title={`${title} · ${items.length}`} count={n} onClear={onClear} />
      <div className="border-t border-slate-100 p-1.5">
        {items.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
        ) : (
          <>
            {items.length > 6 ? (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar lista…"
                className="mb-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-rimec-azul focus:outline-none"
              />
            ) : null}
            <ul className="space-y-0.5" role="group">
              {visible.map((item) => {
                const on = selected.includes(item.key);
                return (
                  <li key={item.key}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        on
                          ? "bg-rimec-azul/10 font-semibold text-rimec-azul"
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
          </>
        )}
      </div>
    </details>
  );
}

function StockBtn({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-full rounded-lg border px-2 py-2.5 text-left text-[11px] font-semibold transition ${
        active
          ? "border-rimec-azul bg-rimec-azul text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
        active
          ? "bg-rimec-azul text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
