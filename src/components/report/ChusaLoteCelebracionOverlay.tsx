"use client";

type Props = {
  open: boolean;
  total: number;
  ppLabel: string;
  onVerFi: () => void;
};

/** Celebración al cerrar lote Chusa — importación programado completada. */
export function ChusaLoteCelebracionOverlay({ open, total, ppLabel, onVerFi }: Props) {
  if (!open) return null;

  const confetti = Array.from({ length: 48 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-emerald-950/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chusa-celebracion-title"
    >
      <div className="relative mx-4 max-w-lg overflow-hidden rounded-2xl border-4 border-emerald-400 bg-gradient-to-b from-emerald-50 to-white px-8 py-10 text-center shadow-2xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {confetti.map((i) => (
            <span
              key={i}
              className="chusa-confetti-piece absolute block h-2 w-2 rounded-sm opacity-90"
              style={{
                left: `${(i * 23) % 100}%`,
                top: "-8%",
                backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899"][i % 6],
                animationDelay: `${(i % 12) * 0.07}s`,
              }}
            />
          ))}
        </div>
        <p className="chusa-celebracion-bounce text-5xl" aria-hidden>
          🎉
        </p>
        <h2
          id="chusa-celebracion-title"
          className="mt-2 font-serif text-2xl font-bold text-emerald-900"
        >
          ¡Importación completada!
        </h2>
        <p className="mt-3 text-sm font-semibold text-emerald-800">
          {total} factura{total === 1 ? "" : "s"} interna{total === 1 ? "" : "s"} · {ppLabel}
        </p>
        <p className="mt-1 text-xs text-slate-600">IC = Proforma = FI · Protocolo Chusa cerrado</p>
        <button
          type="button"
          onClick={onVerFi}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-emerald-700 hover:shadow-xl"
        >
          Ver facturas internas →
        </button>
      </div>
    </div>
  );
}
