import type { CSSProperties } from "react";
import type { ColumnaStockRetail, ImportadoraBloque, TiendaTallaBloque } from "@/lib/retail/types";
import { RetailProductImage } from "./RetailProductImage";

function fmt(n: number | null) {
  if (n === null || n === 0) return "—";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(n);
}

const CARD_SHELLS = [
  {
    shellBackground: "#FAF9F7",
    shellBorder: "1px solid #E7E5E4",
    badgeBackground: "#57534E",
    badgeColor: "#FFFFFF",
    accentColor: "#44403C",
    boxShadow: "0 4px 18px rgba(28, 25, 23, 0.07)",
  },
  {
    shellBackground: "#FFF7ED",
    shellBorder: "1px solid #FED7AA",
    badgeBackground: "#C2410C",
    badgeColor: "#FFFFFF",
    accentColor: "#9A3412",
    boxShadow: "0 4px 18px rgba(194, 65, 12, 0.1)",
  },
  {
    shellBackground: "#F5F3FF",
    shellBorder: "1px solid #DDD6FE",
    badgeBackground: "#6D28D9",
    badgeColor: "#FFFFFF",
    accentColor: "#5B21B6",
    boxShadow: "0 4px 18px rgba(109, 40, 217, 0.09)",
  },
  {
    shellBackground: "#ECFDF5",
    shellBorder: "1px solid #A7F3D0",
    badgeBackground: "#047857",
    badgeColor: "#FFFFFF",
    accentColor: "#065F46",
    boxShadow: "0 4px 18px rgba(4, 120, 87, 0.09)",
  },
] as const;

function parseEtiqueta(etiqueta: string): {
  linea: string | null;
  referencia: string | null;
  marca: string | null;
} {
  const full = etiqueta.match(/^L(\S+)\s+R(\S+)\s+-\s+(\d+)\s+pares\s+(.+)$/i);
  if (full) {
    return { linea: full[1], referencia: full[2], marca: full[4].trim() };
  }
  const lr = etiqueta.match(/L(\S+)\s+R(\S+)/);
  return { linea: lr?.[1] ?? null, referencia: lr?.[2] ?? null, marca: null };
}

function sumStockTiendas(bloque: TiendaTallaBloque): number {
  return bloque.stock.reduce((s, n) => s + (n ?? 0), 0);
}

function sumVentaTiendas(bloque: TiendaTallaBloque): number {
  return bloque.venta.reduce<number>((s, n) => s + (n ?? 0), 0);
}

