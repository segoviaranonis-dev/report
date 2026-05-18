"use client";

import React, { useEffect, useRef, useState } from "react";
import type { FullSnapshotCascada } from "@/lib/rimec/full-snapshot-types";
import type { SalesReportFilters } from "@/modules/sales-report/types";
import { MESES_LISTA } from "@/modules/sales-report/constants";
import { mesesSemestre } from "../rimec-view-utils";

function summarizeList(items: string[], max = 2): string {
  if (!items.length) return "Ninguno";
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max}`;
}

function summarizeCats(ids: number[], cascada: FullSnapshotCascada): string {
  if (!ids.length) return "—";
  const names = ids
    .map((id) => cascada.categorias.find((c) => c.id_categoria === id)?.nombre ?? `#${id}`)
    .slice(0, 2);
  return ids.length > 2 ? `${names.join(", ")} +${ids.length - 2}` : names.join(", ");
}

function CascadeBlock({
  title,
  summary,
  open,
  onOpen,
  disabled,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onOpen()}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-white/40">{title}</div>
          <div className="truncate text-xs text-yellow-400/90">{summary}</div>
        </div>
        <span className="shrink-0 text-white/50">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="border-t border-white/10 px-2 py-2">{children}</div> : null}
    </div>
  );
}

type Props = {
  filtros: SalesReportFilters;
  setFiltros: React.Dispatch<React.SetStateAction<SalesReportFilters>>;
  cascada: FullSnapshotCascada | null;
  hasSyncedOnce: boolean;
};

