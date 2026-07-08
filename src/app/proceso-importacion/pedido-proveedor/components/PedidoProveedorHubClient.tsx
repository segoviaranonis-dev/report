"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import {
  groupPedidosPorQuincena,
  type PpListaRow,
  type PpQuincenaGrupo,
} from "@/lib/pedido-proveedor/list-types";
import {
  CATEGORIA_COMPRA_PREVIA_ID,
  CATEGORIA_PROGRAMADO_ID,
  type RamoDigitacion,
  labelRamoDigitacion,
} from "@/lib/intencion-compra/categoria-ic";
import { DIGITACION, PROCESO_IMPORTACION, pedidoProveedorDetalle } from "@/lib/report/routes";

const ESTADO_STYLE: Record<string, string> = {
  ABIERTO: "bg-amber-100 text-amber-900",
  CERRADO: "bg-sky-100 text-sky-900",
  ENVIADO: "bg-emerald-100 text-emerald-900",
  ANULADO: "bg-slate-200 text-slate-700",
};

function fmtPct(n: number) {
  return n.toLocaleString("es-PY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function AccesoRapidoPp({ p }: { p: PpListaRow }) {
  const [csvLoading, setCsvLoading] = useState(false);

  async function descargarCsv() {
    setCsvLoading(true);
    try {
      const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${p.id}/csv-ventas`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al generar CSV");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] ?? `${p.numero_registro}_ventas.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error CSV");
    } finally {
      setCsvLoading(false);
    }
  }

  const fiLocked = p.total_articulos === 0;

  return (
    <div className="flex min-w-[7.5rem] flex-col gap-1">
      <Link
        href={pedidoProveedorDetalle(p.id)}
        className="rounded-md bg-rimec-azul px-2 py-1.5 text-center text-xs font-bold text-white hover:bg-rimec-azul-dark"
      >
        Abrir →
      </Link>
      <div className="grid grid-cols-3 gap-1">
        <Link
          href={pedidoProveedorDetalle(p.id, "ics")}
          title="ICs Asignadas"
          className="rounded border border-slate-200 bg-white px-1 py-1 text-center text-sm hover:bg-slate-50"
        >
          📋
        </Link>
        <Link
          href={pedidoProveedorDetalle(p.id, "stock")}
          title="Importación / Stock"
          className="rounded border border-slate-200 bg-white px-1 py-1 text-center text-sm hover:bg-slate-50"
        >
          📦
        </Link>
        {fiLocked ? (
          <span
            title="Sin stock importado — FI bloqueada"
            className="rounded border border-slate-200 bg-slate-100 px-1 py-1 text-center text-sm opacity-50"
          >
            🔒
          </span>
        ) : (
          <Link
            href={pedidoProveedorDetalle(p.id, "fi")}
            title="Facturas Internas"
            className="rounded border border-slate-200 bg-white px-1 py-1 text-center text-sm hover:bg-slate-50"
          >
            🧾
          </Link>
        )}
      </div>
      {p.n_fi_confirmadas > 0 && (
        <button
          type="button"
          disabled={csvLoading}
          onClick={descargarCsv}
          title="Descargar CSV ventas"
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
        >
          {csvLoading ? "…" : "📄 CSV"}
        </button>
      )}
    </div>
  );
}

function QuincenaExpander({
  grupo,
  defaultOpen,
  ppHighlight,
  filtro,
}: {
  grupo: PpQuincenaGrupo;
  defaultOpen: boolean;
  ppHighlight: string | null;
  filtro: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visibles = grupo.pedidos.filter((p) => filtro === "TODOS" || p.estado === filtro);

  if (visibles.length === 0) return null;

  const totalPares = visibles.reduce((s, p) => s + p.pares_comprometidos, 0);
  const totalVend = visibles.reduce((s, p) => s + p.total_vendido, 0);
  const pct = totalPares > 0 ? Math.round((totalVend / totalPares) * 1000) / 10 : 0;

  const label = `${grupo.quincena} — ${visibles.length} preventa${visibles.length !== 1 ? "s" : ""} · ${totalPares.toLocaleString("es-PY")} pares · ${fmtPct(pct)} % ejecutado`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80"
      >
        <span className="text-sm font-semibold text-rimec-azul-dark">
          <span className="mr-2" aria-hidden>
            📅
          </span>
          {label}
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="hidden bg-slate-50 px-4 py-2 text-xs font-bold uppercase text-slate-500 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_minmax(7.5rem,auto)] md:gap-3">
            <span>Pedido / Marcas</span>
            <span>Cliente · IC</span>
            <span className="text-right">Pares</span>
            <span>Estado</span>
            <span>Acceso rápido</span>
          </div>
          {visibles.map((p) => (
            <PpRow key={p.id} p={p} highlighted={!!ppHighlight && p.numero_registro === ppHighlight} />
          ))}
        </div>
      )}
    </div>
  );
}

