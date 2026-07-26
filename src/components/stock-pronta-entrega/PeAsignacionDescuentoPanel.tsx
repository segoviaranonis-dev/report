"use client";

type Props = {
  moleculas: number;
  pct: string;
  onPctChange: (v: string) => void;
  onAsignar: () => void;
  onSalir: () => void;
  busy?: boolean;
  err?: string | null;
  okMsg?: string | null;
};

/** Panel mínimo · sin colores casino · modo Asignación de descuentos. */
export function PeAsignacionDescuentoPanel({
  moleculas,
  pct,
  onPctChange,
  onAsignar,
  onSalir,
  busy = false,
  err = null,
  okMsg = null,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Asignación de descuentos
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Filtrá el universo · luego asigná % a todas las moléculas visibles.
          </p>
          <p className="mt-2 text-sm tabular-nums text-slate-900">
            <span className="font-semibold">{moleculas.toLocaleString("es-PY")}</span>{" "}
            moléculas en filtro
          </p>
        </div>
        <button
          type="button"
          onClick={onSalir}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Salir del modo
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Descuento %
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={pct}
            onChange={(e) => onPctChange(e.target.value)}
            placeholder="ej. 7.5"
            disabled={busy || moleculas === 0}
            className="w-28 rounded border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || moleculas === 0 || !pct.trim()}
          onClick={onAsignar}
          className="rounded border border-slate-800 bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Asignando…" : "Asignar"}
        </button>
      </div>

      {err ? <p className="mt-2 text-xs font-semibold text-red-700">{err}</p> : null}
      {okMsg ? <p className="mt-2 text-xs font-semibold text-slate-700">{okMsg}</p> : null}
      <p className="mt-3 text-[10px] text-slate-500">
        v1 local · persistencia en sesión · sync RIMEC Web en siguiente iteración
      </p>
    </div>
  );
}
