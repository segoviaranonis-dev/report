import type { ColumnaStockRetail, ImportadoraBloque, TiendaTallaBloque } from "@/lib/retail/types";
import { RetailProductImage } from "./RetailProductImage";

function fmt(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

function TablaTienda({ bloque }: { bloque: TiendaTallaBloque }) {
  const { nombre, tallas, venta, stock } = bloque;
  return (
    <table className="w-full border-collapse text-center text-[11px] text-white/85">
      <thead>
        <tr className="border border-white/20 bg-white/[0.04]">
          <th className="border border-white/15 px-1 py-1.5 font-normal text-white/40" />
          <th className="border border-white/15 px-1 py-1.5 font-normal text-white/40" />
          {tallas.map((t) => (
            <th key={t} className="border border-white/15 px-1 py-1.5 font-medium tabular-nums text-white/90">
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th
            rowSpan={2}
            className="border border-white/15 bg-white/[0.03] px-2 py-2 text-left text-[10px] font-normal uppercase tracking-wide text-white/55"
          >
            {nombre}
          </th>
          <td className="border border-white/15 bg-white/[0.02] px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/50">
            Venta
          </td>
          {tallas.map((_, i) => (
            <td key={`v-${i}`} className="border border-white/15 px-1 py-1 tabular-nums">
              {fmt(venta[i] ?? null)}
            </td>
          ))}
        </tr>
        <tr>
          <td className="border border-white/15 bg-white/[0.02] px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/50">
            Stock
          </td>
          {tallas.map((_, i) => (
            <td key={`s-${i}`} className="border border-white/15 px-1 py-1 tabular-nums text-white">
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
    <table className="w-full border-collapse text-center text-[11px] text-white/85">
      <thead>
        <tr className="border border-white/20 bg-white/[0.04]">
          <th className="border border-white/15 px-1 py-1.5 font-normal text-white/50" />
          <th
            colSpan={1}
            className="border border-white/15 px-2 py-1.5 font-mono text-[10px] font-normal leading-snug text-white/80"
          >
            {bloque.etiquetaGrada}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th className="border border-white/15 bg-white/[0.03] px-2 py-2 text-left text-[10px] font-normal uppercase tracking-wide text-white/55">
            Importadora
          </th>
          <td className="border border-white/15 px-2 py-2">
            <span className="text-[10px] uppercase tracking-wider text-white/45">Stock</span>
            <span className="ml-2 font-serif text-lg tabular-nums text-white">{fmt(bloque.stockTotal)}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ColumnaProducto({ col }: { col: ColumnaStockRetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-white p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <RetailProductImage
          alt={col.etiqueta}
          candidates={col.imageCandidates ?? (col.imageSrc ? [col.imageSrc] : [])}
          placeholderClass={col.imagenClass}
          searchFileName={col.imageSearchName}
        />
      </div>
      <p className="text-center font-mono text-[11px] leading-snug text-white/65">{col.etiqueta}</p>
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
        <p className="col-span-full py-12 text-center text-sm text-white/45">
          Sin columnas para mostrar. Importá un lote en Streamlit o elegí otro batch.
        </p>
      ) : (
        columnas.map((col) => <ColumnaProducto key={col.id} col={col} />)
      )}
    </div>
  );
}
