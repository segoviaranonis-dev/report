"use client";

type Props = {
  moleculas: number;
  areaCargada: boolean;
  pct: string;
  onPctChange: (v: string) => void;
  onAsignar: () => void;
  onSalir: () => void;
  onVaciarArea?: () => void;
  busy?: boolean;
  err?: string | null;
  okMsg?: string | null;
};

/** Panel · área de trabajo PE (usuario carga con filtros · luego asigna %). */
export function PeAsignacionDescuentoPanel({
  moleculas,
  areaCargada,
  pct,
  onPctChange,
  onAsignar,
  onSalir,
  onVaciarArea,
  busy = false,
  err = null,
  okMsg = null,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Área de trabajo · descuentos PE
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Al activar queda vacía. Vos cargás el grupo con filtros · ahí aplicás el %.
          </p>
          <p className="mt-2 text-sm tabular-nums text-slate-900">
            {areaCargada ? (
              <>
                <span className="font-semibold">{moleculas.toLocaleString("es-PY")}</span>{" "}
                moléculas en el área
              </>
            ) : (
              <span className="font-semibold text-slate-500">Área vacía</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {areaCargada && onVaciarArea ? (
            <button
              type="button"
              onClick={onVaciarArea}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Vaciar área
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSalir}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Salir del modo
          </button>
        </div>
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
            disabled={busy || !areaCargada || moleculas === 0}
            className="w-28 rounded border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy || !areaCargada || moleculas === 0 || !pct.trim()}
          onClick={onAsignar}
          className="rounded border border-slate-800 bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Asignando…" : "Asignar al área"}
        </button>
      </div>

      {err ? <p className="mt-2 text-xs font-semibold text-red-700">{err}</p> : null}
      {okMsg ? <p className="mt-2 text-xs font-semibold text-slate-700">{okMsg}</p> : null}
      <p className="mt-3 text-[10px] text-slate-500">
        PE solamente · CP usará la misma idea desde otro módulo · sync Web pendiente
      </p>
    </div>
  );
}
