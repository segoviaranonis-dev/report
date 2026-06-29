"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConfeccionRow } from "@/app/api/depositos/[cliente_id]/operativa/confecciones/route";
import type { ConfeccionesFiltrosResponse } from "@/app/api/depositos/[cliente_id]/operativa/confecciones/filtros/route";
import type { CategoriaDeposito } from "@/lib/depositos/depositos-config";
import {
  EMPTY_CONFECCIONES_FILTERS,
  type ConfeccionesFilterState,
} from "@/lib/depositos/confecciones-operativa-filters";
import { calcValorInventario, formatPrecioGs } from "@/lib/depositos/precio-venta";
import { DepositoProductThumb } from "./DepositoProductThumb";

function fmt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

type SortMode = "uds" | "linea";

type Props = {
  clienteId: number;
  categoria: CategoriaDeposito;
};

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: number; label: string; count?: number }[];
  value: number | "";
  onChange: (id: number | "") => void;
}) {
  if (!items.length) return null;
  return (
    <label className="block min-w-[120px] flex-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-report-muted">{label}</span>
      <select
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="mt-1 w-full rounded-lg border border-report-rule bg-white px-2 py-2 text-sm"
      >
        <option value="">Todas</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} ({item.count ?? 0})
          </option>
        ))}
      </select>
    </label>
  );
}

function rowKey(r: ConfeccionRow, i: number) {
  return `${r.linea_id}-${r.referencia_id}-${r.material_id}-${r.color_id}-${r.grada}-${i}`;
}

