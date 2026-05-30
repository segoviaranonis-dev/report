"use client";

import { useEffect, useMemo, useState } from "react";
import { RetailProductImage } from "@/app/retail/components/RetailProductImage";
import type {
  VentaFotoRow,
  VentasFotosFilters,
  VentasFotosMarca,
  VentasFotosMetaResponse,
  VentasFotosResponse,
} from "@/lib/ventas-fotos/types";

const fmtInt = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 });

const DEMO_MARCAS: VentasFotosMarca[] = [{ id_marca: 1, descp_marca: "Marca demo" }];

const DEMO_ROWS: VentaFotoRow[] = [
  {
    id_cliente: "5000",
    descp_cliente: "Cliente demostración",
    fecha: "2026-05-01",
    cantidad: 12,
    monto: 1200000,
    preventa: 1,
    tipo_venta: "VENTA",
    descp_marca: "Marca demo",
    imagen: "1184-100",
    id_tipo: 1,
    desc_tipo: "Calzado",
    linea_codigo: "1184",
    referencia_codigo: "100",
    material_code: null,
    color_code: null,
    image_candidates: [],
    image_search_name: "1184-100.jpg",
  },
  {
    id_cliente: "5000",
    descp_cliente: "Cliente demostración",
    fecha: "2026-05-04",
    cantidad: 8,
    monto: 800000,
    preventa: 2,
    tipo_venta: "TRANSITO",
    descp_marca: "Marca demo",
    imagen: "1184-101",
    id_tipo: 1,
    desc_tipo: "Tránsito",
    linea_codigo: "1184",
    referencia_codigo: "101",
    material_code: null,
    color_code: null,
    image_candidates: [],
    image_search_name: "1184-101.jpg",
  },
];

function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  return {
    fechaInicio: start.toISOString().slice(0, 10),
    fechaFin: end.toISOString().slice(0, 10),
  };
}

function emptyKpis(rows: VentaFotoRow[]) {
  return {
    total_cantidad: rows.reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_monto: rows.reduce((s, r) => s + Math.abs(r.monto), 0),
    total_ventas: rows.filter((r) => r.tipo_venta === "VENTA").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    total_transito: rows.filter((r) => r.tipo_venta === "TRANSITO").reduce((s, r) => s + Math.abs(r.cantidad), 0),
    articulos_unicos: new Set(rows.map((r) => r.imagen).filter(Boolean)).size,
  };
}

