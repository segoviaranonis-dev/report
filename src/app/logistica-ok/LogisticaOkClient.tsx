"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import {
  ENTIDAD_AM_META,
  FECHA_ENTREGA_VENDEDOR_LABEL,
  type EntidadAmLogistica,
} from "@/lib/logistica-ok/constants";
import type {
  LogisticaGrupoCadena,
  LogisticaGrupoVendedor,
  LogisticaPendienteRow,
} from "@/lib/logistica-ok/queries-bandeja";

function ChipEntidad({ entidad }: { entidad: EntidadAmLogistica }) {
  const m = ENTIDAD_AM_META[entidad];
  return (
    <span
      className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white"
      style={{ backgroundColor: m.color }}
    >
      {m.label}
    </span>
  );
}

function FilaPendiente({
  row,
  onDone,
  vistaVendedor,
}: {
  row: LogisticaPendienteRow;
  onDone: () => void;
  vistaVendedor: boolean;
}) {
  const [fecha, setFecha] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmar() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/logistica-ok/pendiente/${row.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_entrega: fecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/80">
      <td className="px-2 py-2">
        <ChipEntidad entidad={row.entidad_am} />
      </td>
      <td className="px-2 py-2 font-mono text-xs">{row.nro_factura ?? "—"}</td>
      {vistaVendedor ? (
        <td className="max-w-[200px] truncate px-2 py-2 text-xs" title={row.cliente}>
          {row.cliente}
        </td>
      ) : (
        <td className="px-2 py-2 text-xs">{row.vendedor}</td>
      )}
      <td className="px-2 py-2 text-xs tabular-nums">{row.cajas.toLocaleString("es-PY")}</td>
      <td className="px-2 py-2 text-xs">{row.fecha_orden}</td>
      <td className="px-2 py-2 text-xs font-mono text-slate-500">{row.pp_numero}</td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <input
            type="date"
            className="rounded border border-slate-300 px-1 py-0.5 text-xs"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !fecha}
            onClick={() => void confirmar()}
            className="rounded bg-rimec-azul px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
          >
            {busy ? "…" : "OK"}
          </button>
        </div>
        {err && <p className="mt-1 text-[10px] text-red-600">{err}</p>}
      </td>
    </tr>
  );
}