export function TabOperativaConfecciones({ clienteId, categoria }: Props) {
  const [filtros, setFiltros] = useState<ConfeccionesFilterState>(EMPTY_CONFECCIONES_FILTERS);
  const [opciones, setOpciones] = useState<ConfeccionesFiltrosResponse | null>(null);
  const [filas, setFilas] = useState<ConfeccionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalUds, setTotalUds] = useState(0);
  const [totalValor, setTotalValor] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortMode>("uds");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pageSize = 100;

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("categoria", categoria);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    p.set("sort", sort);
    for (const id of filtros.marcaIds) p.append("marca_id", String(id));
    for (const id of filtros.lineaIds) p.append("linea_id", String(id));
    for (const id of filtros.referenciaIds) p.append("referencia_id", String(id));
    for (const id of filtros.colorIds) p.append("color_id", String(id));
    for (const g of filtros.gradas) p.append("grada", g);
    if (filtros.q.trim()) p.set("q", filtros.q.trim());
    return p.toString();
  }, [categoria, page, sort, filtros]);

  useEffect(() => {
    fetch(`/api/depositos/${clienteId}/operativa/confecciones/filtros?categoria=${categoria}`)
      .then((r) => r.json())
      .then((j: ConfeccionesFiltrosResponse) => setOpciones(j))
      .catch(() => setOpciones(null));
  }, [clienteId, categoria]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/depositos/${clienteId}/operativa/confecciones?${queryString}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error al cargar");
      setFilas(j.filas ?? []);
      setTotal(j.total ?? 0);
      setTotalUds(j.total_uds ?? 0);
      setTotalValor(j.total_valor ?? 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setFilas([]);
      setTotal(0);
      setTotalUds(0);
      setTotalValor(0);
    } finally {
      setLoading(false);
    }
  }, [clienteId, queryString]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setPage(1);
  }, [filtros, categoria, sort]);

  const setSingleId = (
    key: keyof Pick<ConfeccionesFilterState, "marcaIds" | "lineaIds" | "referenciaIds" | "colorIds">,
    id: number | "",
  ) => {
    setFiltros((prev) => ({ ...prev, [key]: id === "" ? [] : [id] }));
  };

  const udsPagina = filas.reduce((s, r) => s + r.cantidad, 0);
  const valorPagina = calcValorInventario(filas);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const marcaSel = filtros.marcaIds[0] ?? "";
  const lineaSel = filtros.lineaIds[0] ?? "";
  const refSel = filtros.referenciaIds[0] ?? "";
  const colorSel = filtros.colorIds[0] ?? "";
  const gradaSel = filtros.gradas[0] ?? "";

  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border-2 border-bazzar-naranja/40 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-4 py-4 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-bazzar-naranja">
          Stock confección · filas con cantidad y monto
        </p>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:gap-4">
          <div className="flex flex-1 flex-col items-center rounded-xl border border-rimec-azul/25 bg-white px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-rimec-azul">
              Renglones
            </span>
            <span className="mt-1 text-3xl font-black tabular-nums text-rimec-azul">
              {fmt(total)}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center rounded-xl border border-bazzar-naranja/30 bg-white px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-bazzar-naranja-dark">
              Unidades
            </span>
            <span className="mt-1 text-3xl font-black tabular-nums text-bazzar-naranja-dark">
              {fmt(totalUds)}
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center rounded-xl border border-emerald-300/50 bg-white px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Valor inventario
            </span>
            <span className="mt-1 text-2xl font-black tabular-nums text-emerald-800 sm:text-3xl">
              {formatPrecioGs(totalValor)}
            </span>
          </div>
        </div>
        {(loading || err) && (
          <p className="mt-2 text-center text-sm">
            {loading && <span className="text-report-muted">Cargando…</span>}
            {err && <span className="text-red-600">{err}</span>}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-report-muted">
          Página {page}/{totalPages} · {fmt(udsPagina)} uds · {formatPrecioGs(valorPagina)} en vista
        </p>
        <div className="inline-flex rounded-lg border border-report-rule bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setSort("uds")}
            className={`rounded-md px-3 py-1.5 font-semibold ${
              sort === "uds" ? "bg-bazzar-naranja text-white" : "text-report-muted"
            }`}
          >
            Orden: uds ↓
          </button>
          <button
            type="button"
            onClick={() => setSort("linea")}
            className={`rounded-md px-3 py-1.5 font-semibold ${
              sort === "linea" ? "bg-bazzar-naranja text-white" : "text-report-muted"
            }`}
          >
            Orden: línea
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-report-rule bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-bazzar-fondo text-left text-xs uppercase tracking-wide text-bazzar-naranja-dark">
            <tr>
              <th className="w-10 px-2 py-2" />
              <th className="px-2 py-2">Marca</th>
              <th className="px-2 py-2">Línea</th>
              <th className="px-2 py-2">Ref</th>
              <th className="px-2 py-2">Material</th>
              <th className="px-2 py-2">Color</th>
              <th className="px-2 py-2">Talle</th>
              <th className="px-2 py-2 text-right">Uds</th>
              <th className="px-2 py-2 text-right">Precio</th>
              <th className="px-2 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r, i) => {
              const sub = r.precio_unitario != null ? r.precio_unitario * r.cantidad : null;
              return (
                <tr
                  key={rowKey(r, i)}
                  className="border-t border-report-rule/60 hover:bg-bazzar-fondo/40"
                >
                  <td className="px-2 py-1.5">
                    <DepositoProductThumb
                      linea={r.linea_codigo_proveedor}
                      referencia={r.referencia_codigo_proveedor}
                      material={r.material_code}
                      color={r.color_code}
                      imagenNombre={r.imagen_nombre}
                      size={32}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs font-semibold uppercase">{r.marca}</td>
                  <td className="px-2 py-1.5 font-mono font-medium">
                    {r.linea_codigo_proveedor}
                    {r.descp_linea ? (
                      <span className="block font-sans text-[10px] font-normal text-report-muted">
                        {r.descp_linea}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{r.referencia_codigo_proveedor}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">
                    {r.material_code}
                    {r.descp_material ? (
                      <span className="block text-[10px] text-report-muted">{r.descp_material}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs">
                    {r.color_code || "—"}
                    {r.descp_color ? (
                      <span className="block text-[10px] text-report-muted">{r.descp_color}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 font-semibold tabular-nums">{r.grada}</td>
                  <td className="px-2 py-1.5 text-right font-bold tabular-nums text-bazzar-naranja-dark">
                    {fmt(r.cantidad)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                    {formatPrecioGs(r.precio_unitario)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-xs font-semibold">
                    {sub != null ? formatPrecioGs(sub) : "—"}
                  </td>
                </tr>
              );
            })}
            {!loading && filas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-report-muted">
                  Sin stock confección
                </td>
              </tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="border-t-2 border-bazzar-naranja/30 bg-orange-50/80 text-xs font-bold">
              <tr>
                <td colSpan={7} className="px-2 py-2 text-right uppercase tracking-wide text-report-muted">
                  Subtotal página
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-bazzar-naranja-dark">
                  {fmt(udsPagina)}
                </td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-right tabular-nums text-emerald-800">
                  {formatPrecioGs(valorPagina)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-report-muted">
            Página {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      <details className="rounded-xl border border-report-rule bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-bazzar-naranja-dark">
          Filtros (marca · línea · ref · color · talle)
        </summary>
        <div className="mt-3 space-y-3">
          <input
            type="search"
            placeholder="Buscar código, color, imagen…"
            value={filtros.q}
            onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
            className="w-full max-w-md rounded-lg border border-report-rule px-3 py-2 text-sm"
          />
          {opciones && (
            <div className="flex flex-wrap gap-3">
              <FilterSelect
                label="Marca"
                items={opciones.marcas}
                value={marcaSel}
                onChange={(id) => setSingleId("marcaIds", id)}
              />
              <FilterSelect
                label="Línea"
                items={opciones.lineas}
                value={lineaSel}
                onChange={(id) => setSingleId("lineaIds", id)}
              />
              <FilterSelect
                label="Referencia"
                items={opciones.referencias}
                value={refSel}
                onChange={(id) => setSingleId("referenciaIds", id)}
              />
              <FilterSelect
                label="Color"
                items={opciones.colores}
                value={colorSel}
                onChange={(id) => setSingleId("colorIds", id)}
              />
              {opciones.gradas.length > 0 && (
                <label className="block min-w-[100px] flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-report-muted">
                    Talle
                  </span>
                  <select
                    value={gradaSel}
                    onChange={(e) =>
                      setFiltros((f) => ({
                        ...f,
                        gradas: e.target.value ? [e.target.value] : [],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-report-rule bg-white px-2 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {opciones.gradas.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {(filtros.marcaIds.length ||
            filtros.lineaIds.length ||
            filtros.referenciaIds.length ||
            filtros.colorIds.length ||
            filtros.gradas.length ||
            filtros.q.trim()) && (
            <button
              type="button"
              onClick={() => setFiltros(EMPTY_CONFECCIONES_FILTERS)}
              className="text-xs font-semibold text-red-700 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
