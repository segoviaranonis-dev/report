"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type { IcBandejaRow } from "@/lib/intencion-compra/bandeja-query";
import { parseIcSeq, parsePpSeq } from "@/lib/intencion-compra/bandeja-query";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import {
  INTENCION_COMPRA,
  INTENCION_COMPRA_NUEVA,
  PROCESO_IMPORTACION,
  pedidoProveedorDetalle,
} from "@/lib/report/routes";
import { IcDevueltasPanel } from "./IcDevueltasPanel";
import { IcHistorialPanel } from "./IcHistorialPanel";
import { IcPendientesPanel } from "./IcPendientesPanel";
import { IntencionCompraSubNav } from "./IntencionCompraSubNav";

type VistaBandeja = "pendientes" | "devueltas" | "historial" | "rastreo";

type SortKey =
  | "numero_registro"
  | "estado"
  | "marca"
  | "cliente"
  | "pares"
  | "fecha_embarque"
  | "pp_nro"
  | "pp_estado"
  | "ubicacion"
  | "evento_precio"
  | "fecha_registro";

type SortDir = "asc" | "desc";

type FiltroEstado = "TODOS" | "PENDIENTE_OPERATIVO" | "AUTORIZADO" | "DIGITADO" | "DEVUELTO_ADMIN" | "ANULADO";

const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE_OPERATIVO: "bg-amber-100 text-amber-900 border-amber-200",
  AUTORIZADO: "bg-sky-100 text-sky-900 border-sky-200",
  DIGITADO: "bg-emerald-100 text-emerald-900 border-emerald-200",
  DEVUELTO_ADMIN: "bg-red-100 text-red-900 border-red-200",
  ANULADO: "bg-slate-200 text-slate-700 border-slate-300",
};

const PP_STYLE: Record<string, string> = {
  ABIERTO: "text-amber-800",
  CERRADO: "text-sky-800",
  ENVIADO: "text-emerald-800 font-semibold",
};

