import type { ColumnaStockRetail, ImportadoraBloque, TiendaTallaBloque } from "@/lib/retail/types";
import { RetailProductImage } from "./RetailProductImage";

function fmt(n: number | null) {
  if (n === null || n === 0) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

function TablaTienda({ bloque }: { bloque: TiendaTallaBloque }) {
  const { nombre, tallas, venta, stock } = bloque;
  return (
    <table className="w-full border-collapse text-center text-[11px] text-report-ink">
      <thead>
        <tr className="border border-report-rule bg-report-paper2/60">
          <th className="border border-report-rule px-1 py-1.5 font-normal" />
          <th className="border border-report-rule px-1 py-1.5 font-normal" />
          {tallas.map((t) => (
            <th
              key={t}
              className="border border-report-rule px-1 py-1.5 font-medium tabular-nums text-report-navy"
            >
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th
            rowSpan={2}
            className="border border-report-rule bg-report-paper2/70 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-report-muted"
          >
            {nombre}
          </th>
          <td className="border border-report-rule bg-report-paper2/40 px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-report-muted">
            Venta
          </td>
          {tallas.map((_, i) => (
            <td key={`v-${i}`} className="border border-report-rule px-1 py-1 tabular-nums text-report-ink">
              {fmt(venta[i] ?? null)}
            </td>
          ))}
        </tr>
        <tr>
          <td className="border border-report-rule bg-report-paper2/40 px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-report-muted">
            Stock
          </td>
          {tallas.map((_, i) => (
            <td
              key={`s-${i}`}
              className="border border-report-rule px-1 py-1 tabular-nums font-medium text-report-navy"
            >
              {fmt(stock[i] ?? 0)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function TablaImportadora({ bloque }: { bloque: ImportadoraBloque }) {
  return (
    <table className="w-full border-collapse text-center text-[11px] text-report-ink">
      <thead>
        <tr className="border border-report-rule bg-report-paper2/60">
          <th className="border border-report-rule px-1 py-1.5 font-normal" />
          <th
            colSpan={1}
            className="border border-report-rule px-2 py-1.5 font-mono text-[10px] font-medium leading-snug text-report-ink"
          >
            {bloque.etiquetaGrada}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th className="border border-report-rule bg-report-paper2/70 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-report-muted">
            RIMEC
          </th>
          <td className="border border-report-rule px-2 py-2">
            <span className="text-[10px] uppercase tracking-wider text-report-muted">Stock</span>
            <span className="ml-2 font-serif text-lg tabular-nums font-bold text-report-navy">
              {fmt(bloque.stockTotal)}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ColumnaProducto({ col }: { col: ColumnaStockRetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-report-rule bg-white p-3 shadow-sm">
        <RetailProductImage
          alt={col.etiqueta}
          candidates={col.imageCandidates ?? (col.imageSrc ? [col.imageSrc] : [])}
          placeholderClass={col.imagenClass}
          searchFileName={col.imageSearchName}
        />
      </div>
      <p className="text-center font-mono text-[11px] leading-snug text-report-ink">{col.etiqueta}</p>
      <div className="flex flex-col gap-3">
        {col.tiendas.map((t) => (
          <TablaTienda key={`${col.id}-${t.nombre}`} bloque={t} />
        ))}
        <TablaImportadora bloque={col.importadora} />
      </div>
    </div>
  );
}

type Props = {
  columnas: ColumnaStockRetail[];
};

export function RetailStockBoard({ columnas }: Props) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-3 lg:gap-8">
      {columnas.length === 0 ? (
        <p className="col-span-full py-12 text-center text-sm text-report-muted">
          Sin columnas para mostrar. Importá un lote en Streamlit o elegí otro batch.
        </p>
      ) : (
        columnas.map((col) => <ColumnaProducto key={col.id} col={col} />)
      )}
    </div>
  );
}