function TablaFilas({
  filas,
  vistaVendedor,
  onDone,
}: {
  filas: LogisticaPendienteRow[];
  vistaVendedor: boolean;
  onDone: () => void;
}) {
  return (
    <div className="overflow-x-auto px-4 pb-3">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[10px] uppercase text-slate-500">
          <tr>
            <th className="px-2 py-1">Tipo</th>
            <th className="px-2 py-1">FI</th>
            <th className="px-2 py-1">{vistaVendedor ? "Cliente" : "Vendedor"}</th>
            <th className="px-2 py-1">Cajas</th>
            <th className="px-2 py-1">Orden (Real)</th>
            <th className="px-2 py-1">PP</th>
            <th className="px-2 py-1">{FECHA_ENTREGA_VENDEDOR_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((row) => (
            <FilaPendiente key={row.id} row={row} onDone={onDone} vistaVendedor={vistaVendedor} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AcordeonClientes({
  g,
  vistaVendedor,
  prefix,
  openCliente,
  setOpenCliente,
  onDone,
}: {
  g: LogisticaGrupoCadena;
  vistaVendedor: boolean;
  prefix: string;
  openCliente: Record<string, boolean>;
  setOpenCliente: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onDone: () => void;
}) {
  return (
    <>
      {g.clientes.map((c) => {
        const ck = `${prefix}-${g.key}-${c.id_cliente}`;
        const clOpen = openCliente[ck] ?? true;
        return (
          <div key={ck} className="border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOpenCliente((o) => ({ ...o, [ck]: !clOpen }))}
              className="flex w-full items-center justify-between px-6 py-2.5 text-left text-sm hover:bg-slate-50/80"
            >
              <span>{c.cliente}</span>
              <span className="text-xs text-slate-500">
                {c.cajas.toLocaleString("es-PY")} c · {c.filas.length} FI {clOpen ? "▲" : "▼"}
              </span>
            </button>
            {clOpen && <TablaFilas filas={c.filas} vistaVendedor={vistaVendedor} onDone={onDone} />}
          </div>
        );
      })}
    </>
  );
}

export function LogisticaOkClient() {
  const [vista, setVista] = useState<"gerencial" | "vendedor">("gerencial");
  const [vendedorId, setVendedorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<LogisticaGrupoCadena[]>([]);
  const [gruposVendedor, setGruposVendedor] = useState<LogisticaGrupoVendedor[]>([]);
  const [stats, setStats] = useState({ n: 0, cajas: 0 });
  const [openVendedor, setOpenVendedor] = useState<Record<string, boolean>>({});
  const [openCadena, setOpenCadena] = useState<Record<string, boolean>>({});
  const [openCliente, setOpenCliente] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ vista });
      if (vista === "vendedor" && vendedorId.trim()) q.set("vendedor_id", vendedorId.trim());
      const res = await fetch(`/api/logistica-ok/bandeja?${q}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setGrupos(data.grupos ?? []);
      setGruposVendedor(data.gruposVendedor ?? []);
      setStats(data.stats ?? { n: 0, cajas: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [vista, vendedorId]);

  useEffect(() => {
    load();
  }, [load]);

  const hayDatos = vista === "vendedor" ? gruposVendedor.length > 0 : grupos.length > 0;

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Hub Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.28</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Logística OK</h1>
        <p className="mt-2 text-sm text-neutral-700">
          <strong>Pendiente de confirmación</strong> · PE primero · Fecha de entrega Real ·{" "}
          {vista === "vendedor"
            ? "acordeón vendedor → cadena → cliente"
            : "acordeón cadena → cliente"}
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div className="flex gap-2">
            {(["gerencial", "vendedor"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${
                  vista === v ? "bg-rimec-azul text-white" : "border border-slate-300 bg-white text-slate-600"
                }`}
              >
                {v === "gerencial" ? "Gerencial" : "Vendedor"}
              </button>
            ))}
          </div>
          {vista === "vendedor" && (
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500">Filtrar id_vendedor</label>
              <input
                type="number"
                className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="opcional"
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
          >
            Refrescar
          </button>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            <strong>{stats.n}</strong> FI · <strong>{stats.cajas.toLocaleString("es-PY")}</strong> cajas
          </div>
        </div>

        {loading ? (
          <div className="mt-6">
            <Skeleton className="h-24 w-full" count={3} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : !hayDatos ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
            Sin pendientes — activá la bandera en Pedido proveedor con Fecha de entrega Real
          </p>
        ) : vista === "vendedor" ? (
          <div className="mt-6 space-y-3">
            {gruposVendedor.map((vg) => {
              const vendOpen = openVendedor[vg.key] ?? true;
              return (
                <div key={vg.key} className="overflow-hidden rounded-xl border-2 border-rimec-azul/25 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenVendedor((o) => ({ ...o, [vg.key]: !vendOpen }))}
                    className="flex w-full items-center justify-between bg-rimec-azul/10 px-4 py-3 text-left hover:bg-rimec-azul/15"
                  >
                    <span className="text-base font-bold text-rimec-azul-dark">{vg.vendedor_label}</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {vg.cajas.toLocaleString("es-PY")} cajas · {vg.n_fi} FI · {vg.cadenas.length} cadenas{" "}
                      {vendOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {vendOpen &&
                    vg.cadenas.map((g) => {
                      const cadKey = `${vg.key}-${g.key}`;
                      const cadOpen = openCadena[cadKey] ?? true;
                      return (
                        <div key={cadKey} className="border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setOpenCadena((o) => ({ ...o, [cadKey]: !cadOpen }))}
                            className="flex w-full items-center justify-between bg-slate-50 px-6 py-2.5 text-left hover:bg-slate-100"
                          >
                            <span className="font-semibold text-slate-800">{g.cadena_label}</span>
                            <span className="text-xs text-slate-600">
                              {g.cajas.toLocaleString("es-PY")} cajas · {g.clientes.length} clientes{" "}
                              {cadOpen ? "▲" : "▼"}
                            </span>
                          </button>
                          {cadOpen && (
                            <AcordeonClientes
                              g={g}
                              vistaVendedor
                              prefix={vg.key}
                              openCliente={openCliente}
                              setOpenCliente={setOpenCliente}
                              onDone={load}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {grupos.map((g) => {
              const cadOpen = openCadena[g.key] ?? true;
              return (
                <div key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenCadena((o) => ({ ...o, [g.key]: !cadOpen }))}
                    className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                  >
                    <span className="font-semibold text-rimec-azul-dark">{g.cadena_label}</span>
                    <span className="text-xs text-slate-600">
                      {g.cajas.toLocaleString("es-PY")} cajas · {g.clientes.length} clientes {cadOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {cadOpen && (
                    <AcordeonClientes
                      g={g}
                      vistaVendedor={false}
                      prefix={g.key}
                      openCliente={openCliente}
                      setOpenCliente={setOpenCliente}
                      onDone={load}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <ReportFooter note="Logística OK · Pendiente de confirmación · 2.3.1.28" />
    </>
  );
}
