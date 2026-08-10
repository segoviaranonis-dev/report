"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { EXCEL_AL_0308 } from "@/lib/situacion-financiera/excel-al-0308";
import mapaCanon from "@/lib/situacion-financiera/mapa-canon-al-0308.json";
import {
  inferMesContext,
  molKeyForExcelRow,
  origenRespaldo,
  type SfRespaldoOrigen,
} from "@/lib/situacion-financiera/mol-key";
import type { ExcelAlRow, MolNode } from "@/lib/situacion-financiera/types";
import { explicarAlerta } from "@/lib/situacion-financiera/alerta-inconsistencia";
import { MolAccordionPanel } from "./MolAccordion";
import { SitFinComparacionPanel } from "./SitFinComparacionPanel";
import {
  fmtCmpPct,
  fmtCmpUsd,
  lookupCmpUsd,
} from "@/lib/situacion-financiera/cmp-usd-lookup";

type MapaFila = {
  molKey: string | null;
  origen: string;
  estado: string;
  excelGs: number | null;
  txtGs: number | null;
  canonGs: number | null;
  delta: number | null;
  archivo: string | null;
  label?: string | null;
  archivoExcel?: string | null;
  archivoTxt?: string | null;
};

const MAPA = (mapaCanon as { porFila: Record<string, MapaFila> }).porFila;

/** Verde Guido = TXT · naranja = manual · lila = pendiente · amarillo = calc */
const RESPALDO_BG: Record<SfRespaldoOrigen, string> = {
  txt: "bg-[#C6EFCE]",
  manual: "bg-[#FCE4D6]",
  pendiente: "bg-[#E2D5F1]",
  calc: "bg-[#FFFF00]",
};

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function mesLabel(mes: string | null | undefined): string {
  if (!mes) return "";
  const [y, m] = mes.split("-");
  const nombres = [
    "",
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const mi = Number(m);
  return `${nombres[mi] || m}-${y?.slice(2) || ""}`;
}

function rowClass(
  row: ExcelAlRow,
  origen: SfRespaldoOrigen | null
): string {
  switch (row.kind) {
    case "total_yellow":
      return `${RESPALDO_BG.calc} font-bold`;
    case "total_green":
      return "bg-[#C6EFCE] font-bold";
    case "total_gray":
      return "bg-[#D9D9D9] font-bold";
    case "section":
    case "subheader":
      return "bg-[#1F4E79] text-white font-bold";
    case "reserva":
      return "bg-[#FFF2CC] font-semibold";
    case "tasa":
      return "bg-[#DDEBF7] font-bold";
    case "prevision":
      return "bg-[#F2F2F2] font-semibold";
    default: {
      const base = origen ? RESPALDO_BG[origen] : "";
      return `${base} ${row.bold ? "font-semibold" : ""}`.trim();
    }
  }
}

function buildDisponibleFallback(
  rows: ExcelAlRow[],
  mesYm: string
): MolNode {
  // Filas del bloque hasta el SALDO DISPONIBLE de ese mes
  const children: MolNode[] = [];
  let mes: string | null = mesYm === "2026-08" ? "2026-08" : null;
  let collecting = mesYm === "2026-08";

  for (const row of rows) {
    if (row.mes) {
      mes = row.mes;
      collecting = mes === mesYm;
    }
    if (!collecting) continue;
    if (row.kind === "total_yellow") {
      const label = (row.label || "").toUpperCase();
      if (label.includes("SALDO DISPONIBLE")) break;
    }
    if (row.kind !== "row") continue;
    if (row.gs == null && row.usd == null) continue;
    children.push({
      id: `disp-${mesYm}-${row.r}`,
      label: row.label || `fila ${row.r}`,
      gs: row.gs,
      usd: row.usd,
      meta: "composición del mes (Excel)",
    });
  }
  return {
    id: `disponible-${mesYm}`,
    label: `Saldo disponible ${mesYm}`,
    fuente: "Suma conceptual filas del bloque Excel",
    meta: `${children.length} líneas del mes`,
    children,
  };
}

type Annotated = {
  row: ExcelAlRow;
  mesCtx: string | null;
  molKey: string | null;
};

function BadgeAlerta({
  badge,
  mapa,
  open,
  onToggle,
}: {
  badge: "Δ" | "TXT";
  mapa: MapaFila;
  open: boolean;
  onToggle: () => void;
}) {
  const ex = explicarAlerta(badge, mapa);
  const esDescuadre = badge === "Δ";

  return (
    <span className="relative ml-1 inline-block align-middle">
      <button
        type="button"
        className={`rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ${
          esDescuadre
            ? "bg-red-200 text-red-900 hover:bg-red-300"
            : "bg-emerald-200 text-emerald-900 hover:bg-emerald-300"
        }`}
        aria-label={ex.titulo}
        title="Clic → ver archivos y montos"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {esDescuadre ? "⚠ Δ" : "TXT"}
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute left-0 top-full z-40 mt-1.5 w-[22rem] max-w-[min(22rem,92vw)] rounded-lg border-2 border-slate-500 bg-white p-3 text-left text-[12px] font-normal normal-case leading-snug text-slate-900 shadow-xl sm:w-[26rem] sm:max-w-[26rem]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block text-[14px] font-bold text-[#1F4E79]">
            {ex.titulo}
          </span>
          <span className="mt-2 block text-[12px]">{ex.quePaso}</span>

          <span className="mt-3 block rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              Archivo Excel (número de la celda)
            </span>
            <span className="mt-0.5 block break-all font-mono text-[13px] font-semibold text-amber-950">
              {ex.archivoExcel}
            </span>
            <span className="mt-1 block tabular-nums text-[12px]">
              Monto Excel: <strong>{ex.montoExcel}</strong>
            </span>
          </span>

          <span className="mt-2 block rounded border border-emerald-400 bg-emerald-50 px-2 py-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
              Archivo TXT limpio (respaldo)
            </span>
            <span className="mt-0.5 block break-all font-mono text-[13px] font-semibold text-emerald-950">
              {ex.archivoTxt}
            </span>
            <span className="mt-1 block tabular-nums text-[12px]">
              Monto TXT: <strong>{ex.montoTxt}</strong>
            </span>
          </span>

          <span className="mt-2 block space-y-0.5 text-[12px]">
            {esDescuadre ? (
              <span className="block">
                Diferencia (Δ): <strong className="text-red-800">{ex.delta}</strong>
              </span>
            ) : null}
            <span className="block">
              Lo que muestra Sit Fin:{" "}
              <strong className="text-emerald-900">{ex.canon}</strong>
            </span>
          </span>

          <span className="mt-2 block rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-[12px] text-sky-950">
            <strong>Qué hacer:</strong> {ex.queHacer}
          </span>

          <button
            type="button"
            className="mt-2.5 text-[12px] font-semibold text-sky-800 underline"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            Cerrar
          </button>
        </span>
      ) : null}
    </span>
  );
}

