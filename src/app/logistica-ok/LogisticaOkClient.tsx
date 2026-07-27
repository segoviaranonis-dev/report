"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Fragment,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ReportFooter } from "@/components/report/ReportFooter";
import { Skeleton } from "@/components/ui/LoadingState";
import {
  CHOFERES_RIMEC_INICIAL,
  ENTIDAD_AM_META,
  FECHA_ENTREGA_CLIENTE_LABEL,
  FECHA_ENTREGA_EFECTIVA_LABEL,
  FECHA_LLEGADA_PP_LABEL,
  LOGISTICA_TABS,
  SEMAFORO_META,
  SEMAFORO_PASO_LABEL,
  pelotasDesdeFila,
  statsObsMensajes,
  tabInicialLogistica,
  tabsPermitidasLogistica,
  type EntidadAmLogistica,
  type LogisticaTabId,
  type SemaforoColor,
  type SemaforoPaso,
  FACTURA_REAL_LABEL,
} from "@/lib/logistica-ok/constants";
import { displayFacturaRealUi } from "@/lib/logistica-ok/factura-real";
import type {
  LogisticaGrupoDiaConChofer,
  LogisticaGrupoPedidoDuro,
  LogisticaGrupoTipo,
  LogisticaGrupoVendedor,
  LogisticaPendienteRow,
} from "@/lib/logistica-ok/queries-bandeja";
import {
  bloqueStockRimecVisible,
  filtrarFilasLogistica,
  groupLogisticaPorPedidoDuro,
  enriquecerGruposConStatsPp,
  type LogisticaStatsPp,
} from "@/lib/logistica-ok/queries-bandeja";
import { ObsLogisticaGrupoIcon, ObsLogisticaIcon } from "./ObsLogisticaIcon";
import {
  LogisticaFiDetalleCell,
  LogisticaFiDetallePanel,
  useLogisticaFiDetalle,
} from "./LogisticaFiLeyPanel";

function formatGs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(Number(n)).toLocaleString("es-PY");
}

/** Pedido externo legible: PE no muestra el batch pe-import completo en la fila. */
function labelPedidoExternoUi(g: Pick<
  LogisticaGrupoPedidoDuro,
  "entidad_am" | "preventa_label" | "nro_pedido_externo" | "pp_numero"
>): { corto: string; title: string } {
  const raw = String(g.preventa_label || g.nro_pedido_externo || g.pp_numero || "—").trim();
  const pp = String(g.pp_numero ?? "").trim();
  const title = pp && pp !== raw ? `${raw} · ${pp}` : raw;

  if (g.entidad_am === "PE") {
    const src = pp || raw;
    const dep = src.match(/PE-D(\d+)/i)?.[1];
    const tail = src.match(/-(\d{3,})\s*$/)?.[1];
    if (dep) {
      return {
        corto: tail ? `PE · D${dep} · ${tail}` : `PE · D${dep}`,
        title,
      };
    }
    if (raw.length > 22) {
      return { corto: `${raw.slice(0, 10)}…${raw.slice(-6)}`, title };
    }
  }

  if (raw.length > 16) return { corto: `${raw.slice(0, 12)}…`, title };
  return { corto: raw || "—", title };
}

function MetricChip({
  label,
  children,
  accent,
}: {
  label: string;
  children: ReactNode;
  accent?: "emerald" | "amber" | "slate";
}) {
  const valueCls =
    accent === "emerald"
      ? "text-emerald-800"
      : accent === "amber"
        ? "text-amber-800"
        : "text-slate-900";
  return (
    <div className="min-w-[4.5rem] rounded-lg border border-slate-200/80 bg-white/70 px-2.5 py-1.5 shadow-sm">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className={`mt-0.5 text-sm font-bold tabular-nums leading-tight ${valueCls}`}>{children}</div>
    </div>
  );
}

/** Multi-select compacto NIIF (filtros General). */
function MultiSelectFiltro({
  label,
  options,
  selected,
  onChange,
  placeholder = "Todos",
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggleVal = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((x) => x !== value));
    else onChange([...selected, value]);
  };
  return (
    <div className="relative min-w-[9.5rem]">
      <label className="text-[10px] font-bold uppercase text-slate-500">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-0.5 flex w-full items-center justify-between rounded border border-slate-300 bg-white px-2 py-1 text-left text-xs"
      >
        <span className="truncate text-slate-800">
          {selected.length === 0 ? placeholder : `${selected.length} sel.`}
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-slate-300 bg-white p-2 shadow-lg">
          <button
            type="button"
            className="mb-1 w-full rounded px-2 py-1 text-left text-[10px] font-semibold text-rimec-azul hover:bg-slate-50"
            onClick={() => onChange([])}
          >
            Limpiar
          </button>
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(opt.value)}
                onChange={() => toggleVal(opt.value)}
              />
              <span className="truncate" title={opt.label}>
                {opt.label}
              </span>
            </label>
          ))}
          {options.length === 0 && <p className="px-1 text-[10px] text-slate-400">Sin opciones</p>}
        </div>
      )}
    </div>
  );
}

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

