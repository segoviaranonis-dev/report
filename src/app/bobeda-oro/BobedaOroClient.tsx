"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BobedaFiltrosResponse, BobedaVentaRow, BobedaVentasResponse } from "@/lib/bobeda-oro/types";
import { formatPrecioGs } from "@/lib/depositos/precio-venta";

type FilterState = {
  cliente_id: string;
  estado: string;
  origen: string;
  desde: string;
  hasta: string;
  marca: string;
  vendedor: string;
  cedula: string;
  factura_legal: string;
  fi_fa: string;
  staging_id: string;
  q: string;
};

const EMPTY_FILTERS: FilterState = {
  cliente_id: "",
  estado: "",
  origen: "",
  desde: "",
  hasta: "",
  marca: "",
  vendedor: "",
  cedula: "",
  factura_legal: "",
  fi_fa: "",
  staging_id: "",
  q: "",
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

function filtersToQuery(f: FilterState, offset: number): string {
  const p = new URLSearchParams();
  if (f.cliente_id) p.set("cliente_id", f.cliente_id);
  if (f.estado) p.set("estado", f.estado);
  if (f.origen) p.set("origen", f.origen);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (f.marca) p.set("marca", f.marca);
  if (f.vendedor) p.set("vendedor", f.vendedor);
  if (f.cedula) p.set("cedula", f.cedula);
  if (f.factura_legal) p.set("factura_legal", f.factura_legal);
  if (f.fi_fa) p.set("fi_fa", f.fi_fa);
  if (f.staging_id) p.set("staging_id", f.staging_id);
  if (f.q.trim()) p.set("q", f.q.trim());
  p.set("limit", "100");
  p.set("offset", String(offset));
  return p.toString();
}

function estadoBadge(estado: string) {
  const e = estado.toUpperCase();
  if (e === "ENTREGADO") return "bg-emerald-100 text-emerald-800";
  if (e === "PENDIENTE_ENTREGA") return "bg-amber-100 text-amber-900";
  if (e === "ANULADO") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function RowDetail({ row }: { row: BobedaVentaRow }) {
  return (
    <div className="grid gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      <p>
        <span className="font-semibold text-slate-500">Código ORO:</span>{" "}
        <span className="font-mono">{row.codigo_oro}</span>
      </p>
      <p>
        <span className="font-semibold text-slate-500">Bandeja origen:</span>{" "}
        {row.bandeja_codigo ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-slate-500">Depósito:</span>{" "}
        <span className="font-mono">{row.deposito_tabla}</span>
      </p>
      <p>
        <span className="font-semibold text-slate-500">Staging / lote POS:</span>{" "}
        {row.staging_id ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-slate-500">Vendedor:</span>{" "}
        {row.vendedor_nombre ?? "—"}
        {row.vendedor_bazzar_id != null ? ` (id ${row.vendedor_bazzar_id})` : ""}
      </p>
      <p>
        <span className="font-semibold text-slate-500">Import CSV / batch:</span>{" "}
        {row.trazabilidad_batch ?? "—"}
        {row.import_fecha
          ? ` · ${new Date(row.import_fecha).toLocaleString("es-PY")}`
          : ""}
      </p>
      <p>
        <span className="font-semibold text-slate-500">Excel retail (snapshot):</span>{" "}
        {row.trazabilidad_excel ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-slate-500">FK pilares:</span> L{row.linea_id} · R{row.referencia_id} · M
        {row.material_id} · C{row.color_id}
      </p>
      <p>
        <span className="font-semibold text-slate-500">Entregado:</span>{" "}
        {row.entregado_at ? new Date(row.entregado_at).toLocaleString("es-PY") : "—"}
      </p>
      <p>
        <span className="font-semibold text-slate-500">QC Empaque:</span>{" "}
        {row.controlado === true ? "Controlado" : row.controlado === false ? "Pendiente" : "—"}
      </p>
    </div>
  );
}

export function BobedaOroClient() {
  const [filtrosMeta, setFiltrosMeta] = useState<BobedaFiltrosResponse | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<BobedaVentasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bobeda-oro/filtros")
      .then((r) => r.json())
      .then((j: BobedaFiltrosResponse) => setFiltrosMeta(j))
      .catch(() => setFiltrosMeta({ configured: false, tiendas: [], estados: [], origenes: [], marcas: [], vendedores: [] }));
  }, []);

  const cargar = useCallback(async (nextOffset = 0) => {
    setLoading(true);
    setErr(null);
    try {
      const qs = filtersToQuery(filters, nextOffset);
      const r = await fetch(`/api/bobeda-oro/ventas?${qs}`, { cache: "no-store" });
      const j = (await r.json()) as BobedaVentasResponse;
      if (j.error) setErr(j.error);
      setData(j);
      setOffset(nextOffset);
    } catch {
      setErr("Error de red al consultar bóveda");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (filtrosMeta?.configured !== false) cargar(0);
  }, [filtrosMeta, cargar]);

  const hasMore = useMemo(() => {
    if (!data) return false;
    return offset + (data.rows?.length ?? 0) < data.total;
  }, [data, offset]);

  const configured = data?.configured === true || filtrosMeta?.configured === true;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-bazzar-naranja">Bóveda ORO · bobeda_venta_pos</p>
        <h1 className="mt-2 font-serif text-4xl font-light text-neutral-ink">Ventas Bazzar · histórico molecular</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-muted">
          1 fila = 1 par vendido · trazabilidad depósito · staging · factura legal · snapshot congelado al handoff cajero.
        </p>
      </header>

      {!configured && !loading && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tabla <span className="font-mono">bobeda_venta_pos</span> no disponible — aplicar migración POS P0.
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Tienda
            <select
              value={filters.cliente_id}
              onChange={(e) => setFilters((f) => ({ ...f, cliente_id: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Todas</option>
              {(filtrosMeta?.tiendas ?? []).map((t) => (
                <option key={t.cliente_id} value={String(t.cliente_id)}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Estado
            <select
              value={filters.estado}
              onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Todos</option>
              {(filtrosMeta?.estados ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Origen
            <select
              value={filters.origen}
              onChange={(e) => setFilters((f) => ({ ...f, origen: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Todos</option>
              {(filtrosMeta?.origenes ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Desde
            <input
              type="date"
              value={filters.desde}
              onChange={(e) => setFilters((f) => ({ ...f, desde: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Hasta
            <input
              type="date"
              value={filters.hasta}
              onChange={(e) => setFilters((f) => ({ ...f, hasta: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Marca
            <input
              list="bobeda-marcas"
              value={filters.marca}
              onChange={(e) => setFilters((f) => ({ ...f, marca: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              placeholder="VIZZANO…"
            />
            <datalist id="bobeda-marcas">
              {(filtrosMeta?.marcas ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 lg:col-span-2">
            Buscar (código ORO · L·R·mat·color · factura)
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              placeholder="ORO-POS-2400…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            CI cliente
            <input
              value={filters.cedula}
              onChange={(e) => setFilters((f) => ({ ...f, cedula: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Factura legal
            <input
              value={filters.factura_legal}
              onChange={(e) => setFilters((f) => ({ ...f, factura_legal: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            FI_FA
            <input
              value={filters.fi_fa}
              onChange={(e) => setFilters((f) => ({ ...f, fi_fa: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Staging ID
            <input
              value={filters.staging_id}
              onChange={(e) => setFilters((f) => ({ ...f, staging_id: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => cargar(0)}
            disabled={loading}
            className="rounded-lg bg-bazzar-naranja px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Consultando…" : "Aplicar filtros"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setExpanded(null);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Limpiar
          </button>
        </div>
      </section>

      {data && configured && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{fmtInt(data.pares)} pares</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{fmtInt(data.total)} filas ORO</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
            {formatPrecioGs(data.monto_total)} total
          </span>
        </div>
      )}

      {err && <p className="mb-4 text-sm text-red-700">{err}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3">Fecha</th>
                <th className="px-3 py-3">Tienda</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Artículo</th>
                <th className="px-3 py-3">Talla</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">Factura</th>
                <th className="px-3 py-3">Vendedor</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((row) => {
                const open = expanded === row.codigo_oro;
                const sku = [row.linea_codigo, row.referencia_codigo].filter(Boolean).join(" · ");
                const colorTxt = [row.descp_color ?? row.color_code, row.descp_material ?? row.material_code]
                  .filter(Boolean)
                  .join(" — ");
                return (
                  <Fragment key={row.codigo_oro}>
                    <tr className="border-t border-slate-100 hover:bg-orange-50/40">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{row.fecha_venta}</td>
                      <td className="px-3 py-2">
                        <span className="block font-semibold text-neutral-ink">{row.tienda_label}</span>
                        <span className="text-[10px] text-slate-500">{row.origen}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${estadoBadge(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block font-medium">{row.nombre_cliente}</span>
                        <span className="text-[10px] text-slate-500">{row.cedula_cliente ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block font-semibold text-bazzar-naranja">{row.marca}</span>
                        <span className="block font-mono text-xs">{sku || "—"}</span>
                        <span className="block text-[10px] text-slate-600">{colorTxt || "—"}</span>
                      </td>
                      <td className="px-3 py-2 font-bold tabular-nums text-emerald-700">N° {row.grada}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {row.precio_unitario != null ? formatPrecioGs(row.precio_unitario) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="block font-mono">{row.numero_factura_legal ?? "—"}</span>
                        <span className="text-slate-500">FI_FA {row.numero_fi_fa ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{row.vendedor_nombre ?? "—"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : row.codigo_oro)}
                          className="text-xs font-semibold text-bazzar-naranja underline"
                        >
                          {open ? "Cerrar" : "Trazabilidad"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <RowDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && (data?.rows?.length ?? 0) === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Sin ventas para estos filtros.</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => cargar(offset + 100)}
            className="rounded-lg border-2 border-bazzar-naranja px-6 py-2 text-sm font-bold text-bazzar-naranja disabled:opacity-50"
          >
            Cargar más
          </button>
        </div>
      )}

      <nav className="mt-10 text-center text-sm">
        <Link href="/" className="font-semibold text-bazzar-naranja underline">
          Portada holding
        </Link>
        <span className="text-neutral-muted"> · </span>
        <Link href="/tablet-bazzar" className="font-semibold text-bazzar-naranja underline">
          Caja Bazzar
        </Link>
      </nav>
    </main>
  );
}
