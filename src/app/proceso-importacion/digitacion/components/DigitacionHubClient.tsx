"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import type { IcDigitacionPendiente, IcPendienteEmbarqueGrupo, PpDigitacionQuincenaGrupo, PpEnProceso } from "@/lib/digitacion/bandeja-query";
import { groupIcPendientesPorEmbarque, groupPpDigitacionPorQuincena } from "@/lib/digitacion/bandeja-query";
import type { RamoDigitacion } from "@/lib/intencion-compra/categoria-ic";
import { labelRamoDigitacion } from "@/lib/intencion-compra/categoria-ic";
import { FECHA_DE_EMBARQUE_LABEL } from "@/lib/intencion-compra/quincena-arribo";
import {
  INTENCION_COMPRA_BANDEJA,
  PROCESO_IMPORTACION,
  PEDIDO_PROVEEDOR,
  digitacionAsignar,
  digitacionAsignarLote,
  pedidoProveedorDetalle,
} from "@/lib/report/routes";

type Vista = "pendientes" | "en_proceso" | "cerrados";

type FiltroKey =
  | "ic"
  | "vendedor"
  | "marca"
  | "cliente"
  | "nro_fabrica"
  | "estado"
  | "creada"
  | "pares"
  | "evento"
  | "embarque";

type PendientesFiltros = Record<FiltroKey, string[]>;

const FILTROS_VACIOS: PendientesFiltros = {
  ic: [],
  vendedor: [],
  marca: [],
  cliente: [],
  nro_fabrica: [],
  estado: [],
  creada: [],
  pares: [],
  evento: [],
  embarque: [],
};

const FILTRO_CAMPOS: { key: FiltroKey; label: string }[] = [
  { key: "ic", label: "IC" },
  { key: "vendedor", label: "Vendedor" },
  { key: "marca", label: "Marca" },
  { key: "cliente", label: "Cliente" },
  { key: "nro_fabrica", label: "Nro. pedido fábrica" },
  { key: "estado", label: "Estado" },
  { key: "creada", label: "Creada" },
  { key: "pares", label: "Pares" },
  { key: "evento", label: "Evento" },
  { key: "embarque", label: "FECHA DE EMBARQUE" },
];

function valorCampoFiltro(ic: IcDigitacionPendiente, key: FiltroKey): string {
  switch (key) {
    case "ic":
      return ic.numero_registro;
    case "vendedor":
      return ic.vendedor || "—";
    case "marca":
      return ic.marca;
    case "cliente":
      return ic.cliente;
    case "nro_fabrica":
      return ic.nro_pedido_fabrica?.trim() || "—";
    case "estado":
      return ic.estado === "PENDIENTE_OPERATIVO" ? "Bandeja IC" : "Autorizada";
    case "creada":
      return fmtFechaCreacion(ic.fecha_creacion);
    case "pares":
      return String(ic.pares);
    case "evento":
      return ic.evento_precio?.trim() || "—";
    case "embarque":
      return ic.fecha_embarque?.trim() || "Sin fecha de embarque";
  }
}

function icPasaFiltros(ic: IcDigitacionPendiente, f: PendientesFiltros) {
  for (const key of Object.keys(f) as FiltroKey[]) {
    const sel = f[key];
    if (!sel.length) continue;
    if (!sel.includes(valorCampoFiltro(ic, key))) return false;
  }
  return true;
}

function uniqSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