export function VentasFotosClient() {
  const dates = useMemo(defaultDates, []);
  const [meta, setMeta] = useState<VentasFotosMetaResponse | null>(null);
  const [filters, setFilters] = useState<VentasFotosFilters>({
    clienteCodigo: "",
    fechaInicio: dates.fechaInicio,
    fechaFin: dates.fechaFin,
    marcaId: 0,
    referenciaPrefix: "",
  });
  const [data, setData] = useState<VentasFotosResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ventas-fotos/meta")
      .then((r) => r.json())
      .then((j: VentasFotosMetaResponse) => {
        setMeta(j);
        const firstMarca = j.marcas[0]?.id_marca ?? 0;
        if (firstMarca) setFilters((f) => ({ ...f, marcaId: firstMarca }));
      })
      .catch(() =>
        setMeta({
          configured: false,
          marcas: DEMO_MARCAS,
          message: "No se pudo leer la metadata; usando demostración.",
        }),
      );
  }, []);

  const configured = meta?.configured === true;
  const marcas = meta?.marcas.length ? meta.marcas : DEMO_MARCAS;
  const rows = useMemo(() => data?.rows ?? (!configured ? DEMO_ROWS : []), [configured, data]);
  const kpis = data?.kpis ?? emptyKpis(rows);
  const cliente = data?.cliente ?? (rows[0] ? { id: rows[0].id_cliente, nombre: rows[0].descp_cliente } : null);
  const marca = data?.marca ?? marcas.find((m) => m.id_marca === filters.marcaId) ?? null;
  const referencias = useMemo(
    () => [...new Set(rows.map((r) => r.imagen).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ventas-fotos/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const json = (await res.json()) as VentasFotosResponse;
      if (!res.ok) throw new Error(json.error ?? "Error al cargar ventas con fotos");
      setData(json);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar ventas con fotos");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-b border-report-rule bg-report-paper text-report-ink print:border-0">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 print:max-w-none print:px-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-report-muted/70">
              Nuevo módulo · absorción info_ventas_fotos
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-report-navy">
              Informe de compras y tránsito con fotos
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-report-muted">
              Reemplaza la app PyQt/MySQL legacy: mismo filtro por cliente, fecha, marca y referencia; datos servidos por
              Report y fotos desde Storage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-report-navy px-4 py-2 text-xs font-semibold text-white hover:bg-report-navy2 print:hidden"
          >
            Imprimir / guardar PDF
          </button>
        </div>

        {!configured ? (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">
            {meta?.message ?? "DATABASE_URL no configurada. Mostrando una maqueta funcional del módulo."}
          </p>
        ) : null}
        {error ? <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

        <div className="mt-5 grid gap-3 rounded-xl border border-report-rule bg-white p-4 shadow-sm md:grid-cols-5 print:hidden">
          <Field label="Cliente">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              placeholder="Código cliente"
              value={filters.clienteCodigo}
              onChange={(e) => setFilters((f) => ({ ...f, clienteCodigo: e.target.value.replace(/\D/g, "") }))}
            />
          </Field>
          <Field label="Desde">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              type="date"
              value={filters.fechaInicio}
              onChange={(e) => setFilters((f) => ({ ...f, fechaInicio: e.target.value }))}
            />
          </Field>
          <Field label="Hasta">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              type="date"
              value={filters.fechaFin}
              onChange={(e) => setFilters((f) => ({ ...f, fechaFin: e.target.value }))}
            />
          </Field>
          <Field label="Marca">
            <select
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              value={filters.marcaId || ""}
              onChange={(e) => setFilters((f) => ({ ...f, marcaId: Number(e.target.value) }))}
            >
              <option value="">Seleccionar</option>
              {marcas.map((m) => (
                <option key={m.id_marca} value={m.id_marca}>
                  {m.descp_marca}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referencia / imagen">
            <input
              className="w-full rounded border border-report-rule px-2 py-1.5 text-sm"
              list="ventas-fotos-referencias"
              placeholder="Opcional"
              value={filters.referenciaPrefix ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, referenciaPrefix: e.target.value }))}
            />
            <datalist id="ventas-fotos-referencias">
              {referencias.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <div className="md:col-span-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={loading || !filters.clienteCodigo || !filters.marcaId}
              onClick={cargar}
              className="rounded bg-report-navy px-4 py-2 text-xs font-semibold text-white hover:bg-report-navy2 disabled:opacity-40"
            >
              {loading ? "Cargando…" : "Aplicar filtros"}
            </button>
            <span className="text-xs text-report-muted">
              Se devuelven hasta 1.200 filas para mantener estable el despliegue serverless.
            </span>
          </div>
        </div>

        <HeaderSummary cliente={cliente} marca={marca} fechaInicio={filters.fechaInicio} fechaFin={filters.fechaFin} />
        <KpiStrip kpis={kpis} />
        <VentasFotosTable rows={rows} />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-report-muted">
      {label}
      <span className="mt-1 block normal-case tracking-normal text-report-ink">{children}</span>
    </label>
  );
}

function HeaderSummary({
  cliente,
  marca,
  fechaInicio,
  fechaFin,
}: {
  cliente: { id: string; nombre: string } | null;
  marca: VentasFotosMarca | null;
  fechaInicio: string;
  fechaFin: string;
}) {
  return (
    <div className="mt-6 grid gap-3 border border-report-rule bg-report-paper2 p-4 text-sm md:grid-cols-4">
      <p>
        <span className="font-semibold text-report-navy">Cliente:</span> {cliente ? `${cliente.id} · ${cliente.nombre}` : "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Marca:</span> {marca?.descp_marca ?? "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Desde:</span> {fechaInicio || "—"}
      </p>
      <p>
        <span className="font-semibold text-report-navy">Hasta:</span> {fechaFin || "—"}
      </p>
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: ReturnType<typeof emptyKpis> }) {
  const fmtMoney = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 });

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[
        ["Venta", kpis.total_ventas, false],
        ["Tránsito", kpis.total_transito, false],
        ["Total registrado", kpis.total_cantidad, false],
        ["Total monto", kpis.total_monto, true],
        ["Artículos únicos", kpis.articulos_unicos, false],
      ].map(([label, value, isMoney]) => (
        <div key={label as string} className="border border-report-rule bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-report-muted">{label}</p>
          <p className="mt-1 font-serif text-2xl font-bold text-report-navy tabular-nums">
            {isMoney ? fmtMoney.format(Number(value)) : fmtInt.format(Number(value))}
          </p>
        </div>
      ))}
    </div>
  );
}

function VentasFotosTable({ rows }: { rows: VentaFotoRow[] }) {
  if (!rows.length) {
    return (
      <div className="mt-6 rounded border border-report-rule bg-white p-8 text-center text-sm text-report-muted">
        Sin filas para los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto border border-report-rule bg-white shadow-sm">
      <table className="report-table min-w-[980px]">
        <thead>
          <tr>
            <th className="w-28">Imagen</th>
            <th>Fecha</th>
            <th>Referencia</th>
            <th className="text-right">Cantidad</th>
            <th>Tipo venta</th>
            <th>Descripción tipo</th>
            <th>Pilares detectados</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.imagen}-${row.fecha}-${idx}`}>
              <td>
                <div className="w-20 print:w-16">
                  <RetailProductImage
                    alt={row.imagen || "Producto sin imagen"}
                    candidates={row.image_candidates}
                    placeholderClass="bg-gradient-to-br from-slate-300 via-slate-500 to-slate-900"
                    searchFileName={row.image_search_name}
                  />
                </div>
              </td>
              <td className="tabular-nums">{row.fecha}</td>
              <td className="font-mono text-xs">{row.imagen || "—"}</td>
              <td className="text-right tabular-nums">{fmtInt.format(row.cantidad)}</td>
              <td>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    row.tipo_venta === "VENTA"
                      ? "bg-emerald-50 text-emerald-700"
                      : row.tipo_venta === "TRANSITO"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {row.tipo_venta}
                </span>
              </td>
              <td>{row.desc_tipo || "—"}</td>
              <td className="font-mono text-[11px] text-report-muted">
                L{row.linea_codigo ?? "—"} · R{row.referencia_codigo ?? "—"} · M{row.material_code ?? "—"} · C
                {row.color_code ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