function sortValue(row: IcBandejaRow, key: SortKey): string | number {
  switch (key) {
    case "numero_registro":
      return parseIcSeq(row.numero_registro);
    case "pp_nro":
      return parsePpSeq(row.pp_nro);
    case "pares":
      return row.pares ?? 0;
    case "fecha_embarque":
      return String(row.fecha_embarque ?? "").toLowerCase();
    case "fecha_registro":
      return row.fecha_registro ?? "";
    default:
      return String(row[key] ?? "").toLowerCase();
  }
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`px-3 py-3 text-left ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition ${
          active ? "text-rimec-azul" : "text-slate-500 hover:text-rimec-azul-dark"
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export function IntencionCompraBandejaClient() {
  const [vista, setVista] = useState<VistaBandeja>("pendientes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ics, setIcs] = useState<IcBandejaRow[]>([]);
  const [porEstado, setPorEstado] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<FiltroEstado>("TODOS");
  const [sortKey, setSortKey] = useState<SortKey>("numero_registro");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [busqueda, setBusqueda] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/intencion-compra/bandeja", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar bandeja");
      setIcs(data.ics ?? []);
      setPorEstado(data.por_estado ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vista === "rastreo") load();
  }, [load, vista]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "numero_registro" || key === "pp_nro" ? "asc" : "desc");
    }
  }

  const filas = useMemo(() => {
    let list = [...ics];
    if (filtro !== "TODOS") list = list.filter((r) => r.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(
        (r) =>
          r.numero_registro.toLowerCase().includes(q) ||
          (r.pp_nro ?? "").toLowerCase().includes(q) ||
          r.marca.toLowerCase().includes(q) ||
          r.cliente.toLowerCase().includes(q) ||
          (r.evento_precio ?? "").toLowerCase().includes(q) ||
          r.ubicacion.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return parseIcSeq(a.numero_registro) - parseIcSeq(b.numero_registro);
    });
    return list;
  }, [ics, filtro, busqueda, sortKey, sortDir]);

  const filtros: { key: FiltroEstado; label: string; count?: number }[] = [
    { key: "TODOS", label: "Todas", count: ics.length },
    { key: "PENDIENTE_OPERATIVO", label: "Pendientes", count: porEstado.PENDIENTE_OPERATIVO },
    { key: "AUTORIZADO", label: "Autorizadas", count: porEstado.AUTORIZADO },
    { key: "DIGITADO", label: "Digitadas", count: porEstado.DIGITADO },
  ];

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.3 · P.1.4 · Registro de intenciones
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Intención de compra</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-700">
          Rastreo completo IC → PP · ordená por cualquier columna · estilo NIIF institucional.
        </p>

        <IntencionCompraSubNav activo="bandeja" />

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["pendientes", "PENDIENTES"],
              ["devueltas", "DEVUELTAS"],
              ["historial", "HISTORIAL"],
              ["rastreo", "RASTREO IC→PP"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setVista(key)}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-bold transition ${
                vista === key
                  ? "border-rimec-azul bg-rimec-azul text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vista === "pendientes" && <IcPendientesPanel />}
        {vista === "devueltas" && <IcDevueltasPanel />}
        {vista === "historial" && <IcHistorialPanel />}
        {vista === "rastreo" && (
          <>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                  filtro === f.key
                    ? "border-rimec-azul bg-rimec-azul text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-rimec-azul/40"
                }`}
              >
                {f.label}
                {f.count != null ? ` (${f.count})` : ""}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar IC, PP, marca…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-48 sm:w-64"
            />
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-rimec-azul hover:bg-slate-50 disabled:opacity-50"
            >
              Actualizar
            </button>
            <Link
              href={INTENCION_COMPRA_NUEVA}
              className="rounded-lg bg-rimec-azul px-4 py-2 text-xs font-bold text-white hover:bg-rimec-azul-dark"
            >
              + Nueva IC
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-10 w-full" count={8} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/90">
                  <tr>
                    <SortHeader label="IC" sortKey="numero_registro" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Estado" sortKey="estado" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Marca" sortKey="marca" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Cliente" sortKey="cliente" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Pares" sortKey="pares" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
                    <SortHeader label={FECHA_DE_EMBARQUE_LABEL} sortKey="fecha_embarque" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="PP" sortKey="pp_nro" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="PP est." sortKey="pp_estado" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Ubicación ciclo" sortKey="ubicacion" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Evento" sortKey="evento_precio" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Alta" sortKey="fecha_registro" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                        Sin registros para este filtro
                      </td>
                    </tr>
                  ) : (
                    filas.map((row) => (
                      <tr key={row.id} className="transition hover:bg-rimec-azul/[0.03]">
                        <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-rimec-azul-dark">
                          {row.numero_registro}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${ESTADO_STYLE[row.estado] ?? "bg-slate-100 text-slate-700"}`}
                          >
                            {row.estado.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-medium">{row.marca}</td>
                        <td className="max-w-[140px] truncate px-3 py-3 text-slate-600" title={row.cliente}>
                          {row.cliente}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{row.pares?.toLocaleString("es-PY") ?? "—"}</td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-xs text-slate-700" title={row.fecha_embarque ?? ""}>
                          {row.fecha_embarque ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {row.pp_id && row.pp_nro ? (
                            <Link
                              href={pedidoProveedorDetalle(row.pp_id)}
                              className="font-mono font-semibold text-rimec-azul hover:underline"
                            >
                              {row.pp_nro}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {row.pp_estado ? (
                            <span className={PP_STYLE[row.pp_estado] ?? "text-slate-600"}>{row.pp_estado}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[220px] px-3 py-3 text-xs leading-snug text-slate-700">{row.ubicacion}</td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-xs text-slate-600" title={row.evento_precio ?? ""}>
                          {row.evento_precio ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{row.fecha_registro ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && filas.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Mostrando {filas.length} de {ics.length} IC · orden: {sortKey} {sortDir === "asc" ? "↑" : "↓"}
          </p>
        )}
          </>
        )}

        <Link href={INTENCION_COMPRA} className="mt-8 inline-block text-sm font-semibold text-rimec-azul hover:underline">
          ← Hub intención de compra
        </Link>
      </main>
      <ReportFooter note="Bandeja IC · 2.3.1.7.3.2 · NIIF" />
    </div>
  );
}