export function SitFinExcelAlTab() {
  const snap = EXCEL_AL_0308;
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const [openBadge, setOpenBadge] = useState<number | null>(null);
  const [compararActivo, setCompararActivo] = useState(false);
  /** Totales TXT por clave molecular — solo ▸ si hay Gs reales en TXT */
  const [molTotals, setMolTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/situacion-financiera/molecular", {
          cache: "no-store",
        });
        const json = await res.json();
        if (alive && json.ok && json.totals) setMolTotals(json.totals);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const annotated = useMemo(() => {
    let mesCtx: string | null = null;
    const out: Annotated[] = [];
    for (const row of snap.rows) {
      mesCtx = inferMesContext(row, mesCtx);
      // primer bloque sin mescol = agosto
      if (!mesCtx && row.kind === "row") mesCtx = "2026-08";
      const molKey = molKeyForExcelRow(row, mesCtx);
      out.push({ row, mesCtx, molKey });
    }
    return out;
  }, [snap.rows]);

  function toggle(key: string) {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const tasa = snap.tasaUsd || 5970.96;
  const colSpan = compararActivo ? 7 : 4;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-600">
        Réplica <strong>SIT FIN</strong> ·{" "}
        <code className="rounded bg-slate-100 px-1">{snap.titulo}.xlsx</code> ·
        AL {snap.fechaAl.split("-").reverse().join("/")}.{" "}
        <strong>Módulo isla</strong> (faro 2.3.1.50.12): solo intake propio +
        tablas maestras; <em>no</em> resultados Nexus. Filas con{" "}
        <span className="font-semibold text-sky-800">▸</span>: TXT limpio con
        Gs.
      </p>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded border border-emerald-400 bg-[#C6EFCE] px-2 py-0.5">
          Verde · respaldo TXT limpio
        </span>
        <span className="rounded border border-orange-400 bg-[#FCE4D6] px-2 py-0.5">
          Naranja · carga manual (Excel)
        </span>
        <span className="rounded border border-violet-400 bg-[#E2D5F1] px-2 py-0.5">
          Lila · pendiente (cuadro Guido)
        </span>
        <span className="rounded border border-amber-400 bg-[#FFFF00] px-2 py-0.5">
          Amarillo · calculado (saldo disponible)
        </span>
      </div>

      <SitFinComparacionPanel
        activo={compararActivo}
        onToggle={() => setCompararActivo((v) => !v)}
      />

      <div className="overflow-x-auto rounded border border-slate-400 bg-white shadow-sm">
        <table
          className={`w-full border-collapse text-[12px] leading-tight ${
            compararActivo ? "min-w-[980px]" : "min-w-[720px]"
          }`}
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <thead>
            <tr className="bg-[#1F4E79] text-white">
              <th className="border border-slate-500 px-2 py-1.5 text-left w-20">
                Mes
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Concepto
              </th>
              {compararActivo ? (
                <>
                  <th
                    className="border border-amber-600 bg-amber-800 px-2 py-1.5 text-right w-28"
                    title="USD Julio · tasa 6085 · archivo admin Jul"
                  >
                    Julio USD
                  </th>
                  <th
                    className="border border-emerald-700 bg-emerald-900 px-2 py-1.5 text-right w-28"
                    title="USD Agosto · Sit Fin isla"
                  >
                    Agosto USD
                  </th>
                  <th
                    className="border border-violet-700 bg-violet-900 px-2 py-1.5 text-right w-24"
                    title="% variación (Ago − Jul) / |Jul|"
                  >
                    % var.
                  </th>
                </>
              ) : null}
              <th className="border border-slate-500 px-2 py-1.5 text-right w-40">
                Importe Gs
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-right w-36">
                USD
              </th>
            </tr>
          </thead>
          <tbody>
            {annotated.map(({ row, molKey, mesCtx }) => {
              if (row.kind === "spacer") {
                return (
                  <tr key={`sp-${row.r}`} className="h-2">
                    <td
                      colSpan={colSpan}
                      className="border border-slate-200 bg-white"
                    />
                  </tr>
                );
              }
              const origen = origenRespaldo(molKey);
              const mapa = MAPA[String(row.r)];
              const molGs =
                mapa?.txtGs ??
                (molKey && molTotals[molKey] != null
                  ? molTotals[molKey]
                  : null);
              const keyEfectiva = mapa?.molKey || molKey;
              /** TXT con plata → ▸; manual/calc/pendiente si hay clave */
              const trackable = !!keyEfectiva && (
                origen === "manual" ||
                origen === "calc" ||
                origen === "pendiente" ||
                (keyEfectiva.startsWith("dificil:") &&
                  (mapa?.canonGs != null || row.gs != null)) ||
                (origen === "txt" && molGs != null && molGs !== 0) ||
                (mapa?.estado === "excel_cero_txt_tiene" &&
                  molGs != null &&
                  molGs !== 0) ||
                (mapa?.estado === "descuadre" &&
                  molGs != null &&
                  molGs !== 0)
              );
              const paintOrigen: SfRespaldoOrigen | null =
                origen === "txt" || mapa?.estado === "excel_cero_txt_tiene"
                  ? trackable
                    ? "txt"
                    : null
                  : origen;
              const cls = rowClass(row, paintOrigen);
              const isHeader =
                row.kind === "section" || row.kind === "subheader";
              const open =
                trackable && keyEfectiva
                  ? !!openKeys[`${row.r}:${keyEfectiva}`]
                  : false;
              const rowOpenKey = keyEfectiva
                ? `${row.r}:${keyEfectiva}`
                : "";
              /** Canon auditoría: TXT manda en cheques/aging; si no, Excel */
              const showGs =
                mapa?.canonGs != null
                  ? mapa.canonGs
                  : origen === "txt" &&
                      molGs != null &&
                      (row.gs == null || row.gs === 0)
                    ? molGs
                    : row.gs;
              const showUsd =
                showGs != null && showGs !== row.gs
                  ? showGs / tasa
                  : row.usd;
              const badge =
                mapa?.estado === "descuadre"
                  ? "Δ"
                  : mapa?.estado === "excel_cero_txt_tiene"
                    ? "TXT"
                    : null;
              const disponFallback = keyEfectiva?.startsWith("disponible:")
                ? buildDisponibleFallback(
                    snap.rows,
                    keyEfectiva.slice("disponible:".length)
                  )
                : keyEfectiva
                  ? ({
                      id: `row-${row.r}`,
                      label: row.label || `fila ${row.r}`,
                      gs: showGs,
                      usd: showUsd,
                      meta: mapa
                        ? `estado=${mapa.estado} · excel=${mapa.excelGs} · txt=${mapa.txtGs}`
                        : `mes ctx ${mesCtx || "-"}`,
                      fuente: mapa?.archivo || "Excel AL",
                      children: [
                        {
                          id: `row-${row.r}-leaf`,
                          label: "Canon / fila",
                          gs: showGs,
                          usd: showUsd,
                        },
                      ],
                    } as MolNode)
                  : null;

              const cmp = compararActivo
                ? lookupCmpUsd({
                    molKey: keyEfectiva,
                    label: row.label,
                    mesCtx,
                  })
                : null;
              const pct =
                cmp?.pct_usd_sitfin_vs_jul ?? cmp?.pct_nexus_vs_jul ?? null;
              const pctCls =
                pct == null
                  ? ""
                  : pct > 0
                    ? "text-emerald-800 font-semibold"
                    : pct < 0
                      ? "text-red-800 font-semibold"
                      : "text-slate-800";

              return (
                <Fragment key={row.r}>
                  <tr
                    className={`${cls} ${
                      trackable
                        ? "cursor-pointer hover:ring-1 hover:ring-sky-400/60"
                        : ""
                    }`}
                    onClick={() =>
                      trackable && keyEfectiva && toggle(rowOpenKey)
                    }
                    title={
                      trackable
                        ? mapa?.estado === "descuadre"
                          ? `Descuadre Excel vs TXT · Δ ${mapa.delta ?? ""} · canon=TXT`
                          : "Clic para ver composición molecular"
                        : undefined
                    }
                  >
                    <td className="border border-slate-400 px-2 py-0.5 whitespace-nowrap">
                      {mesLabel(row.mes)}
                    </td>
                    <td
                      className={`border border-slate-400 px-2 py-0.5 ${
                        isHeader ? "uppercase tracking-wide" : ""
                      }`}
                    >
                      {trackable ? (
                        <span className="mr-1 inline-block w-3 font-mono text-sky-700">
                          {open ? "▾" : "▸"}
                        </span>
                      ) : (
                        <span className="mr-1 inline-block w-3" />
                      )}
                      {row.label || (isHeader ? "SALDOS" : "")}
                      {badge && mapa ? (
                        <BadgeAlerta
                          badge={badge}
                          mapa={{
                            ...mapa,
                            label: mapa.label || row.label || null,
                          }}
                          open={openBadge === row.r}
                          onToggle={() =>
                            setOpenBadge((prev) =>
                              prev === row.r ? null : row.r
                            )
                          }
                        />
                      ) : null}
                    </td>
                    {compararActivo ? (
                      <>
                        <td className="border border-amber-300 bg-amber-50/90 px-2 py-0.5 text-right tabular-nums text-[11px]">
                          {isHeader || row.kind === "tasa" || row.kind === "prevision"
                            ? ""
                            : fmtCmpUsd(cmp?.julio_base_usd)}
                        </td>
                        <td className="border border-emerald-300 bg-emerald-50/80 px-2 py-0.5 text-right tabular-nums text-[11px]">
                          {isHeader || row.kind === "tasa" || row.kind === "prevision"
                            ? ""
                            : fmtCmpUsd(cmp?.agosto_sitfin_usd)}
                        </td>
                        <td
                          className={`border border-violet-300 bg-violet-50/70 px-2 py-0.5 text-right tabular-nums text-[11px] ${pctCls}`}
                        >
                          {isHeader || row.kind === "tasa" || row.kind === "prevision"
                            ? ""
                            : fmtCmpPct(pct)}
                        </td>
                      </>
                    ) : null}
                    <td
                      className={`border border-slate-400 px-2 py-0.5 text-right tabular-nums ${
                        (showGs ?? 0) < 0 ? "text-red-700" : ""
                      }`}
                      title={
                        showGs != null && showGs !== row.gs
                          ? "Σ desde TXT limpio (Excel tenía 0/vacío)"
                          : undefined
                      }
                    >
                      {row.kind === "tasa"
                        ? fmtUsd(row.gs)
                        : row.kind === "prevision"
                          ? ""
                          : fmtGs(showGs)}
                    </td>
                    <td
                      className={`border border-slate-400 px-2 py-0.5 text-right tabular-nums ${
                        (showUsd ?? 0) < 0 ? "text-red-700" : ""
                      }`}
                    >
                      {row.kind === "tasa" || row.kind === "prevision"
                        ? ""
                        : fmtUsd(showUsd)}
                    </td>
                  </tr>
                  {open && keyEfectiva ? (
                    <tr>
                      <MolAccordionPanel
                        molKey={keyEfectiva}
                        fallback={disponFallback}
                        colSpan={colSpan}
                      />
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
