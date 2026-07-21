"use client";

import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import { LISTADO_PRECIO_TIERS } from "@/lib/intencion-compra/listado-precio-tiers";
import type { CanonDiffCelda } from "@/lib/pedido-proveedor/administrador-ic-monto";
import { tieneDesajusteCanon } from "@/lib/pedido-proveedor/administrador-ic-monto";

/** Grilla Admin IC/PF — Cliente · Ref · Marca · Cant · D1-4 · Monto · LP · ▸ · Acc */
export const ADMIN_IC_GRID =
  "grid-cols-[2.75rem_minmax(4.25rem,1.1fr)_minmax(3.5rem,1fr)_3.25rem_minmax(11.5rem,1.7fr)_minmax(5.25rem,1.1fr)_3.5rem_1.35rem_2rem]";

export const ADMIN_IC_ROW_MIN_W = "min-w-[46rem]";

const CANON_ERR =
  "rounded bg-red-200 font-bold text-red-950 ring-2 ring-red-500 shadow-sm";

function clsCanon(ok: boolean | undefined) {
  return ok ? CANON_ERR : "";
}

function fmtMonto(n: number) {
  return n.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export type IcInlineEdit = {
  icId: number;
  pares: number;
  monto: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  busy: boolean;
  onParesBlur: (pares: number) => void;
  onMontoBlur: (monto: number) => void;
  onDescBlur: (d1: number, d2: number, d3: number, d4: number) => void;
  onDelete: () => void;
};

type Props = {
  tone: "ic" | "pf";
  codCliente: number | string;
  colRef: string;
  marca: string;
  lp: string;
  monto: number;
  montoSecundario?: number | null;
  pares: number;
  descLabel?: string;
  canonDiff?: CanonDiffCelda | null;
  canonHint?: { cliente?: string | number; marca?: string; cantidad?: number };
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandable?: boolean;
  lpEditable?: boolean;
  lpLocked?: boolean;
  lpValue?: ListadoPrecioTierId;
  onLpChange?: (tier: ListadoPrecioTierId) => void;
  icEdit?: IcInlineEdit;
  onSplitPf?: () => void;
  pfEsHija?: boolean;
};

function parsePct(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function PpAdminIcCabeceraFila(props: Props) {
  const {
    tone,
    codCliente,
    colRef,
    marca,
    lp,
    monto,
    montoSecundario,
    pares,
    descLabel,
    canonDiff,
    canonHint,
    expanded,
    onToggleExpand,
    expandable,
    lpEditable,
    lpLocked,
    lpValue,
    onLpChange,
    icEdit,
    onSplitPf,
    pfEsHija,
  } = props;

  const bg =
    tone === "ic"
      ? canonDiff && tieneDesajusteCanon(canonDiff)
        ? "border-red-400 bg-red-50/80"
        : "border-slate-300 bg-slate-100"
      : pfEsHija
        ? "border-emerald-500 bg-emerald-50/90"
        : canonDiff && tieneDesajusteCanon(canonDiff)
          ? "border-red-400 bg-red-50/80"
          : "border-orange-300 bg-orange-50";

  const cantInputCls =
    "w-full min-w-0 rounded-md border-2 border-sky-500 bg-sky-50 px-1.5 py-1 text-[10px] font-bold tabular-nums text-center text-sky-950 sm:text-[11px]";
  const descInputCls =
    "min-w-[2.35rem] w-full rounded-md border-2 border-amber-400 bg-amber-50 px-1 py-1 text-[10px] font-bold tabular-nums text-center text-amber-950 sm:min-w-[2.5rem] sm:text-[11px]";
  const montoInputCls =
    "w-full min-w-0 rounded-md border-2 border-emerald-500 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold tabular-nums text-right text-emerald-950 sm:text-[11px]";

  return (
    <div
      className={`grid min-h-[2.75rem] w-full ${ADMIN_IC_ROW_MIN_W} ${ADMIN_IC_GRID} items-center gap-x-1.5 gap-y-0.5 border px-2 py-1.5 text-[10px] leading-snug sm:min-h-[3rem] sm:text-[11px] ${bg}`}
    >
      <span
        className={`truncate font-mono font-bold ${clsCanon(canonDiff?.sinPar || canonDiff?.cliente)}`}
      >
        {codCliente}
      </span>
      <span className="truncate text-[9px] font-semibold text-slate-700 sm:text-[10px]" title={colRef}>
        {colRef}
      </span>
      <span
        className={`truncate font-semibold ${clsCanon(canonDiff?.sinPar || canonDiff?.marca)}`}
        title={marca}
      >
        {marca}
      </span>

      {icEdit ? (
        <input
          type="number"
          min={1}
          className={`${cantInputCls} ${clsCanon(canonDiff?.cantidad)}`}
          defaultValue={icEdit.pares}
          disabled={icEdit.busy}
          title="Cantidad · pares"
          onBlur={(e) => {
            const n = Math.max(1, Math.round(Number(e.target.value) || 0));
            if (n !== icEdit.pares) icEdit.onParesBlur(n);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`block truncate rounded-md border-2 border-sky-200 bg-sky-50/90 px-1 py-0.5 text-right tabular-nums font-bold text-sky-950 ${clsCanon(canonDiff?.sinPar || canonDiff?.cantidad)}`}
        >
          {pares}
        </span>
      )}

      {icEdit ? (
        <div
          className="grid w-full min-w-[11.5rem] grid-cols-4 gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {[icEdit.d1, icEdit.d2, icEdit.d3, icEdit.d4].map((d, idx) => (
            <input
              key={idx}
              type="number"
              min={0}
              max={100}
              step={0.01}
              className={descInputCls}
              defaultValue={d > 0 ? d : ""}
              placeholder={`D${idx + 1}`}
              disabled={icEdit.busy}
              title={`Descuento ${idx + 1} %`}
              onBlur={(e) => {
                const vals = [icEdit.d1, icEdit.d2, icEdit.d3, icEdit.d4];
                vals[idx] = parsePct(e.target.value);
                icEdit.onDescBlur(vals[0], vals[1], vals[2], vals[3]);
              }}
            />
          ))}
        </div>
      ) : (
        <span className="rounded-md border border-amber-200 bg-amber-50/80 px-1 py-0.5 text-center text-[9px] font-bold tabular-nums leading-snug text-amber-950 sm:text-[10px]">
          {descLabel && descLabel !== "—" ? descLabel : "—"}
        </span>
      )}

      {icEdit ? (
        <input
          type="number"
          min={0}
          step={1}
          className={montoInputCls}
          defaultValue={icEdit.monto}
          disabled={icEdit.busy}
          title="Monto bruto IC (Gs.)"
          onBlur={(e) => {
            const n = Math.max(0, Math.round(Number(e.target.value) || 0));
            if (n !== icEdit.monto) icEdit.onMontoBlur(n);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="min-w-0 truncate text-right tabular-nums">
          <span className="block font-bold leading-tight">{fmtMonto(monto)}</span>
          {montoSecundario != null && montoSecundario !== monto ? (
            <span className="block text-[8px] font-semibold text-slate-500" title="Referencia proforma">
              PF {fmtMonto(montoSecundario)}
            </span>
          ) : null}
        </span>
      )}

      {lpEditable && lpValue != null && onLpChange && !lpLocked ? (
        <select
          className="w-full truncate rounded-md border-2 border-indigo-500 bg-indigo-50 px-1 py-1.5 text-[10px] font-bold text-indigo-950 sm:text-[11px]"
          value={lpValue}
          title={LISTADO_PRECIO_TIERS.find((t) => t.id === lpValue)?.hint ?? "Listado de precio"}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onLpChange(Number(e.target.value) as ListadoPrecioTierId)}
        >
          {LISTADO_PRECIO_TIERS.map((t) => (
            <option key={t.id} value={t.id} title={t.hint}>
              {t.codigo}
            </option>
          ))}
        </select>
      ) : (
        <span
          className={`inline-block truncate rounded-md border px-1 py-1 text-[10px] font-bold sm:text-[11px] ${
            lpLocked
              ? "border-emerald-500 bg-emerald-100 text-emerald-900"
              : "border-indigo-300 bg-indigo-50 text-indigo-900"
          }`}
          title={lp}
        >
          {lpLocked ? "🔒 " : ""}
          {lp}
        </span>
      )}

      {expandable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="rounded px-1 text-xs font-bold text-orange-900 hover:bg-orange-200"
        >
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4" />
      )}

      <div className="flex justify-end">
        {icEdit ? (
          <button
            type="button"
            disabled={icEdit.busy}
            title="Devolver IC a Digitación"
            className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
            onClick={(e) => {
              e.stopPropagation();
              icEdit.onDelete();
            }}
          >
            ✕
          </button>
        ) : onSplitPf ? (
          <button
            type="button"
            title="Separar artículos a nueva prefactura (+ IC cabecera)"
            className="rounded bg-violet-700 px-1 py-0.5 text-[8px] font-bold text-white hover:bg-violet-800"
            onClick={(e) => {
              e.stopPropagation();
              onSplitPf();
            }}
          >
            ÷
          </button>
        ) : (
          <span className="w-4" />
        )}
      </div>
    </div>
  );
}