function FiltroMultiSelect({
  label,
  options,
  selected,
  onChange,
  open,
  onOpenChange,
  onEnterNext,
  triggerRef,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onEnterNext: () => void;
  triggerRef: (el: HTMLButtonElement | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const n = selected.length;

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  function onPanelKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onEnterNext();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  }

  return (
    <div ref={rootRef} className="relative rounded-md border border-slate-300 bg-white">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full cursor-pointer items-center justify-between gap-1 px-2 py-1.5 text-left text-[10px] font-bold uppercase text-slate-500"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open) {
            e.preventDefault();
            onEnterNext();
          }
        }}
      >
        <span className="min-w-0 truncate">
          {label}
          {n > 0 ? (
            <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 font-extrabold normal-case text-violet-900">
              {n}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-slate-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 z-30 mt-0.5 max-h-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          onKeyDown={onPanelKeyDown}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1">
            <span className="text-[10px] text-slate-500">
              {options.length} opc. · Enter → siguiente
            </span>
            {n > 0 && (
              <button
                type="button"
                className="text-[10px] font-bold text-violet-800 hover:underline"
                onClick={() => onChange([])}
              >
                Limpiar
              </button>
            )}
          </div>
          <ul
            className="max-h-40 space-y-0.5 overflow-y-auto p-1"
            role="listbox"
            aria-multiselectable
            aria-label={`${label} multi-select`}
          >
            {options.length === 0 ? (
              <li className="px-2 py-1.5 text-[11px] text-slate-400">Sin opciones</li>
            ) : (
              options.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <li key={opt} role="option" aria-selected={on}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs ${
                        on ? "bg-violet-50 font-semibold text-violet-950" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(opt)}
                        onKeyDown={onPanelKeyDown}
                        className="h-3.5 w-3.5 accent-violet-700"
                      />
                      <span className="min-w-0 flex-1 truncate normal-case" title={opt}>
                        {opt}
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmtFechaCreacion(raw: string | null | undefined) {
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DevolverModal({
  ic,
  onClose,
  onDone,
}: {
  ic: IcDigitacionPendiente;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/devolver/${ic.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al devolver");
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-white p-6 shadow-xl">
        <h3 className="font-serif text-lg font-semibold text-red-900">Devolver IC</h3>
        <p className="mt-1 text-sm text-slate-600">
          {ic.numero_registro} · {ic.marca}
        </p>
        <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Motivo obligatorio</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de devolución a administración…"
        />
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !motivo.trim()}
            onClick={submit}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "…" : "← Devolver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PpExpander({ pp, onRefresh }: { pp: PpEnProceso; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [ics, setIcs] = useState<{ ic_id: number; nro_ic: string; marca: string; proveedor: string; pares: number; nro_pedido_fabrica: string | null }[]>([]);
  const [loadingIcs, setLoadingIcs] = useState(false);
  const [nroFactura, setNroFactura] = useState(pp.nro_factura_importacion ?? "");
  const [cerrando, setCerrando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [csvIcLoading, setCsvIcLoading] = useState(false);

  async function descargarCsvIcPp() {
    setCsvIcLoading(true);
    try {
      const res = await fetch(
        `/api/proceso-importacion/pedido-proveedor/${pp.id}/ic-export-csv?_=${Date.now()}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error CSV IC");
      }
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] ?? `${pp.numero_registro}_ic.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`CSV descargado · ${pp.n_ics} IC`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error CSV IC");
    } finally {
      setCsvIcLoading(false);
    }
  }

  async function loadIcs() {
    setLoadingIcs(true);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/pp/${pp.id}`, { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) setIcs(data.ics ?? []);
    } finally {
      setLoadingIcs(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && ics.length === 0) loadIcs();
  }

  async function cerrar() {
    setCerrando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/pp/${pp.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nro_factura_importacion: nroFactura }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMsg("PP cerrado en digitación.");
      onRefresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setCerrando(false);
    }
  }

  const digCerrado = pp.estado_digitacion === "CERRADO";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
      >
        <div>
          <span className="font-mono text-sm font-bold text-rimec-azul-dark">{pp.numero_registro}</span>
          <span className="ml-2 text-xs text-slate-500">{pp.marcas}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">{pp.n_ics} IC · {pp.pares_comprometidos.toLocaleString("es-PY")} pares</span>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${digCerrado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {pp.estado_digitacion ?? pp.estado}
          </span>
          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {loadingIcs ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-2">IC</th>
                  <th className="pb-2">Marca</th>
                  <th className="pb-2">Proveedor</th>
                  <th className="pb-2">Pares</th>
                  <th className="pb-2">Nro. fábrica</th>
                </tr>
              </thead>
              <tbody>
                {ics.map((ic) => (
                  <tr key={ic.ic_id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{ic.nro_ic}</td>
                    <td className="py-2">{ic.marca}</td>
                    <td className="py-2">{ic.proveedor}</td>
                    <td className="py-2">{ic.pares.toLocaleString("es-PY")}</td>
                    <td className="py-2 font-mono text-xs">{ic.nro_pedido_fabrica ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {pp.n_ics > 0 && (
              <button
                type="button"
                disabled={csvIcLoading}
                onClick={() => void descargarCsvIcPp()}
                className="rounded-lg border-2 border-violet-900 bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {csvIcLoading ? "CSV…" : `↓ CSV IC (${pp.n_ics})`}
              </button>
            )}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold uppercase text-slate-500">Nro. factura importación</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={nroFactura}
                onChange={(e) => setNroFactura(e.target.value)}
                disabled={digCerrado}
              />
            </div>
            {!digCerrado && (
              <button
                type="button"
                disabled={cerrando || !nroFactura.trim()}
                onClick={cerrar}
                className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-bold text-white hover:bg-rimec-azul-dark disabled:opacity-50"
              >
                {cerrando ? "…" : "Cerrar PP"}
              </button>
            )}
            <Link
              href={pedidoProveedorDetalle(pp.id)}
              className="rounded-lg border border-rimec-azul/30 px-4 py-2 text-sm font-semibold text-rimec-azul hover:bg-rimec-azul/5"
            >
              Detalle PP →
            </Link>
          </div>
          {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}

function PpCerradoRow({ pp }: { pp: PpEnProceso }) {
  return (
    <div className="border-t border-emerald-100 px-4 py-3 hover:bg-emerald-50/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-bold text-rimec-azul-dark">{pp.numero_registro}</span>
          <span className="ml-2 text-xs text-slate-600">{pp.marcas}</span>
        </div>
        <span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-900">CERRADO</span>
      </div>
      <p className="mt-2 text-sm">
        Factura importación:{" "}
        <strong className="font-mono">{pp.nro_factura_importacion ?? "—"}</strong> · {pp.n_ics} IC ·{" "}
        {pp.pares_comprometidos.toLocaleString("es-PY")} pares
      </p>
      <Link href={pedidoProveedorDetalle(pp.id)} className="mt-2 inline-block text-xs font-semibold text-rimec-azul hover:underline">
        Abrir detalle PP →
      </Link>
    </div>
  );
}

function QuincenaCerradosExpander({
  grupo,
  defaultOpen,
  ramo,
}: {
  grupo: PpDigitacionQuincenaGrupo;
  defaultOpen: boolean;
  ramo: RamoDigitacion;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const unidad = ramo === "programado" ? "programado" : "preventa";
  const label = `${grupo.quincena} — ${grupo.n_preventas} ${unidad}${grupo.n_preventas !== 1 ? "s" : ""} · ${grupo.total_pares.toLocaleString("es-PY")} pares`;

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-emerald-50/80 px-4 py-3.5 text-left hover:bg-emerald-50"
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
        <div className="border-t border-emerald-100">
          {grupo.pps.map((pp) => (
            <PpCerradoRow key={pp.id} pp={pp} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendienteIcRow({
  ic,
  ramo,
  multiSelectOn,
  checked,
  onToggle,
  onDevolver,
  onEliminar,
}: {
  ic: IcDigitacionPendiente;
  ramo: RamoDigitacion;
  multiSelectOn: boolean;
  checked: boolean;
  onToggle: () => void;
  onDevolver: () => void;
  onEliminar: () => void;
}) {
  const pendienteBandeja = ic.estado === "PENDIENTE_OPERATIVO";
  const esProgramadoRamo = ramo === "programado";

  return (
    <tr className={`border-t border-slate-100 hover:bg-slate-50/80 ${checked ? "bg-violet-50/70" : ""}`}>
      {multiSelectOn && (
        <td className="px-2 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Seleccionar ${ic.numero_registro}`}
            className="h-4 w-4 accent-violet-700"
          />
        </td>
      )}
      <td className="px-3 py-3 font-mono text-xs font-bold">{ic.numero_registro}</td>
      <td className="px-3 py-3 text-xs">{ic.vendedor || "—"}</td>
      <td className="px-3 py-3">{ic.marca}</td>
      <td className="px-3 py-3 text-xs">{ic.cliente}</td>
      <td className="px-3 py-3 font-mono text-xs text-slate-700">{ic.nro_pedido_fabrica?.trim() || "—"}</td>
      <td className="px-3 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            pendienteBandeja ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
          }`}
        >
          {pendienteBandeja ? "Bandeja IC" : "Autorizada"}
        </span>
      </td>
      <td className="px-3 py-3 font-mono text-xs text-slate-700">{fmtFechaCreacion(ic.fecha_creacion)}</td>
      <td className="px-3 py-3">{ic.pares.toLocaleString("es-PY")}</td>
      <td className="px-3 py-3 text-xs text-slate-600">{ic.evento_precio ?? "—"}</td>
      <td className="px-3 py-3 text-right">
        <div className="inline-flex items-center justify-end gap-1">
          {esProgramadoRamo || !pendienteBandeja ? (
            <>
              <Link
                href={`${digitacionAsignar(ic.id)}?ramo=${ramo}`}
                title={esProgramadoRamo ? "Asignar PP" : "Asignar"}
                aria-label={esProgramadoRamo ? "Asignar PP" : "Asignar"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold text-white shadow-sm ${
                  esProgramadoRamo ? "bg-violet-700 hover:bg-violet-800" : "bg-rimec-azul hover:bg-rimec-azul-dark"
                }`}
              >
                →
              </Link>
              {!pendienteBandeja && (
                <button
                  type="button"
                  title="Devolver"
                  aria-label="Devolver"
                  onClick={onDevolver}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  ↩
                </button>
              )}
              <button
                type="button"
                title="Eliminar"
                aria-label="Eliminar"
                onClick={onEliminar}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-500 bg-slate-800 text-sm font-bold text-white hover:bg-slate-900"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <Link
                href={INTENCION_COMPRA_BANDEJA}
                title="Autorizar en bandeja"
                aria-label="Autorizar en bandeja"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-violet-300 bg-violet-50 text-sm font-bold text-violet-900 hover:bg-violet-100"
              >
                ✓
              </Link>
              <button
                type="button"
                title="Eliminar"
                aria-label="Eliminar"
                onClick={onEliminar}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-500 bg-slate-800 text-sm font-bold text-white hover:bg-slate-900"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmbarquePendientesExpander({
  grupo,
  defaultOpen,
  ramo,
  multiSelectOn,
  selectedIds,
  onToggle,
  onToggleGroup,
  onDevolver,
  onEliminar,
}: {
  grupo: IcPendienteEmbarqueGrupo;
  defaultOpen: boolean;
  ramo: RamoDigitacion;
  multiSelectOn: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleGroup: (ids: number[], select: boolean) => void;
  onDevolver: (ic: IcDigitacionPendiente) => void;
  onEliminar: (ic: IcDigitacionPendiente) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ids = grupo.ics.map((ic) => ic.id);
  const selectedInGroup = ids.filter((id) => selectedIds.includes(id)).length;
  const allGroupSelected = multiSelectOn && ids.length > 0 && selectedInGroup === ids.length;
  const someGroupSelected = multiSelectOn && selectedInGroup > 0 && !allGroupSelected;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        ramo === "programado" ? "border-violet-200" : "border-slate-200"
      }`}
    >
      <div
        className={`flex w-full items-center gap-3 px-4 py-3.5 ${
          ramo === "programado" ? "bg-violet-50/80 hover:bg-violet-50" : "bg-slate-50 hover:bg-slate-100/80"
        }`}
      >
        {multiSelectOn && (
          <input
            type="checkbox"
            checked={allGroupSelected}
            ref={(el) => {
              if (el) el.indeterminate = someGroupSelected;
            }}
            onChange={() => onToggleGroup(ids, !allGroupSelected)}
            aria-label={`Seleccionar IC de ${grupo.quincena}`}
            className="h-4 w-4 shrink-0 accent-violet-700"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-rimec-azul-dark">
              <span className="mr-1.5" aria-hidden>
                📅
              </span>
              {FECHA_DE_EMBARQUE_LABEL}: {grupo.quincena}
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-slate-600">
              {grupo.n_ics} IC · {grupo.n_clientes} cliente{grupo.n_clientes !== 1 ? "s" : ""} ·{" "}
              <strong className="tabular-nums text-rimec-azul-dark">
                {grupo.total_pares.toLocaleString("es-PY")} pares
              </strong>
            </span>
          </span>
          <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
        </button>
      </div>
      {open && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-white text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                {multiSelectOn && <th className="w-10 px-2 py-2" />}
                <th className="px-3 py-2">IC</th>
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2">Marca</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Nro. fábrica</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Creada</th>
                <th className="px-3 py-2">Pares</th>
                <th className="px-3 py-2">Evento</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupo.ics.map((ic) => (
                <PendienteIcRow
                  key={ic.id}
                  ic={ic}
                  ramo={ramo}
                  multiSelectOn={multiSelectOn}
                  checked={selectedIds.includes(ic.id)}
                  onToggle={() => onToggle(ic.id)}
                  onDevolver={() => onDevolver(ic)}
                  onEliminar={() => onEliminar(ic)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function DigitacionHubClient() {
  const searchParams = useSearchParams();
  const ramoInicial = searchParams.get("ramo") === "programado" ? "programado" : "compra_previa";
  const [ramo, setRamo] = useState<RamoDigitacion>(ramoInicial);
  const [vista, setVista] = useState<Vista>("pendientes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<IcDigitacionPendiente[]>([]);
  const [enProceso, setEnProceso] = useState<PpEnProceso[]>([]);
  const [cerrados, setCerrados] = useState<PpEnProceso[]>([]);
  const [statsRamos, setStatsRamos] = useState({ compra_previa: 0, programado: 0, total_pares: 0 });
  const [devolverIc, setDevolverIc] = useState<IcDigitacionPendiente | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<PendientesFiltros>(FILTROS_VACIOS);
  const [openFiltro, setOpenFiltro] = useState<FiltroKey | null>(null);
  const filtroTriggerRefs = useRef<Partial<Record<FiltroKey, HTMLButtonElement | null>>>({});

  const focusFiltro = useCallback((key: FiltroKey | null) => {
    setOpenFiltro(key);
    if (!key) return;
    requestAnimationFrame(() => {
      filtroTriggerRefs.current[key]?.focus();
    });
  }, []);

  const enterFiltroSiguiente = useCallback(
    (idx: number) => {
      const next = FILTRO_CAMPOS[idx + 1];
      if (next) focusFiltro(next.key);
      else setOpenFiltro(null);
    },
    [focusFiltro]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proceso-importacion/digitacion/bandeja?ramo=${ramo}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar bandeja");
      setPendientes(data.pendientes ?? []);
      setEnProceso(data.en_proceso ?? []);
      setCerrados(data.cerrados_digitacion ?? []);
      setStatsRamos({
        compra_previa: data.stats?.compra_previa ?? 0,
        programado: data.stats?.programado ?? 0,
        total_pares: data.stats?.total_pares ?? 0,
      });
      setSelectedIds([]);
      setFiltros(FILTROS_VACIOS);
      setOpenFiltro(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [ramo]);

  async function eliminarIcSimple(ic: IcDigitacionPendiente) {
    if (!window.confirm(`¿Seguro que querés eliminar ${ic.numero_registro}?`)) return;
    try {
      const res = await fetch(`/api/proceso-importacion/intencion-compra/${ic.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  useEffect(() => {
    setRamo(ramoInicial);
  }, [ramoInicial]);

  useEffect(() => {
    load();
  }, [load]);

  const nPend = pendientes.length;
  const pendientesFiltrados = useMemo(
    () => pendientes.filter((ic) => icPasaFiltros(ic, filtros)),
    [pendientes, filtros],
  );
  const gruposPendientes = useMemo(
    () => groupIcPendientesPorEmbarque(pendientesFiltrados),
    [pendientesFiltrados],
  );
  const filtrosActivos = useMemo(
    () => Object.values(filtros).some((v) => v.length > 0),
    [filtros],
  );
  const opcionesFiltro = useMemo(() => {
    const map = {} as Record<FiltroKey, string[]>;
    for (const { key } of FILTRO_CAMPOS) {
      map[key] = uniqSorted(pendientes.map((ic) => valorCampoFiltro(ic, key)));
    }
    // Label dinámico embarque ya está en FILTRO_CAMPOS; override label at render
    return map;
  }, [pendientes]);
  const gruposCerrados = useMemo(() => groupPpDigitacionPorQuincena(cerrados), [cerrados]);
  const multiSelectOn = ramo === "programado" && vista === "pendientes";
  const allSelected =
    multiSelectOn &&
    pendientesFiltrados.length > 0 &&
    pendientesFiltrados.every((ic) => selectedIds.includes(ic.id));
  const selectedPares = useMemo(() => {
    if (!selectedIds.length) return 0;
    const set = new Set(selectedIds);
    return pendientes.filter((ic) => set.has(ic.id)).reduce((s, ic) => s + (ic.pares || 0), 0);
  }, [pendientes, selectedIds]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(pendientesFiltrados.map((ic) => ic.id));
  }

  function toggleSelectGroup(ids: number[], select: boolean) {
    setSelectedIds((prev) => {
      if (select) return [...new Set([...prev, ...ids])];
      const drop = new Set(ids);
      return prev.filter((id) => !drop.has(id));
    });
  }

  function patchFiltro(key: FiltroKey, value: string[]) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href={PROCESO_IMPORTACION} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Ciclo de importación
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.7.4 · P.1.5</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Digitación</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-700">
          Administrador por estrategia comercial · <strong>{labelRamoDigitacion(ramo)}</strong> · puente IC → PP vía{" "}
          <code className="text-xs">intencion_compra_pedido</code>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["compra_previa", "programado"] as RamoDigitacion[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRamo(r);
                setVista("pendientes");
                setSelectedIds([]);
                setFiltros(FILTROS_VACIOS);
              }}
              className={`rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${
                ramo === r
                  ? r === "programado"
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-rimec-azul bg-rimec-azul/10 text-rimec-azul-dark"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {labelRamoDigitacion(r)}
              <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs tabular-nums">
                {r === "compra_previa" ? statsRamos.compra_previa : statsRamos.programado}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div
            className={`rounded-xl border-2 px-5 py-3 ${nPend > 0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}
          >
            <span className="text-xs font-bold uppercase text-slate-600">
              ICs {labelRamoDigitacion(ramo).toLowerCase()} sin PP
            </span>
            <p className={`font-serif text-3xl font-bold ${nPend > 0 ? "text-red-700" : "text-emerald-700"}`}>{nPend}</p>
          </div>
          {ramo === "programado" && nPend > 0 && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              <strong>{statsRamos.total_pares.toLocaleString("es-PY")}</strong> pares ·{" "}
              <strong>compra_previa = false</strong> · Alejandro Magno. «Asignar PP» autoriza la IC y crea el pedido
              proveedor programado.
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-1 border-b border-slate-200">
          {(["pendientes", "en_proceso", "cerrados"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setVista(v);
                if (v !== "pendientes") setSelectedIds([]);
              }}
              className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
                vista === v
                  ? "border-b-2 border-rimec-azul text-rimec-azul"
                  : "text-slate-500 hover:text-rimec-azul-dark"
              }`}
            >
              {v === "pendientes"
                ? `Pendientes (${nPend})`
                : v === "en_proceso"
                  ? `En proceso (${enProceso.length})`
                  : `Cerrados (${cerrados.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full" count={4} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : vista === "pendientes" ? (
          <div className="mt-4">
            {pendientes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay IC {labelRamoDigitacion(ramo).toLowerCase()} sin asignar
              </p>
            ) : (
              <div className="space-y-3">
                <div className="relative z-20 overflow-visible rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Filtros multi-select · Enter aplica y pasa al siguiente · Esc cierra
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="tabular-nums text-slate-600">
                        {pendientesFiltrados.length}/{nPend} IC
                        {filtrosActivos ? " (filtrado)" : ""}
                      </span>
                      {filtrosActivos && (
                        <button
                          type="button"
                          onClick={() => setFiltros(FILTROS_VACIOS)}
                          className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {FILTRO_CAMPOS.map(({ key, label }, idx) => (
                      <FiltroMultiSelect
                        key={key}
                        label={key === "embarque" ? FECHA_DE_EMBARQUE_LABEL : label}
                        options={opcionesFiltro[key] ?? []}
                        selected={filtros[key]}
                        onChange={(next) => patchFiltro(key, next)}
                        open={openFiltro === key}
                        onOpenChange={(next) => setOpenFiltro(next ? key : null)}
                        onEnterNext={() => enterFiltroSiguiente(idx)}
                        triggerRef={(el) => {
                          filtroTriggerRefs.current[key] = el;
                        }}
                      />
                    ))}
                  </div>
                </div>

                {multiSelectOn && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-950">
                    <label className="inline-flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-violet-700"
                      />
                      Seleccionar visibles ({pendientesFiltrados.length} IC · {gruposPendientes.length} embarques)
                    </label>
                    <span className="tabular-nums text-slate-600">
                      Agrupado por {FECHA_DE_EMBARQUE_LABEL.toLowerCase()}
                    </span>
                  </div>
                )}

                {gruposPendientes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">
                    Ninguna IC coincide con los filtros.
                  </p>
                ) : (
                  gruposPendientes.map((g, i) => (
                    <EmbarquePendientesExpander
                      key={g.key}
                      grupo={g}
                      defaultOpen={i === 0}
                      ramo={ramo}
                      multiSelectOn={multiSelectOn}
                      selectedIds={selectedIds}
                      onToggle={toggleSelect}
                      onToggleGroup={toggleSelectGroup}
                      onDevolver={(ic) => setDevolverIc(ic)}
                      onEliminar={(ic) => void eliminarIcSimple(ic)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        ) : vista === "en_proceso" ? (
          <div className="mt-4 space-y-3">
            {enProceso.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay PP abiertos en digitación
              </p>
            ) : (
              enProceso.map((pp) => <PpExpander key={pp.id} pp={pp} onRefresh={load} />)
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-600">
              PP con digitación cerrada (nro. factura importación). No aceptan IC nuevas — ver también{" "}
              <Link href={PEDIDO_PROVEEDOR} className="font-semibold text-rimec-azul hover:underline">
                Pedido proveedor
              </Link>
              .
            </p>
            {cerrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
                No hay PP cerrados en digitación
              </p>
            ) : (
              gruposCerrados.map((g, i) => (
                <QuincenaCerradosExpander key={g.key} grupo={g} defaultOpen={i === 0} ramo={ramo} />
              ))
            )}
          </div>
        )}
      </main>
      <ReportFooter note={`Digitación · ${labelRamoDigitacion(ramo)} · 2.3.1.7.4`} />

      {multiSelectOn && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(92vw,36rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border-2 border-violet-400 bg-violet-900 px-4 py-3 text-white shadow-2xl">
          <div className="min-w-0 text-sm">
            <p className="font-bold">
              {selectedIds.length} IC · {selectedPares.toLocaleString("es-PY")} pares
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-violet-200 underline hover:text-white"
            >
              Limpiar selección
            </button>
          </div>
          <Link
            href={digitacionAsignarLote(selectedIds, "programado")}
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-violet-900 hover:bg-violet-50"
          >
            Asignar {selectedIds.length} →
          </Link>
        </div>
      )}

      {devolverIc && (
        <DevolverModal ic={devolverIc} onClose={() => setDevolverIc(null)} onDone={load} />
      )}
    </div>
  );
}
