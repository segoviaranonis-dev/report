import type { FacturaLineaLegacy } from "@/lib/bazzar-web/compra-web/types";

export function Tabla5PilaresLegacy({ lineas }: { lineas: FacturaLineaLegacy[] }) {
  if (!lineas.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">Línea</th>
            <th className="px-3 py-2">Ref.</th>
            <th className="px-3 py-2">Material</th>
            <th className="px-3 py-2">Color</th>
            <th className="px-3 py-2">Grada</th>
            <th className="px-3 py-2 text-right">Pares</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((row, i) => (
            <tr key={`${row.linea}-${row.referencia}-${i}`} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.linea}</td>
              <td className="px-3 py-2">{row.referencia}</td>
              <td className="px-3 py-2">{row.material}</td>
              <td className="px-3 py-2">{row.color}</td>
              <td className="px-3 py-2">{row.grada || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.pares}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