export function ImmersiveFiltersPanel({ filtros, setFiltros, cascada, hasSyncedOnce }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const mesesPool = cascada?.meses_nombres?.length ? cascada.meses_nombres : MESES_LISTA;
  const canPick = Boolean(cascada && hasSyncedOnce);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggleOpen = (id: string) => {
    setOpen((k) => (k === id ? null : id));
  };

  const deptoSummary =
    filtros.departamento.toUpperCase() === "TODOS" ? "TODOS (Calzados + Confecciones)" : filtros.departamento;

  const setSem = (which: "s1" | "s2" | "year") => {
    const want = mesesSemestre(which);
    const allowed = want.filter((m) => mesesPool.includes(m));
    setFiltros((f) => ({
      ...f,
      meses:
        allowed.length > 0
          ? allowed
          : mesesPool.length
            ? [mesesPool[0]]
            : [want[0] ?? "Enero"],
    }));
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <CascadeBlock
        title="Depto / Tipo"
        summary={deptoSummary}
        open={open === "depto"}
        onOpen={() => toggleOpen("depto")}
        disabled={!canPick || !cascada?.departamentos.length}
      >
        <ul className="max-h-52 overflow-y-auto custom-scrollbar">
          {cascada?.departamentos.map((t) => {
            const active = filtros.departamento.trim().toUpperCase() === t.trim().toUpperCase();
            return (
              <li key={t}>
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                    active ? "bg-yellow-400/15 text-yellow-300" : "text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => {
                    setFiltros((f) => ({
                      ...f,
                      departamento: t,
                      marcas: [],
                      cadenas: [],
                      vendedores: [],
                    }));
                    setOpen(null);
                  }}
                >
                  {t.toUpperCase() === "TODOS" ? "TODOS (Calzados + Confecciones)" : t}
                </button>
              </li>
            );
          })}
        </ul>
      </CascadeBlock>

      <div>
        <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-white/40">Período rápido</div>
        <div className="flex gap-2">
          {(
            [
              ["s1", "1er Sem"],
              ["s2", "2do Sem"],
              ["year", "Año"],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSem(k)}
              className="flex-1 rounded-full border border-white/10 bg-black/20 py-1.5 text-[10px] uppercase text-white/60 transition hover:border-yellow-400/50 hover:text-yellow-400"
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      <CascadeBlock
        title="Meses"
        summary={
          filtros.meses.length ? `${filtros.meses.length} meses · ${summarizeList(filtros.meses, 3)}` : "—"
        }
        open={open === "meses"}
        onOpen={() => toggleOpen("meses")}
        disabled={!canPick}
      >
        <div className="flex flex-wrap gap-1.5">
          {mesesPool.map((m) => {
            const on = filtros.meses.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setFiltros((f) => {
                    const has = f.meses.includes(m);
                    const meses = has ? f.meses.filter((x) => x !== m) : [...f.meses, m];
                    return { ...f, meses: meses.length ? meses : [m] };
                  })
                }
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase transition ${
                  on
                    ? "border-yellow-400 bg-yellow-400 text-black"
                    : "border-white/10 bg-black/30 text-white/60 hover:border-white/30"
                }`}
              >
                {m.substring(0, 3)}
              </button>
            );
          })}
        </div>
      </CascadeBlock>

      <CascadeBlock
        title="Categorías"
        summary={cascada ? summarizeCats(filtros.categoria_ids, cascada) : "—"}
        open={open === "cat"}
        onOpen={() => toggleOpen("cat")}
        disabled={!canPick || !cascada?.categorias.length}
      >
        <div className="flex flex-wrap gap-1.5">
          {cascada?.categorias.map((c) => {
            const on = filtros.categoria_ids.includes(c.id_categoria);
            return (
              <button
                key={c.id_categoria}
                type="button"
                onClick={() =>
                  setFiltros((f) => {
                    const has = f.categoria_ids.includes(c.id_categoria);
                    const categoria_ids = has
                      ? f.categoria_ids.filter((x) => x !== c.id_categoria)
                      : [...f.categoria_ids, c.id_categoria];
                    return { ...f, categoria_ids: categoria_ids.length ? categoria_ids : [c.id_categoria] };
                  })
                }
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase transition ${
                  on
                    ? "border-white/40 bg-white/15 text-white"
                    : "border-white/10 bg-black/30 text-white/50 hover:border-white/25"
                }`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
      </CascadeBlock>

      <CascadeBlock
        title="Marcas"
        summary={summarizeList(filtros.marcas)}
        open={open === "marca"}
        onOpen={() => toggleOpen("marca")}
        disabled={!canPick || !cascada?.marcas.length}
      >
        <div className="mb-2 flex justify-end gap-2 text-[9px] text-yellow-400/80">
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFiltros((f) => ({ ...f, marcas: [...(cascada?.marcas ?? [])] }))}
          >
            Todas
          </button>
          <button type="button" className="hover:underline" onClick={() => setFiltros((f) => ({ ...f, marcas: [] }))}>
            Ninguna
          </button>
        </div>
        <ul className="max-h-44 space-y-1 overflow-y-auto custom-scrollbar">
          {cascada?.marcas.map((opt, i) => (
            <li key={`${opt}-${i}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-white/80 hover:bg-white/10">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-yellow-400"
                  checked={filtros.marcas.includes(opt)}
                  onChange={() =>
                    setFiltros((f) => {
                      const has = f.marcas.includes(opt);
                      return { ...f, marcas: has ? f.marcas.filter((x) => x !== opt) : [...f.marcas, opt] };
                    })
                  }
                />
                <span className="min-w-0 truncate">{opt}</span>
              </label>
            </li>
          ))}
        </ul>
      </CascadeBlock>

      <CascadeBlock
        title="Cadenas"
        summary={summarizeList(filtros.cadenas)}
        open={open === "cadena"}
        onOpen={() => toggleOpen("cadena")}
        disabled={!canPick || !cascada?.cadenas.length}
      >
        <div className="mb-2 flex justify-end gap-2 text-[9px] text-yellow-400/80">
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFiltros((f) => ({ ...f, cadenas: [...(cascada?.cadenas ?? [])] }))}
          >
            Todas
          </button>
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFiltros((f) => ({ ...f, cadenas: [] }))}
          >
            Ninguna
          </button>
        </div>
        <ul className="max-h-44 space-y-1 overflow-y-auto custom-scrollbar">
          {cascada?.cadenas.map((opt, i) => (
            <li key={`${opt}-${i}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-white/80 hover:bg-white/10">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-yellow-400"
                  checked={filtros.cadenas.includes(opt)}
                  onChange={() =>
                    setFiltros((f) => {
                      const has = f.cadenas.includes(opt);
                      return { ...f, cadenas: has ? f.cadenas.filter((x) => x !== opt) : [...f.cadenas, opt] };
                    })
                  }
                />
                <span className="min-w-0 truncate">{opt}</span>
              </label>
            </li>
          ))}
        </ul>
      </CascadeBlock>

      <CascadeBlock
        title="Vendedores"
        summary={summarizeList(filtros.vendedores)}
        open={open === "vend"}
        onOpen={() => toggleOpen("vend")}
        disabled={!canPick || !cascada?.vendedores.length}
      >
        <div className="mb-2 flex justify-end gap-2 text-[9px] text-yellow-400/80">
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFiltros((f) => ({ ...f, vendedores: [...(cascada?.vendedores ?? [])] }))}
          >
            Todos
          </button>
          <button
            type="button"
            className="hover:underline"
            onClick={() => setFiltros((f) => ({ ...f, vendedores: [] }))}
          >
            Ninguno
          </button>
        </div>
        <ul className="max-h-44 space-y-1 overflow-y-auto custom-scrollbar">
          {cascada?.vendedores.map((opt, i) => (
            <li key={`${opt}-${i}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-white/80 hover:bg-white/10">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-yellow-400"
                  checked={filtros.vendedores.includes(opt)}
                  onChange={() =>
                    setFiltros((f) => {
                      const has = f.vendedores.includes(opt);
                      return {
                        ...f,
                        vendedores: has ? f.vendedores.filter((x) => x !== opt) : [...f.vendedores, opt],
                      };
                    })
                  }
                />
                <span className="min-w-0 truncate">{opt}</span>
              </label>
            </li>
          ))}
        </ul>
      </CascadeBlock>

      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-white/40">Cód. cliente (exacto)</div>
        <input
          type="text"
          className="w-full border-b border-white/10 bg-transparent py-1.5 text-xs text-white outline-none focus:border-yellow-400"
          value={filtros.id_cliente_exacto ?? ""}
          onChange={(e) => setFiltros((f) => ({ ...f, id_cliente_exacto: e.target.value.trim() || null }))}
          placeholder="Opcional"
        />
      </div>
    </div>
  );
}