function TablaOrigenTienda({
  bloque,
  accentColor,
}: {
  bloque: TiendaTallaBloque;
  accentColor: string;
}) {
  const { nombre, tallas, venta, stock } = bloque;
  const stockTotal = sumStockTiendas(bloque);
  const ventaTotal = sumVentaTiendas(bloque);
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white/80">
      <div
        className="flex items-center justify-between gap-2 border-b border-stone-200/70 px-2.5 py-1.5"
        style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
      >
        <span
          className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: accentColor }}
        >
          {nombre}
        </span>
        <span className="shrink-0 text-[9px] font-bold tabular-nums text-stone-500">
          {ventaTotal > 0 ? `${fmt(ventaTotal)} v` : ""}
          {ventaTotal > 0 && stockTotal > 0 ? " · " : ""}
          {stockTotal > 0 ? `${fmt(stockTotal)} st` : ""}
        </span>
      </div>
      <table className="w-full border-collapse text-center text-[10px] text-stone-800">
        <thead>
          <tr className="bg-stone-50/90">
            <th className="border-b border-stone-200/60 px-1 py-1 font-medium text-stone-500" />
            {tallas.map((t) => (
              <th key={t} className="border-b border-stone-200/60 px-1 py-1 font-semibold tabular-nums text-stone-700">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-stone-100 bg-stone-50/50 px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-stone-500">
              Venta
            </td>
            {tallas.map((_, i) => (
              <td key={`v-${i}`} className="border-b border-stone-100 px-1 py-1 tabular-nums">
                {fmt(venta[i] ?? null)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="bg-stone-50/50 px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-stone-500">
              Stock
            </td>
            {tallas.map((_, i) => (
              <td key={`s-${i}`} className="px-1 py-1 tabular-nums font-semibold" style={{ color: accentColor }}>
                {fmt(stock[i] ?? 0)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TablaImportadora({ bloque, accentColor }: { bloque: ImportadoraBloque; accentColor: string }) {
  if (bloque.stockTotal <= 0 && bloque.etiquetaGrada === "—") return null;
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/80 bg-white/80">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/70 px-2.5 py-1.5 bg-stone-50/90">
        <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
          RIMEC — Stock Importadora
        </span>
        <span className="font-mono text-[9px] font-medium leading-snug text-stone-600">{bloque.etiquetaGrada}</span>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Stock importadora</span>
        <span className="font-serif text-lg font-bold tabular-nums" style={{ color: accentColor }}>
          {fmt(bloque.stockTotal)}
        </span>
      </div>
    </div>
  );
}

function marcaPillStyle(marca: string): CSSProperties {
  const m = marca.toLowerCase();
  if (m.includes("vizzano")) return { background: "linear-gradient(135deg,#7c3aed,#5b21b6)" };
  if (m.includes("beira")) return { background: "linear-gradient(135deg,#b45309,#92400e)" };
  if (m.includes("modare")) return { background: "linear-gradient(135deg,#0d9488,#115e59)" };
  if (m.includes("moleca")) return { background: "linear-gradient(135deg,#db2777,#9d174d)" };
  return { background: "linear-gradient(135deg,#57534e,#292524)" };
}

function ColumnaProducto({ col, shellIdx }: { col: ColumnaStockRetail; shellIdx: number }) {
  const shell = CARD_SHELLS[shellIdx % CARD_SHELLS.length];
  const parsed = parseEtiqueta(col.etiqueta);
  const imagenNombre = col.imagenArchivo || col.imageSearchName || "—";

  return (
    <article
      className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        borderRadius: 16,
        backgroundColor: shell.shellBackground,
        border: shell.shellBorder,
        boxShadow: shell.boxShadow,
      }}
    >
      <div className="relative">
        <RetailProductImage
          alt={`#${col.ranking} · ${imagenNombre}`}
          candidates={col.imageCandidates ?? (col.imageSrc ? [col.imageSrc] : [])}
          placeholderClass={col.imagenClass}
          searchFileName={col.imageSearchName}
          aspect="square"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums shadow-sm"
            style={{ backgroundColor: shell.badgeBackground, color: shell.badgeColor }}
          >
            #{col.ranking}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide shadow-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "#57534E" }}
          >
            VENTA
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5">
          <span
            className="rounded-lg px-2.5 py-1 text-sm font-extrabold tabular-nums shadow-md"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", color: shell.accentColor }}
          >
            {fmt(col.totalVenta)} pares
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="truncate font-mono text-[10px] font-semibold leading-snug text-stone-700" title={imagenNombre}>
          {imagenNombre}
        </p>

        {col.ventaPorTienda.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {col.ventaPorTienda.map(({ tienda, pares }) => (
              <span
                key={tienda}
                className="rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums"
                style={{
                  color: shell.accentColor,
                  backgroundColor: "rgba(255,255,255,0.7)",
                  border: shell.shellBorder,
                }}
              >
                {tienda}: {fmt(pares)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.marca ? (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white shadow-sm"
              style={marcaPillStyle(parsed.marca.split(" · ")[0] ?? parsed.marca)}
            >
              {parsed.marca.split(" · ")[0]}
            </span>
          ) : null}
          {(parsed.linea || parsed.referencia) && (
            <div className="flex min-w-0 items-center gap-1 truncate text-[11px] font-extrabold">
              {parsed.linea ? <span className="text-report-navy">L{parsed.linea}</span> : null}
              {parsed.linea && parsed.referencia ? <span className="text-stone-300">·</span> : null}
              {parsed.referencia ? (
                <span style={{ color: shell.accentColor }}>R{parsed.referencia}</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-1 flex flex-col gap-2 border-t border-stone-200/60 pt-3">
          {col.tiendas.map((bloque) => (
            <TablaOrigenTienda key={bloque.nombre} bloque={bloque} accentColor={shell.accentColor} />
          ))}
          <TablaImportadora bloque={col.importadora} accentColor={shell.accentColor} />
        </div>
      </div>
    </article>
  );
}

type Props = {
  columnas: ColumnaStockRetail[];
};

export function RetailStockBoard({ columnas }: Props) {
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 pt-6 sm:px-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
      {columnas.length === 0 ? (
        <p className="col-span-full py-12 text-center text-sm text-report-muted">
          Sin columnas para mostrar. Importá un lote en Streamlit o elegí otro batch.
        </p>
      ) : (
        columnas.map((col, i) => <ColumnaProducto key={col.id} col={col} shellIdx={i} />)
      )}
    </div>
  );
}
