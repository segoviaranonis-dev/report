"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type {
  AprobacionesFiltros,
  AprobacionesFiltrosOpciones,
} from "../lib/aprobaciones-filtros-types";
import { FILTROS_VACIOS, filtrosActivos } from "../lib/aprobaciones-filtros-types";

type Props = {
  filtros: AprobacionesFiltros;
  onChange: (f: AprobacionesFiltros) => void;
  onApply: () => void;
  onClear: () => void;
  aplicando?: boolean;
};

function toggleStr(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function toggleNum(list: number[], value: number): number[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function StringMulti({
  title,
  items,
  selected,
  onToggle,
  onClear,
  maxH = "max-h-32",
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  maxH?: string;
}) {
  const uniqueItems = [...new Set(items.map((s) => s.trim()).filter(Boolean))];

  return (
    <details className="rounded-lg border border-neutral-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-neutral-800">
        {title}
        {selected.length > 0 ? (
          <span className="ml-2 rounded-full bg-rimec-azul/15 px-2 py-0.5 text-[10px] text-rimec-azul">
            {selected.length}
          </span>
        ) : null}
        {selected.length > 0 ? (
          <button
            type="button"
            className="ml-2 text-[10px] font-semibold text-red-600 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
          >
            Limpiar
          </button>
        ) : null}
      </summary>
      <ul className={`${maxH} space-y-0.5 overflow-y-auto border-t border-neutral-100 p-2`}>
        {uniqueItems.length === 0 ? (
          <li className="text-[11px] text-neutral-400">Sin opciones</li>
        ) : (
          uniqueItems.map((item, i) => (
            <li key={`${title}-${i}-${item}`}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() => onToggle(item)}
                  className="rounded border-neutral-300"
                />
                <span className="truncate" title={item}>
                  {item}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </details>
  );
}

function ClienteMulti({
  clientes,
  selectedIds,
  onToggleId,
  onClear,
}: {
  clientes: { id: number; nombre: string }[];
  selectedIds: number[];
  onToggleId: (id: number) => void;
  onClear: () => void;
}) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-neutral-800">
        Código / cliente
        {selectedIds.length > 0 ? (
          <span className="ml-2 rounded-full bg-rimec-azul/15 px-2 py-0.5 text-[10px] text-rimec-azul">
            {selectedIds.length}
          </span>
        ) : null}
      </summary>
      <ul className="max-h-32 space-y-0.5 overflow-y-auto border-t border-neutral-100 p-2">
        {clientes.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => onToggleId(c.id)}
                className="rounded border-neutral-300"
              />
              <span className="truncate" title={`${c.id} · ${c.nombre}`}>
                <strong>{c.id}</strong> · {c.nombre}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {selectedIds.length > 0 ? (
        <div className="border-t border-neutral-100 px-2 py-1">
          <button type="button" className="text-[10px] text-red-600 hover:underline" onClick={onClear}>
            Limpiar clientes
          </button>
        </div>
      ) : null}
    </details>
  );
}

function GrupoDpeMulti({
  items,
  selected,
  onToggle,
  onClear,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-neutral-800">
        Cód. interno DPE (GRUPO2)
        {selected.length > 0 ? (
          <span className="ml-2 rounded-full bg-rimec-azul/15 px-2 py-0.5 text-[10px] text-rimec-azul">
            {selected.length}
          </span>
        ) : null}
      </summary>
      <ul className="max-h-32 space-y-0.5 overflow-y-auto border-t border-neutral-100 p-2">
        {items.map((g) => (
          <li key={g.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() => onToggle(g.id)}
                className="rounded border-neutral-300"
              />
              <span className="truncate" title={`${g.id} · ${g.label}`}>
                {g.id} · {g.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {selected.length > 0 ? (
        <div className="border-t border-neutral-100 px-2 py-1">
          <button type="button" className="text-[10px] text-red-600 hover:underline" onClick={onClear}>
            Limpiar DPE
          </button>
        </div>
      ) : null}
    </details>
  );
}

export function AprobacionesFiltrosPanel({
  filtros,
  onChange,
  onApply,
  onClear,
  aplicando,
}: Props) {
  const [opciones, setOpciones] = useState<AprobacionesFiltrosOpciones | null>(null);
  const [opcionesError, setOpcionesError] = useState<string | null>(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [open, setOpen] = useState(true);
  const [detalleCompleto, setDetalleCompleto] = useState(false);

  useEffect(() => {
    if (!open || opciones) return;
    setCargandoOpciones(true);
    setOpcionesError(null);
    void fetch("/api/aprobaciones/filtros/opciones?scope=basico", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<AprobacionesFiltrosOpciones>;
      })
      .then((j) => setOpciones(j))
      .catch(() => {
        setOpcionesError("No se pudieron cargar listas — usá los campos de texto abajo.");
        setOpciones({
          clientes: [],
          marcas: [],
          vendedores: [],
          codigosArticulo: [],
          codigosGrupoDpe: [],
        });
      })
      .finally(() => setCargandoOpciones(false));
  }, [open, opciones]);

  useEffect(() => {
    if (!open || !opciones || detalleCompleto) return;
    void fetch("/api/aprobaciones/filtros/opciones?scope=completo", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<AprobacionesFiltrosOpciones>;
      })
      .then((j) => {
        if (!j) return;
        setOpciones((prev) =>
          prev
            ? {
                ...prev,
                codigosArticulo: j.codigosArticulo,
                codigosGrupoDpe: j.codigosGrupoDpe,
              }
            : j,
        );
        setDetalleCompleto(true);
      })
      .catch(() => {
        /* artículo/DPE opcional — campos texto siguen funcionando */
      });
  }, [open, opciones, detalleCompleto]);

  const patch = (p: Partial<AprobacionesFiltros>) => onChange({ ...filtros, ...p });

  return (
    <section className="border-b border-neutral-200 bg-neutral-50/80">
      <div className="mx-auto max-w-6xl px-6 py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-rimec-azul-dark"
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            🔍 Indagar pedidos
            {filtrosActivos(filtros) ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                Filtros activos
              </span>
            ) : null}
          </span>
          <span className="text-xs text-neutral-500">{open ? "Ocultar" : "Mostrar"}</span>
        </button>

        {open ? (
          <div className="mt-3 space-y-3">
            <p className="text-[11px] text-neutral-600">
              Multi-select · paridad CSV · línea/referencia · PV · nro FI · fechas
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">Línea (contiene)</span>
                <input
                  type="text"
                  value={filtros.lineaQ}
                  onChange={(e) => patch({ lineaQ: e.target.value })}
                  placeholder="ej. 2950"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">Referencia (contiene)</span>
                <input
                  type="text"
                  value={filtros.referenciaQ}
                  onChange={(e) => patch({ referenciaQ: e.target.value })}
                  placeholder="ej. 256"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">PV global</span>
                <input
                  type="text"
                  value={filtros.pvGlobalQ}
                  onChange={(e) => patch({ pvGlobalQ: e.target.value })}
                  placeholder="PV000340 o 340"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">Nro. FI</span>
                <input
                  type="text"
                  value={filtros.nroFacturaQ}
                  onChange={(e) => patch({ nroFacturaQ: e.target.value })}
                  placeholder="87-PV005"
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">Fecha desde</span>
                <input
                  type="date"
                  value={filtros.fechaDesde ?? ""}
                  onChange={(e) => patch({ fechaDesde: e.target.value || null })}
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs">
                <span className="font-semibold text-neutral-700">Fecha hasta</span>
                <input
                  type="date"
                  value={filtros.fechaHasta ?? ""}
                  onChange={(e) => patch({ fechaHasta: e.target.value || null })}
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            {opcionesError ? (
              <p className="text-xs text-amber-800">{opcionesError}</p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cargandoOpciones ? (
                <p className="text-xs text-neutral-500">Cargando listas…</p>
              ) : opciones ? (
                <>
                  <ClienteMulti
                    clientes={opciones.clientes}
                    selectedIds={filtros.clienteIds}
                    onToggleId={(id) => patch({ clienteIds: toggleNum(filtros.clienteIds, id) })}
                    onClear={() => patch({ clienteIds: [] })}
                  />
                  <StringMulti
                    title="Nombre cliente"
                    items={opciones.clientes.map((c) => c.nombre)}
                    selected={filtros.clienteNombres}
                    onToggle={(v) => patch({ clienteNombres: toggleStr(filtros.clienteNombres, v) })}
                    onClear={() => patch({ clienteNombres: [] })}
                  />
                  <StringMulti
                    title="Marca"
                    items={opciones.marcas}
                    selected={filtros.marcas}
                    onToggle={(v) => patch({ marcas: toggleStr(filtros.marcas, v) })}
                    onClear={() => patch({ marcas: [] })}
                  />
                  <StringMulti
                    title="Vendedor"
                    items={opciones.vendedores}
                    selected={filtros.vendedores}
                    onToggle={(v) => patch({ vendedores: toggleStr(filtros.vendedores, v) })}
                    onClear={() => patch({ vendedores: [] })}
                  />
                  <StringMulti
                    title={
                      detalleCompleto
                        ? "C. Art. Prov (654/638)"
                        : "C. Art. Prov (654/638) — cargando…"
                    }
                    items={opciones.codigosArticulo}
                    selected={filtros.codigosArticulo}
                    onToggle={(v) => patch({ codigosArticulo: toggleStr(filtros.codigosArticulo, v) })}
                    onClear={() => patch({ codigosArticulo: [] })}
                    maxH="max-h-40"
                  />
                  <GrupoDpeMulti
                    items={opciones.codigosGrupoDpe}
                    selected={filtros.codigosGrupoDpe}
                    onToggle={(id) =>
                      patch({ codigosGrupoDpe: toggleStr(filtros.codigosGrupoDpe, id) })
                    }
                    onClear={() => patch({ codigosGrupoDpe: [] })}
                  />
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onApply} disabled={aplicando}>
                {aplicando ? "Buscando…" : "Aplicar filtros"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onChange({ ...FILTROS_VACIOS });
                  onClear();
                }}
                disabled={aplicando}
              >
                Limpiar todo
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