function Pelota({
  color,
  paso,
  clickable,
  onClick,
  busy,
}: {
  color: SemaforoColor;
  paso: SemaforoPaso;
  clickable: boolean;
  onClick?: () => void;
  busy?: boolean;
}) {
  const m = SEMAFORO_META[color];
  return (
    <button
      type="button"
      title={`${SEMAFORO_PASO_LABEL[paso]} · ${m.label}${clickable ? " · clic para avanzar" : ""}`}
      disabled={!clickable || busy}
      onClick={onClick}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow transition ${
        clickable ? "cursor-pointer hover:scale-110 ring-2 ring-offset-1 ring-slate-300" : "cursor-default opacity-90"
      } disabled:opacity-40`}
      style={{ backgroundColor: m.bg }}
      aria-label={`${SEMAFORO_PASO_LABEL[paso]} ${m.label}`}
    />
  );
}

type SemaforoHandlers = {
  onPaso1: (row: LogisticaPendienteRow) => void;
  onPaso2: (row: LogisticaPendienteRow) => void;
  onPaso3: (row: LogisticaPendienteRow) => void;
  busyId: number | null;
};

function SemaforoTresPelotas({ row, handlers }: { row: LogisticaPendienteRow; handlers: SemaforoHandlers }) {
  const p = pelotasDesdeFila(row);
  const busy = handlers.busyId === row.id;
  return (
    <div className="flex items-center gap-1.5">
      <Pelota
        color={p.p1}
        paso={1}
        clickable={p.p1 === "rojo"}
        busy={busy}
        onClick={() => handlers.onPaso1(row)}
      />
      <Pelota
        color={p.p2}
        paso={2}
        clickable={p.p2 === "amarillo"}
        busy={busy}
        onClick={() => handlers.onPaso2(row)}
      />
      <Pelota
        color={p.p3}
        paso={3}
        clickable={p.p3 === "amarillo"}
        busy={busy}
        onClick={() => handlers.onPaso3(row)}
      />
    </div>
  );
}

function TablaFilas({
  filas,
  tab,
  selected,
  onToggle,
  multiEnabled,
  handlers,
  mode = "flujo",
  onObsLeida,
}: {
  filas: LogisticaPendienteRow[];
  tab: LogisticaTabId;
  selected: Set<number>;
  onToggle: (id: number) => void;
  multiEnabled: boolean;
  handlers: SemaforoHandlers;
  /** bandeja = Tipo→Marca+PP · flujo = entregas/exitosas */
  mode?: "bandeja" | "flujo";
  onObsLeida?: (fiId: number) => void;
}) {
  const bandeja = mode === "bandeja";
  const { expandedNro, detail, loading, error, toggle } = useLogisticaFiDetalle();

  let colSpan = 9; // semáforo · FI · factura real · cliente · cajas · 2 fechas · atraso · obs
  if (multiEnabled) colSpan += 1;
  if (!bandeja) colSpan += 2; // tipo · PP
  if (bandeja) colSpan += 2; // pares · monto
  if (tab === "exitosas") colSpan += 1; // chofer

  return (
    <div className="overflow-x-auto px-4 pb-3">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-[10px] uppercase text-slate-500">
          <tr>
            {multiEnabled && <th className="px-2 py-1 w-8">✓</th>}
            <th className="px-2 py-1">Semáforo</th>
            {!bandeja && <th className="px-2 py-1">Tipo</th>}
            <th className="px-2 py-1">FI</th>
            <th className="px-2 py-1">{FACTURA_REAL_LABEL}</th>
            <th className="px-2 py-1">Cliente</th>
            <th className="px-2 py-1">Cajas</th>
            {bandeja && <th className="px-2 py-1">Pares</th>}
            {bandeja && <th className="px-2 py-1">Monto</th>}
            <th className="px-2 py-1">{FECHA_LLEGADA_PP_LABEL}</th>
            <th className="px-2 py-1">{FECHA_ENTREGA_CLIENTE_LABEL}</th>
            <th className="px-2 py-1">Atraso</th>
            {!bandeja && <th className="px-2 py-1">PP</th>}
            {tab === "exitosas" && <th className="px-2 py-1">Chofer</th>}
            <th className="px-2 py-1 w-10" aria-label="Obs. Logística" />
          </tr>
        </thead>
        <tbody>
          {filas.map((row) => (
            <Fragment key={row.id}>
              <tr className="border-t border-slate-100 hover:bg-slate-50/80">
                {multiEnabled && (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => onToggle(row.id)}
                      aria-label={`Seleccionar ${row.nro_factura}`}
                    />
                  </td>
                )}
                <td className="px-2 py-2">
                  <SemaforoTresPelotas row={row} handlers={handlers} />
                </td>
                {!bandeja && (
                  <td className="px-2 py-2">
                    <ChipEntidad entidad={row.entidad_am} />
                  </td>
                )}
                <td className="px-2 py-2">
                  <LogisticaFiDetalleCell
                    nro={row.nro_factura}
                    expandedNro={expandedNro}
                    loading={loading}
                    onToggle={toggle}
                  />
                </td>
                <td className="px-2 py-2">
                  <span
                    className={`inline-block rounded-lg border-2 px-2 py-1 font-mono text-[11px] font-black tabular-nums ${
                      row.factura_real
                        ? "border-amber-600 bg-amber-100 text-amber-950 shadow-sm"
                        : "border-dashed border-amber-300 bg-amber-50/80 text-amber-800"
                    }`}
                    title={`${FACTURA_REAL_LABEL} · sistema Carlos (pv_global)`}
                  >
                    {displayFacturaRealUi(row)}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-2 py-2 text-xs" title={row.cliente}>
                  {row.cliente}
                </td>
                <td className="px-2 py-2 text-xs tabular-nums">{row.cajas.toLocaleString("es-PY")}</td>
                {bandeja && (
                  <td className="px-2 py-2 text-xs tabular-nums">{row.pares.toLocaleString("es-PY")}</td>
                )}
                {bandeja && (
                  <td className="px-2 py-2 text-xs tabular-nums">{formatGs(row.monto_neto)}</td>
                )}
                <td className="px-2 py-2 text-xs">{row.fecha_orden}</td>
                <td className="px-2 py-2 text-xs tabular-nums">{row.fecha_entrega_cliente ?? "—"}</td>
                <td
                  className="px-2 py-2 text-xs font-semibold tabular-nums text-amber-800"
                  title={row.pp_publicado_at ? `Pub. PP ${row.pp_publicado_at}` : "Sin pub. PP"}
                >
                  {row.dias_atraso} d
                </td>
                {!bandeja && (
                  <td className="px-2 py-2 text-xs font-mono text-slate-500">{row.pp_numero}</td>
                )}
                {tab === "exitosas" && (
                  <td className="px-2 py-2 text-[10px] text-emerald-800">
                    {row.chofer_nombre ?? "—"} · {row.fecha_entrega_efectiva ?? "—"}
                  </td>
                )}
                <td className="px-2 py-2 text-center">
                  <ObsLogisticaIcon
                    fiId={row.factura_interna_id}
                    tab={tab}
                    count={row.obs_count}
                    noLeida={row.obs_no_leida}
                    onLeida={onObsLeida}
                  />
                </td>
              </tr>
              <LogisticaFiDetallePanel
                nro={row.nro_factura}
                expandedNro={expandedNro}
                detail={detail}
                loading={loading}
                error={error}
                colSpan={colSpan}
              />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricasMini({
  cajas,
  pares,
  monto,
  nFi,
  nCli,
}: {
  cajas: number;
  pares: number;
  monto: number;
  nFi: number;
  nCli?: number;
}) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      <div>
        <p className="text-[8px] font-bold uppercase text-slate-500">Cajas</p>
        <p className="text-sm font-bold tabular-nums text-slate-900">{cajas.toLocaleString("es-PY")}</p>
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase text-slate-500">Pares</p>
        <p className="text-sm font-bold tabular-nums text-slate-900">{pares.toLocaleString("es-PY")}</p>
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase text-slate-500">Monto neto</p>
        <p className="text-sm font-bold tabular-nums text-emerald-800">{formatGs(monto)}</p>
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase text-slate-500">FI</p>
        <p className="text-sm font-semibold tabular-nums text-slate-800">{nFi}</p>
      </div>
      {nCli != null && (
        <div>
          <p className="text-[8px] font-bold uppercase text-slate-500">Clientes</p>
          <p className="text-sm font-semibold tabular-nums text-slate-800">{nCli}</p>
        </div>
      )}
    </div>
  );
}

function AcordeonMarcasDestacadas({
  prefix,
  marcas,
  tab,
  openMarca,
  setOpenMarca,
  selected,
  onToggle,
  multiEnabled,
  handlers,
  onObsLeida,
}: {
  prefix: string;
  marcas: LogisticaGrupoPedidoDuro["marcas"];
  tab: LogisticaTabId;
  openMarca: Record<string, boolean>;
  setOpenMarca: Dispatch<SetStateAction<Record<string, boolean>>>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  multiEnabled: boolean;
  handlers: SemaforoHandlers;
  onObsLeida?: (fiId: number) => void;
}) {
  if (marcas.length === 0) {
    return <p className="px-4 py-3 text-xs text-slate-500">Sin filas en este bloque.</p>;
  }
  return (
    <div className="space-y-1 p-2">
      {marcas.map((m) => {
        const mk = `${prefix}__${m.key}`;
        const mOpen = openMarca[mk] ?? false;
        return (
          <div key={mk} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex w-full items-center gap-2 bg-sky-50/90 hover:bg-sky-100">
              <button
                type="button"
                onClick={() => setOpenMarca((o) => ({ ...o, [mk]: !mOpen }))}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="min-w-[7rem] text-sm font-bold text-rimec-azul-dark">{m.marca}</span>
                <span
                  className="min-w-[6.5rem] max-w-[12rem] truncate text-xs font-bold uppercase tracking-wide text-amber-800"
                  title={(m.vendedores ?? []).join(", ") || "Sin vendedor"}
                >
                  {(m.vendedores ?? []).length > 0 ? (m.vendedores ?? []).join(" · ") : "—"}
                </span>
                <MetricasMini cajas={m.cajas} pares={m.pares} monto={m.monto} nFi={m.n_fi} />
                <span className="text-xs text-slate-500">{mOpen ? "▲" : "▼"}</span>
              </button>
              <div className="shrink-0 pr-3">
                <ObsLogisticaGrupoIcon filas={m.filas} tab={tab} onLeida={onObsLeida} />
              </div>
            </div>
            {mOpen && (
              <TablaFilas
                filas={m.filas}
                tab={tab}
                mode="bandeja"
                selected={selected}
                onToggle={onToggle}
                multiEnabled={multiEnabled}
                handlers={handlers}
                onObsLeida={onObsLeida}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AcordeonPedidoDuro({
  grupos,
  tab,
  openPedido,
  setOpenPedido,
  openMarca,
  setOpenMarca,
  openCadena,
  setOpenCadena,
  selected,
  onToggle,
  multiEnabled,
  handlers,
  pdfBusyId,
  onPdf,
  onObsLeida,
}: {
  grupos: LogisticaGrupoPedidoDuro[];
  tab: LogisticaTabId;
  openPedido: Record<string, boolean>;
  setOpenPedido: Dispatch<SetStateAction<Record<string, boolean>>>;
  openMarca: Record<string, boolean>;
  setOpenMarca: Dispatch<SetStateAction<Record<string, boolean>>>;
  openCadena: Record<string, boolean>;
  setOpenCadena: Dispatch<SetStateAction<Record<string, boolean>>>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  multiEnabled: boolean;
  handlers: SemaforoHandlers;
  pdfBusyId: number | null;
  onPdf: (ppId: number) => void;
  onObsLeida?: (fiId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {grupos.map((g) => {
        const open = openPedido[g.key] ?? true;
        const color = ENTIDAD_AM_META[g.entidad_am]?.color ?? "#002B4E";
        const pedidoUi = labelPedidoExternoUi(g);
        const mostrarStockRimec = bloqueStockRimecVisible(g.entidad_am, g.stockRimec);
        return (
          <div key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div
              className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4"
              style={{ backgroundColor: `${color}14` }}
            >
              <button
                type="button"
                onClick={() => setOpenPedido((o) => ({ ...o, [g.key]: !open }))}
                className="min-w-0 flex-1 text-left hover:opacity-95"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: color }}
                  >
                    {g.categoria_label}
                  </span>
                  <div className="min-w-0 max-w-[13rem]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Pedido externo</p>
                    <p
                      className="truncate font-mono text-base font-bold text-rimec-azul-dark"
                      title={pedidoUi.title}
                    >
                      {pedidoUi.corto}
                    </p>
                  </div>
                  <div className="min-w-[5.5rem] max-w-[9rem]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Dato duro</p>
                    <p className="truncate text-sm font-semibold text-slate-800" title={g.quincena_corta}>
                      {g.quincena_corta}
                    </p>
                  </div>
                  <span className="ml-auto text-xs text-slate-500 lg:hidden">{open ? "▲" : "▼"}</span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <MetricChip
                    label="Atraso PP"
                    accent="amber"
                  >
                    <span title={g.pp_publicado_at ? `Publicado ${g.pp_publicado_at}` : undefined}>
                      {g.dias_atraso} d
                    </span>
                  </MetricChip>
                  <MetricChip label="Inicial">
                    {g.n_inicial} FI · {(g.cajas_inicial ?? g.cajas).toLocaleString("es-PY")} c
                  </MetricChip>
                  <MetricChip label="Ejecución" accent="emerald">
                    {g.pct_ejecucion ?? 0}%
                    <span className="ml-1 text-[10px] font-semibold text-emerald-700">
                      ({g.n_exitosas ?? 0}/{g.n_inicial})
                    </span>
                  </MetricChip>
                  <MetricChip label="Cajas">
                    {g.cajas.toLocaleString("es-PY")}
                    <span className="text-slate-400">/</span>
                    {(g.cajas_inicial ?? g.cajas).toLocaleString("es-PY")}
                  </MetricChip>
                  <MetricChip label="% · pares" accent="emerald">
                    {g.pct_cajas ?? 0}%
                    <span className="ml-1 text-[11px] font-semibold text-slate-600">
                      · {g.pares.toLocaleString("es-PY")} p
                    </span>
                  </MetricChip>
                  <MetricChip label="Monto neto" accent="emerald">
                    {formatGs(g.monto)}
                  </MetricChip>
                  <MetricChip label="FI · clientes">
                    {g.n_fi}/{g.n_inicial} · {g.n_clientes}
                    <span className="ml-1.5 hidden text-xs font-normal text-slate-500 lg:inline">
                      {open ? "▲" : "▼"}
                    </span>
                  </MetricChip>
                </div>
              </button>
              <button
                type="button"
                disabled={pdfBusyId === g.pedido_proveedor_id}
                onClick={() => onPdf(g.pedido_proveedor_id)}
                className="shrink-0 self-stretch rounded-xl bg-rimec-azul px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rimec-azul-dark disabled:opacity-50 lg:self-center"
              >
                {pdfBusyId === g.pedido_proveedor_id ? "Generando PDF…" : "Generar PDF listado"}
              </button>
            </div>

            {open && (
              <div className="space-y-3 border-t border-slate-100 bg-slate-50/40 p-3">
                <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {g.pp_numero}
                  {mostrarStockRimec
                    ? " · BAZZAR = holding · RIMEC = remanente depósito (no mezclar)"
                    : " · BAZZAR = holding tiendas"}
                </p>

                {/* STOCK · BAZZAR */}
                <div className="overflow-hidden rounded-xl border-2 border-sky-300 bg-sky-50/50">
                  <div className="flex flex-wrap items-center gap-3 border-b border-sky-200 bg-sky-100/80 px-4 py-2.5">
                    <span className="rounded bg-sky-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      STOCK · BAZZAR
                    </span>
                    <span className="text-xs font-semibold text-sky-900">Holding tiendas</span>
                    <MetricasMini
                      cajas={g.stockBazzar.cajas}
                      pares={g.stockBazzar.pares}
                      monto={g.stockBazzar.monto}
                      nFi={g.stockBazzar.n_fi}
                      nCli={g.stockBazzar.n_clientes}
                    />
                  </div>
                  <AcordeonMarcasDestacadas
                    prefix={`${g.key}__bazzar`}
                    marcas={g.stockBazzar.marcas}
                    tab={tab}
                    openMarca={openMarca}
                    setOpenMarca={setOpenMarca}
                    selected={selected}
                    onToggle={onToggle}
                    multiEnabled={multiEnabled}
                    handlers={handlers}
                    onObsLeida={onObsLeida}
                  />
                </div>

                {mostrarStockRimec ? (
                  <div className="overflow-hidden rounded-xl border-2 border-amber-300 bg-amber-50/40">
                    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-100/80 px-4 py-2.5">
                      <span className="rounded bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        STOCK · RIMEC
                      </span>
                      <span className="text-xs font-semibold text-amber-950">Remanente → depósito</span>
                      <MetricasMini
                        cajas={g.stockRimec.cajas}
                        pares={g.stockRimec.pares}
                        monto={g.stockRimec.monto}
                        nFi={g.stockRimec.n_fi}
                        nCli={g.stockRimec.n_clientes}
                      />
                    </div>
                    <AcordeonMarcasDestacadas
                      prefix={`${g.key}__rimec`}
                      marcas={g.stockRimec.marcas}
                      tab={tab}
                      openMarca={openMarca}
                      setOpenMarca={setOpenMarca}
                      selected={selected}
                      onToggle={onToggle}
                      multiEnabled={multiEnabled}
                      handlers={handlers}
                      onObsLeida={onObsLeida}
                    />
                  </div>
                ) : null}

                {/* Cadenas clientes — renglón resumen Ivan */}
                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Cadenas de clientes · resumen
                  </p>
                  {g.cadenas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-xs text-slate-500">
                      Sin cadenas comerciales (solo STOCK).
                    </p>
                  ) : (
                    g.cadenas.map((cad) => {
                      const ck = `${g.key}__cad__${cad.key}`;
                      const cadOpen = openCadena[ck] ?? false;
                      return (
                        <div key={ck} className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                          <div className="flex w-full flex-wrap items-center gap-2 bg-slate-100/90 hover:bg-slate-200/80">
                            <button
                              type="button"
                              onClick={() => setOpenCadena((o) => ({ ...o, [ck]: !cadOpen }))}
                              className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-3 text-left"
                            >
                              <span className="min-w-[10rem] text-sm font-bold text-rimec-azul-dark">
                                {cad.cadena_label}
                              </span>
                              <MetricasMini
                                cajas={cad.cajas}
                                pares={cad.pares}
                                monto={cad.monto}
                                nFi={cad.n_fi}
                                nCli={cad.n_clientes}
                              />
                              <span className="text-xs text-slate-500">{cadOpen ? "▲" : "▼"}</span>
                            </button>
                            <div className="shrink-0 pr-3">
                              <ObsLogisticaGrupoIcon
                                filas={cad.marcas.flatMap((mk) => mk.filas)}
                                tab={tab}
                                onLeida={onObsLeida}
                              />
                            </div>
                          </div>
                          {/* Renglón resumen cadena (Ivan Total) */}
                          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                            Total {cad.cadena_label}: {cad.cajas.toLocaleString("es-PY")} c ·{" "}
                            {cad.pares.toLocaleString("es-PY")} p · {formatGs(cad.monto)} · {cad.n_fi} FI ·{" "}
                            {cad.n_clientes} cli
                          </div>
                          {cadOpen && (
                            <AcordeonMarcasDestacadas
                              prefix={ck}
                              marcas={cad.marcas}
                              tab={tab}
                              openMarca={openMarca}
                              setOpenMarca={setOpenMarca}
                              selected={selected}
                              onToggle={onToggle}
                              multiEnabled={multiEnabled}
                              handlers={handlers}
                              onObsLeida={onObsLeida}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AcordeonTipoMarcaPp({
  tipos,
  tab,
  prefix,
  openTipo,
  setOpenTipo,
  openMarcaPp,
  setOpenMarcaPp,
  selected,
  onToggle,
  multiEnabled,
  handlers,
}: {
  tipos: LogisticaGrupoTipo[];
  tab: LogisticaTabId;
  prefix: string;
  openTipo: Record<string, boolean>;
  setOpenTipo: Dispatch<SetStateAction<Record<string, boolean>>>;
  openMarcaPp: Record<string, boolean>;
  setOpenMarcaPp: Dispatch<SetStateAction<Record<string, boolean>>>;
  selected: Set<number>;
  onToggle: (id: number) => void;
  multiEnabled: boolean;
  handlers: SemaforoHandlers;
}) {
  return (
    <div className="space-y-2">
      {tipos.map((t) => {
        const tk = `${prefix}__${t.key}`;
        const tOpen = openTipo[tk] ?? true;
        const color = ENTIDAD_AM_META[t.entidad_am]?.color ?? "#002B4E";
        return (
          <div key={tk} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenTipo((o) => ({ ...o, [tk]: !tOpen }))}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:opacity-95"
              style={{ backgroundColor: `${color}18` }}
            >
              <span className="font-bold" style={{ color }}>
                {t.label}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {t.n_fi} FI · {t.cajas.toLocaleString("es-PY")} c · {t.marcasPp.length}{" "}
                {t.marcasPp.length === 1 ? "pedido" : "pedidos"} {tOpen ? "▲" : "▼"}
              </span>
            </button>
            {tOpen &&
              t.marcasPp.map((m) => {
                const mk = `${tk}__${m.key}`;
                const mOpen = openMarcaPp[mk] ?? true;
                return (
                  <div key={mk} className="border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setOpenMarcaPp((o) => ({ ...o, [mk]: !mOpen }))}
                      className="flex w-full items-center justify-between border-l-4 border-rimec-azul bg-slate-50 px-6 py-2.5 text-left hover:bg-slate-100"
                    >
                      <span className="text-sm font-semibold text-rimec-azul-dark">{m.label}</span>
                      <span className="text-xs text-slate-600">
                        {m.cajas.toLocaleString("es-PY")} c · {m.pares.toLocaleString("es-PY")} p ·{" "}
                        {formatGs(m.monto)} · {m.filas.length} FI {mOpen ? "▲" : "▼"}
                      </span>
                    </button>
                    {mOpen && (
                      <TablaFilas
                        filas={m.filas}
                        tab={tab}
                        mode="bandeja"
                        selected={selected}
                        onToggle={onToggle}
                        multiEnabled={multiEnabled}
                        handlers={handlers}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

export function LogisticaOkClient() {
  const [tab, setTab] = useState<LogisticaTabId>("general");
  const [tabsPermitidas, setTabsPermitidas] = useState<LogisticaTabId[]>(LOGISTICA_TABS.map((t) => t.id));
  const [categoriaSesion, setCategoriaSesion] = useState<string>("DIOS");
  const [vendedorId, setVendedorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filasRaw, setFilasRaw] = useState<LogisticaPendienteRow[]>([]);
  const [gruposTipo, setGruposTipo] = useState<LogisticaGrupoTipo[]>([]);
  const [gruposPedidoDuro, setGruposPedidoDuro] = useState<LogisticaGrupoPedidoDuro[]>([]);
  const [statsPorPp, setStatsPorPp] = useState<Record<number, LogisticaStatsPp>>({});
  const [gruposVendedor, setGruposVendedor] = useState<LogisticaGrupoVendedor[]>([]);
  const [gruposDiaChofer, setGruposDiaChofer] = useState<LogisticaGrupoDiaConChofer[]>([]);
  const [stats, setStats] = useState({
    n: 0,
    cajas: 0,
    n_inicial: 0,
    cajas_inicial: 0,
    pct_ejecucion: 0,
    pct_cajas: 0,
    obs_con: 0,
    obs_abiertos: 0,
    obs_label: "0/0 mensajes abiertos",
  });
  const [openVendedor, setOpenVendedor] = useState<Record<string, boolean>>({});
  const [openTipo, setOpenTipo] = useState<Record<string, boolean>>({});
  const [openMarcaPp, setOpenMarcaPp] = useState<Record<string, boolean>>({});
  const [openPedido, setOpenPedido] = useState<Record<string, boolean>>({});
  const [openMarca, setOpenMarca] = useState<Record<string, boolean>>({});
  const [openCadenaResumen, setOpenCadenaResumen] = useState<Record<string, boolean>>({});
  const [openDia, setOpenDia] = useState<Record<string, boolean>>({});
  const [openChofer, setOpenChofer] = useState<Record<string, boolean>>({});
  const [pdfBusyId, setPdfBusyId] = useState<number | null>(null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fechaLote, setFechaLote] = useState("");
  const [filtroQ, setFiltroQ] = useState("");
  const [filtroVendedores, setFiltroVendedores] = useState<string[]>([]);
  const [filtroCadenas, setFiltroCadenas] = useState<string[]>([]);
  const [filtroClientes, setFiltroClientes] = useState<string[]>([]);
  const [filtroMarcas, setFiltroMarcas] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** Modal paso 3 */
  const [cierreRow, setCierreRow] = useState<LogisticaPendienteRow | null>(null);
  const [cierreFecha, setCierreFecha] = useState("");
  const [cierreChofer, setCierreChofer] = useState<string>(CHOFERES_RIMEC_INICIAL[0]);

  const esTabGeneral = tab === "general" || tab === "general_exitoso";
  const multiEnabled =
    tab === "general" || tab === "vendedor" || tab === "confirmadas" || tab === "entregas";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ tab });
      if (tab === "vendedor" && vendedorId.trim()) q.set("vendedor_id", vendedorId.trim());
      const res = await fetch(`/api/logistica-ok/bandeja?${q}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      if (Array.isArray(data.tabsPermitidas) && data.tabsPermitidas.length) {
        setTabsPermitidas(data.tabsPermitidas);
        if (data.categoria) setCategoriaSesion(String(data.categoria));
      }
      setFilasRaw(data.filas ?? []);
      setGruposTipo(data.gruposTipo ?? []);
      setGruposPedidoDuro(data.gruposPedidoDuro ?? []);
      setStatsPorPp(data.statsPorPp ?? {});
      setGruposVendedor(data.gruposVendedor ?? []);
      setGruposDiaChofer(data.gruposDiaChofer ?? []);
      const obs = statsObsMensajes(data.filas ?? []);
      setStats({
        n: data.stats?.n ?? 0,
        cajas: data.stats?.cajas ?? 0,
        n_inicial: data.stats?.n_inicial ?? data.stats?.n ?? 0,
        cajas_inicial: data.stats?.cajas_inicial ?? data.stats?.cajas ?? 0,
        pct_ejecucion: data.stats?.pct_ejecucion ?? 0,
        pct_cajas: data.stats?.pct_cajas ?? 0,
        obs_con: data.stats?.obs_con ?? obs.conObs,
        obs_abiertos: data.stats?.obs_abiertos ?? obs.abiertos,
        obs_label: data.stats?.obs_label ?? obs.label,
      });
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [tab, vendedorId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = await res.json();
        if (res.ok && data.user) {
          const cat = String(data.user.categoria || data.user.role || "").toUpperCase();
          setCategoriaSesion(cat);
          const tabs = tabsPermitidasLogistica(cat);
          setTabsPermitidas(tabs.length ? tabs : ["general"]);
          setTab((prev) => (tabs.includes(prev) ? prev : tabs[0] ?? "general"));
        }
      } catch {
        /* sesión opcional al montar */
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onObsLeida = useCallback((fiId: number) => {
    setFilasRaw((prev) => {
      const next = prev.map((f) =>
        f.factura_interna_id === fiId ? { ...f, obs_no_leida: false } : f,
      );
      const obs = statsObsMensajes(next);
      setStats((s) => ({
        ...s,
        obs_con: obs.conObs,
        obs_abiertos: obs.abiertos,
        obs_label: obs.label,
      }));
      return next;
    });
  }, []);
  const filasFiltradas = useMemo(() => {
    if (!esTabGeneral) return filasRaw;
    return filtrarFilasLogistica(filasRaw, {
      q: filtroQ,
      vendedores: filtroVendedores,
      cadenas: filtroCadenas,
      clientes: filtroClientes,
      marcas: filtroMarcas,
    });
  }, [
    esTabGeneral,
    filasRaw,
    filtroQ,
    filtroVendedores,
    filtroCadenas,
    filtroClientes,
    filtroMarcas,
  ]);

  const gruposPedidoFiltrados = useMemo(() => {
    if (!esTabGeneral) return gruposPedidoDuro;
    return enriquecerGruposConStatsPp(groupLogisticaPorPedidoDuro(filasFiltradas), statsPorPp);
  }, [esTabGeneral, gruposPedidoDuro, filasFiltradas, statsPorPp]);

  const opcionesFiltro = useMemo(() => {
    const vend = new Map<string, string>();
    const cad = new Map<string, string>();
    const cli = new Map<string, string>();
    const mar = new Map<string, string>();
    let haySinCadena = false;
    for (const r of filasRaw) {
      const vk = String(r.id_vendedor ?? r.vendedor);
      vend.set(vk, r.vendedor || vk);
      // Sales Report: Cadena = solo id_cadena real (cadena_v2). Cliente suelto ≠ cadena.
      if (r.id_cadena != null) {
        const descp = (r.cadena ?? "").trim() || `Cadena ${r.id_cadena}`;
        cad.set(String(r.id_cadena), descp);
      } else {
        haySinCadena = true;
      }
      cli.set(String(r.id_cliente), `${r.id_cliente} · ${r.cliente}`);
      mar.set(r.marca, r.marca);
    }
    if (haySinCadena) {
      cad.set("0", "Clientes sin cadenas");
    }
    return {
      vendedores: [...vend.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
      cadenas: [...cad.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => {
          if (a.value === "0") return 1;
          if (b.value === "0") return -1;
          return a.label.localeCompare(b.label, "es");
        }),
      clientes: [...cli.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => Number(a.value) - Number(b.value)),
      marcas: [...mar.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    };
  }, [filasRaw]);

  const statsVista = useMemo(() => {
    const n = filasFiltradas.length;
    const cajas = filasFiltradas.reduce((s, r) => s + r.cajas, 0);
    const obs = statsObsMensajes(filasFiltradas);
    return { n, cajas, obs };
  }, [filasFiltradas]);

  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const idsSeleccion = useMemo(() => [...selected], [selected]);

  function queryFiltrosPdf(): string {
    const q = new URLSearchParams();
    q.set("tab", tab);
    if (filtroQ.trim()) q.set("q", filtroQ.trim());
    if (filtroVendedores.length) q.set("vendedores", filtroVendedores.join(","));
    if (filtroCadenas.length) q.set("cadenas", filtroCadenas.join(","));
    if (filtroClientes.length) q.set("clientes", filtroClientes.join(","));
    if (filtroMarcas.length) q.set("marcas", filtroMarcas.join(","));
    return q.toString();
  }

  async function descargarListadoPdf(ppId: number) {
    setPdfBusyId(ppId);
    setError(null);
    try {
      const filtros = queryFiltrosPdf();
      const res = await fetch(
        `/api/logistica-ok/listado-pdf?pedido_proveedor_id=${ppId}&${filtros}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `PDF ${res.status}`);
      }
      const fiCount = res.headers.get("X-Logistica-FI-Count");
      const atraso = res.headers.get("X-Logistica-Dias-Atraso");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] || `LISTADO_${ppId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(
        fiCount
          ? `PDF filtrado · ${fiCount} FI${atraso != null ? ` · atraso ${atraso} d` : ""}`
          : "PDF listo",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error PDF");
    } finally {
      setPdfBusyId(null);
    }
  }

  async function patchOne(
    id: number,
    body: Record<string, unknown>,
    nextTab: LogisticaTabId,
  ) {
    setBusyId(id);
    setToast(null);
    try {
      const res = await fetch(`/api/logistica-ok/pendiente/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setToast("Avanzó · cambiando pestaña…");
      setTab(nextTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const handlers: SemaforoHandlers = {
    busyId,
    onPaso1: (row) => {
      const fecha = fechaLote || row.fecha_entrega_cliente || "";
      if (!fecha) {
        setToast(
          `Elegí ${FECHA_ENTREGA_CLIENTE_LABEL} arriba (barra multi) y clic de nuevo en la pelota roja.`,
        );
        return;
      }
      void patchOne(
        row.id,
        { action: "fecha_cliente", fecha_entrega_cliente: fecha },
        "confirmadas",
      );
    },
    onPaso2: (row) => {
      void patchOne(row.id, { action: "impresion_legal" }, "entregas");
    },
    onPaso3: (row) => {
      setCierreRow(row);
      setCierreFecha(row.fecha_entrega_cliente ?? fechaLote ?? "");
      setCierreChofer(CHOFERES_RIMEC_INICIAL[0]);
    },
  };

  async function bulkFecha() {
    if (!fechaLote || idsSeleccion.length === 0) return;
    setBulkBusy(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch("/api/logistica-ok/bulk", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fecha_cliente",
          ids: idsSeleccion,
          fecha_entrega_cliente: fechaLote,
        }),
      });
      const data = await res.json();
      const done = Number(data.done ?? 0);
      const failed = Number(data.failed ?? 0);
      const requested = Number(data.requested ?? idsSeleccion.length);
      if (done === 0) {
        throw new Error(data.error || "Ninguna FI actualizada (¿ya estaban confirmadas?).");
      }
      const msg = `OK ${done}/${requested} FI con fecha${
        failed > 0 ? ` · ${failed} omitidas (otro estado)` : ""
      }${data.error ? ` · ${data.error}` : ""}`;
      setToast(msg);
      if (failed === 0) setTab("confirmadas");
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkImpresion() {
    if (idsSeleccion.length === 0) return;
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/logistica-ok/bulk", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "impresion_legal", ids: idsSeleccion }),
      });
      const data = await res.json();
      const done = Number(data.done ?? 0);
      const failed = Number(data.failed ?? 0);
      if (done === 0) throw new Error(data.error || "Ninguna FI en Confirmadas.");
      setToast(`OK ${done} impresión legal${failed > 0 ? ` · ${failed} omitidas` : ""}`);
      if (failed === 0) setTab("entregas");
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function confirmarCierre() {
    if (!cierreRow) return;
    setBusyId(cierreRow.id);
    try {
      const res = await fetch(`/api/logistica-ok/pendiente/${cierreRow.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cierre_entrega",
          fecha_entrega_efectiva: cierreFecha,
          chofer_nombre: cierreChofer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setCierreRow(null);
      setToast("Entrega exitosa");
      setTab("exitosas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const hayDatos =
    tab === "vendedor"
      ? gruposVendedor.length > 0
      : tab === "entregas" || tab === "exitosas"
        ? gruposDiaChofer.length > 0
        : tab === "confirmadas"
          ? gruposTipo.length > 0
          : gruposPedidoFiltrados.length > 0;

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Hub Report
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">2.3.1.28</p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Logística OK</h1>
        <p className="mt-2 text-sm text-neutral-700">
          Filtros multi-select · PDF = resultado filtrado · atraso desde publicación PP
        </p>

        <div className="mt-4 rounded-xl border-4 border-amber-500 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest text-amber-900">Protocolo CHUSAR · palabra reservada</p>
          <p className="mt-1 text-sm font-bold text-amber-950">
            {FACTURA_REAL_LABEL} = número factura del <strong>sistema Carlos</strong> (columna destacada ·{" "}
            <code className="text-xs">pv_global</code>). Origen: CSV cierre importación PP antes de Compras.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {LOGISTICA_TABS.filter((t) => tabsPermitidas.includes(t.id)).map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${
                tab === t.id ? "bg-rimec-azul text-white" : "border border-slate-300 bg-white text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Perfil {categoriaSesion || "—"} · lectura de sobres por pestaña (al cambiar de tab se cierran de nuevo)
        </p>

        {/* Leyenda 3 pelotas */}
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-red-600" />1 Sin fecha
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="h-3 w-3 rounded-full bg-amber-500" />2 Con fecha → legal + depósito
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            <span className="h-3 w-3 rounded-full bg-amber-500" />3 Solo depósito
          </span>
        </div>

        {/* Barra filtros / fecha (sin asignación vendedor) */}
        {(multiEnabled || esTabGeneral) && (
          <div className="mt-4 space-y-3 rounded-xl border-2 border-rimec-azul/20 bg-rimec-azul/[0.04] px-4 py-3">
            {esTabGeneral && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Buscar (código · marca · cliente)
                  </label>
                  <input
                    type="search"
                    className="mt-0.5 block w-full rounded border-2 border-red-300 bg-white px-2 py-1 text-sm"
                    placeholder="Código, marca o nombre…"
                    value={filtroQ}
                    onChange={(e) => setFiltroQ(e.target.value)}
                  />
                </div>
                <MultiSelectFiltro
                  label="Vendedor"
                  options={opcionesFiltro.vendedores}
                  selected={filtroVendedores}
                  onChange={setFiltroVendedores}
                />
                <MultiSelectFiltro
                  label="Cadena (maestro)"
                  options={opcionesFiltro.cadenas}
                  selected={filtroCadenas}
                  onChange={setFiltroCadenas}
                  placeholder="Todas · o sin cadena"
                />
                <MultiSelectFiltro
                  label="Código cliente"
                  options={opcionesFiltro.clientes}
                  selected={filtroClientes}
                  onChange={setFiltroClientes}
                />
                <MultiSelectFiltro
                  label="Marca"
                  options={opcionesFiltro.marcas}
                  selected={filtroMarcas}
                  onChange={setFiltroMarcas}
                />
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              {tab === "general" && (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">
                      {FECHA_ENTREGA_CLIENTE_LABEL}
                    </label>
                    <input
                      type="date"
                      className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
                      value={fechaLote}
                      onChange={(e) => setFechaLote(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={bulkBusy || !fechaLote || idsSeleccion.length === 0}
                    onClick={() => void bulkFecha()}
                    className="rounded-lg bg-rimec-azul px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {bulkBusy ? "…" : `Asignar fecha a ${idsSeleccion.length || "…"} FI`}
                  </button>
                  <span className="text-xs text-slate-500">{idsSeleccion.length} seleccionadas</span>
                </>
              )}
              {tab === "confirmadas" && (
                <button
                  type="button"
                  disabled={bulkBusy || idsSeleccion.length === 0}
                  onClick={() => void bulkImpresion()}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  Impresión legal · {idsSeleccion.length} FI
                </button>
              )}
              <button
                type="button"
                onClick={() => load()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-white"
              >
                Refrescar
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                  <span className="font-bold text-slate-500">Inicial</span>{" "}
                  <strong>{stats.n_inicial}</strong> FI ·{" "}
                  <strong>{stats.cajas_inicial.toLocaleString("es-PY")}</strong> cajas
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                  <span className="font-bold text-emerald-800">Ejecución</span>{" "}
                  <strong>{stats.pct_ejecucion}%</strong> FI ·{" "}
                  <strong>{stats.pct_cajas}%</strong> cajas
                </div>
                <div className="rounded-lg border border-rimec-azul/30 bg-white px-3 py-2 text-sm">
                  Vista <strong>{statsVista.n}</strong> FI ·{" "}
                  <strong>{statsVista.cajas.toLocaleString("es-PY")}</strong> cajas
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                    statsVista.obs.abiertos > 0
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  title="con mensajes / aún abiertos (sin leer) en esta pestaña"
                >
                  ✉️ {statsVista.obs.label}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "vendedor" && (
          <div className="mt-3">
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

        {toast && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {toast}
          </p>
        )}

        {loading ? (
          <div className="mt-6">
            <Skeleton className="h-24 w-full" count={3} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : !hayDatos ? (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-slate-500">
            Sin filas en esta pestaña.
          </p>
        ) : tab === "vendedor" ? (
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
                      {vg.n_fi} FI {vendOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {vendOpen && (
                    <div className="space-y-2 p-3">
                      <AcordeonTipoMarcaPp
                        tipos={vg.tipos}
                        tab={tab}
                        prefix={vg.key}
                        openTipo={openTipo}
                        setOpenTipo={setOpenTipo}
                        openMarcaPp={openMarcaPp}
                        setOpenMarcaPp={setOpenMarcaPp}
                        selected={selected}
                        onToggle={toggle}
                        multiEnabled={multiEnabled}
                        handlers={handlers}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : tab === "entregas" || tab === "exitosas" ? (
          <div className="mt-6 space-y-3">
            {gruposDiaChofer.map((d) => {
              const open = openDia[d.key] ?? true;
              return (
                <div key={d.key} className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenDia((o) => ({ ...o, [d.key]: !open }))}
                    className="flex w-full items-center justify-between bg-emerald-50 px-4 py-3 text-left hover:bg-emerald-100/80"
                  >
                    <span className="font-semibold text-emerald-900">
                      {FECHA_ENTREGA_CLIENTE_LABEL} · {d.fecha}
                    </span>
                    <span className="text-xs text-emerald-800">
                      {d.choferes.reduce((s, c) => s + c.filas.length, 0)} FI · {d.choferes.length}{" "}
                      {d.choferes.length === 1 ? "chofer" : "choferes"} {open ? "▲" : "▼"}
                    </span>
                  </button>
                  {open &&
                    d.choferes.map((ch) => {
                      const ck = `${d.key}__${ch.key}`;
                      const chOpen = openChofer[ck] ?? true;
                      return (
                        <div key={ck} className="border-t border-emerald-100">
                          <button
                            type="button"
                            onClick={() => setOpenChofer((o) => ({ ...o, [ck]: !chOpen }))}
                            className="flex w-full items-center justify-between border-l-4 border-sky-600 bg-sky-50/90 px-6 py-3 text-left hover:bg-sky-100"
                          >
                            <span className="text-sm font-bold tracking-wide text-sky-950">
                              Chofer · {ch.chofer}
                            </span>
                            <span className="text-xs font-semibold text-sky-800">
                              {ch.cajas.toLocaleString("es-PY")} c · {ch.filas.length} FI {chOpen ? "▲" : "▼"}
                            </span>
                          </button>
                          {chOpen && (
                            <TablaFilas
                              filas={ch.filas}
                              tab={tab}
                              mode="flujo"
                              selected={selected}
                              onToggle={toggle}
                              multiEnabled={multiEnabled && tab === "entregas"}
                              handlers={handlers}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ) : tab === "confirmadas" ? (
          <div className="mt-6">
            <AcordeonTipoMarcaPp
              tipos={gruposTipo}
              tab={tab}
              prefix="root"
              openTipo={openTipo}
              setOpenTipo={setOpenTipo}
              openMarcaPp={openMarcaPp}
              setOpenMarcaPp={setOpenMarcaPp}
              selected={selected}
              onToggle={toggle}
              multiEnabled={multiEnabled}
              handlers={handlers}
            />
          </div>
        ) : (
          <div className="mt-6">
            <AcordeonPedidoDuro
              grupos={gruposPedidoFiltrados}
              tab={tab}
              openPedido={openPedido}
              setOpenPedido={setOpenPedido}
              openMarca={openMarca}
              setOpenMarca={setOpenMarca}
              openCadena={openCadenaResumen}
              setOpenCadena={setOpenCadenaResumen}
              selected={selected}
              onToggle={toggle}
              multiEnabled={multiEnabled}
              handlers={handlers}
              pdfBusyId={pdfBusyId}
              onPdf={(ppId) => void descargarListadoPdf(ppId)}
              onObsLeida={onObsLeida}
            />
          </div>
        )}
      </main>

      {cierreRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-serif text-xl text-rimec-azul-dark">Cierre entrega · {cierreRow.nro_factura}</h2>
            <p className="mt-1 text-xs text-slate-500">Duplicado firmado + recibí conforme</p>
            <label className="mt-4 block text-[10px] font-bold uppercase text-slate-500">
              {FECHA_ENTREGA_EFECTIVA_LABEL}
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={cierreFecha}
              onChange={(e) => setCierreFecha(e.target.value)}
            />
            <label className="mt-3 block text-[10px] font-bold uppercase text-slate-500">Chofer</label>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={cierreChofer}
              onChange={(e) => setCierreChofer(e.target.value)}
            >
              {CHOFERES_RIMEC_INICIAL.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-xs font-semibold"
                onClick={() => setCierreRow(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!cierreFecha || !cierreChofer || busyId === cierreRow.id}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                onClick={() => void confirmarCierre()}
              >
                Entrega exitosa
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportFooter note="Logística OK · semáforo 3 pelotas · multi-fecha · 2.3.1.28.5" />
    </>
  );
}