function PpRow({ p, highlighted }: { p: PpListaRow; highlighted: boolean }) {
  const saldo = p.pares_comprometidos - p.total_vendido;
  const pct = p.pares_comprometidos > 0 ? (p.total_vendido / p.pares_comprometidos) * 100 : 0;

  return (
    <div
      className={`border-t border-slate-100 px-4 py-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_minmax(7.5rem,auto)] md:items-center md:gap-3 ${
        highlighted ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-300" : "hover:bg-slate-50/60"
      }`}
    >
      <div>
        <Link href={pedidoProveedorDetalle(p.id)} className="font-mono text-sm font-bold text-rimec-azul hover:underline">
          {p.numero_registro}
          {p.numero_proforma ? ` (${p.numero_proforma})` : ""}
        </Link>
        <p className="mt-0.5 text-xs text-slate-600">{p.marcas}</p>
        <p className="text-xs text-slate-500">{p.proveedor}</p>
      </div>
      <div className="mt-2 text-xs md:mt-0">
        <p className="font-medium text-amber-900">{p.cliente}</p>
        <p className="text-slate-500">{p.vendedor}</p>
        <p className="mt-1 font-mono text-slate-600">{p.ics}</p>
        {p.nro_fabrica !== "—" && (
          <p className="font-mono text-slate-500">Fábrica: {p.nro_fabrica}</p>
        )}
      </div>
      <div className="mt-2 text-right md:mt-0">
        <p className="font-mono text-sm font-bold tabular-nums">{p.pares_comprometidos.toLocaleString("es-PY")}</p>
        <p className="text-xs text-slate-500">
          vend. {p.total_vendido.toLocaleString("es-PY")} · saldo {saldo.toLocaleString("es-PY")}
        </p>
        <p className="text-xs text-violet-700">{fmtPct(pct)} %</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 md:mt-0">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${ESTADO_STYLE[p.estado] ?? "bg-slate-100"}`}>
          {p.estado}
        </span>
        {p.estado_digitacion && (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900">
            Dig. {p.estado_digitacion}
          </span>
        )}
      </div>
      <div className="mt-2 md:mt-0">
        <AccesoRapidoPp p={p} />
      </div>
    </div>
  );
}

function ppMatchesRamo(p: PpListaRow, ramo: RamoDigitacion): boolean {
  if (ramo === "programado") return p.categoria_id === CATEGORIA_PROGRAMADO_ID;
  return p.categoria_id == null || p.categoria_id === CATEGORIA_COMPRA_PREVIA_ID;
}

export function PedidoProveedorHubClient() {
  const searchParams = useSearchParams();
  const ppHighlight = searchParams.get("pp");
  const ramoInicial = searchParams.get("ramo") === "programado" ? "programado" : "compra_previa";
  const [ramo, setRamo] = useState<RamoDigitacion>(ramoInicial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PpListaRow[]>([]);
  const [filtro, setFiltro] = useState<"TODOS" | "ABIERTO" | "CERRADO" | "ENVIADO">("TODOS");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proceso-importacion/pedido-proveedor/lista", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setPedidos(data.pedidos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibles = useMemo(
    () => pedidos.filter((p) => (filtro === "TODOS" || p.estado === filtro) && ppMatchesRamo(p, ramo)),
    [pedidos, filtro, ramo],
  );

  const grupos = useMemo(() => groupPedidosPorQuincena(visibles), [visibles]);

  const highlightGrupoKey = useMemo(() => {
    if (!ppHighlight) return null;
    const hit = pedidos.find((p) => p.numero_registro === ppHighlight);
    if (!hit) return null;
    return hit.quincena_arribo_id != null ? `q-${hit.quincena_arribo_id}` : `z-${hit.quincena?.trim() || "Sin fecha de embarque"}`;
  }, [pedidos, ppHighlight]);

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.5 · P.1.3</p>
            <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Pedido proveedor</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-700">
              {labelRamoDigitacion(ramo)} · preventas agrupadas por <strong>{FECHA_DE_EMBARQUE_LABEL}</strong>. Un PP
              nace cuando Digitación asigna una IC — no se crea manualmente.
            </p>
          </div>
          <Link
            href={`${DIGITACION}?ramo=${ramo}`}
            className="rounded-lg bg-rimec-azul px-4 py-2.5 text-sm font-bold text-white hover:bg-rimec-azul-dark"
          >
            Digitación → asignar IC
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["compra_previa", "programado"] as RamoDigitacion[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRamo(r)}
              className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${
                ramo === r
                  ? r === "programado"
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-rimec-azul bg-rimec-azul/10 text-rimec-azul-dark"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {labelRamoDigitacion(r)}
            </button>
          ))}
        </div>

        {ppHighlight && (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            IC asignada → <strong className="font-mono">{ppHighlight}</strong>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {(["TODOS", "ABIERTO", "CERRADO", "ENVIADO"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase ${
                filtro === f ? "bg-rimec-azul text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600">Cargando pedidos desde Supabase…</p>
            <Skeleton className="h-14 w-full" count={6} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : grupos.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-slate-500">
            Sin pedidos {labelRamoDigitacion(ramo).toLowerCase()} en este filtro. Creá el PP en{" "}
            <Link href={`${DIGITACION}?ramo=${ramo}`} className="font-semibold text-rimec-azul hover:underline">
              Digitación
            </Link>
            .
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {grupos.map((g, i) => (
              <QuincenaExpander
                key={g.key}
                grupo={g}
                filtro={filtro}
                defaultOpen={g.key === highlightGrupoKey || i === 0}
                ppHighlight={ppHighlight}
              />
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-600">
          Paridad Streamlit: acordeón por quincena · KPI preventas / pares / % ejecutado. Ala Norte (F9) y Ala Sur (FI)
          en detalle de cada PP.
        </p>
      </main>
      <ReportFooter note={`Pedido proveedor · ${labelRamoDigitacion(ramo)} · por quincena`} />
    </div>
  );
}
