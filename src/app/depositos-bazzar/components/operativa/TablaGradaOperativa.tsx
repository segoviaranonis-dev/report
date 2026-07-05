"use client";

function fmt(n: number | null) {
  if (n === null || n === 0) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

type Props = {
  tienda: string;
  estilo: string;
  tallas: string[];
  stock: number[];
};

export function TablaGradaOperativa({ tienda, estilo, tallas, stock }: Props) {
  if (tallas.length === 0) return null;

  const stockTotal = stock.reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
      <div className="min-w-max">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/60 px-2 py-1.5">
        <span className="rounded-full bg-bazzar-naranja px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
          {tienda}
        </span>
        <span className="shrink-0 text-[9px] font-bold tabular-nums text-slate-500">
          {fmt(stockTotal)} st · {tallas.length} t
        </span>
      </div>
      <table className="w-full min-w-max border-collapse text-center text-[10px] text-slate-800">
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-slate-200 px-1 py-1 font-medium text-slate-500" />
            {tallas.map((t) => (
              <th
                key={t}
                className="border-b border-slate-200 px-1 py-1 font-semibold tabular-nums text-slate-700"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="bg-slate-50 px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Stock
            </td>
            {tallas.map((t, i) => (
              <td key={t} className="px-1 py-1 tabular-nums font-semibold text-bazzar-naranja-dark">
                {fmt(stock[i] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {estilo ? (
        <p className="border-t border-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {estilo}
        </p>
      ) : null}
      </div>
    </div>
  );
}
