import type { Item } from "../lib/aprobaciones-types";

type ItemRowProps = {
  item: Item;
  imagenCargada: boolean;
  onImageVisible: (itemId: number) => void;
};

export function ItemRow({ item, imagenCargada, onImageVisible }: ItemRowProps) {
  return (
    <div className="flex items-center gap-3 rounded border border-report-rule bg-white p-2">
      <div className="flex-shrink-0">
        {imagenCargada && item.imagen_url ? (
          <img
            src={item.imagen_url}
            alt={`${item.linea_codigo}-${item.ref_codigo}`}
            className="h-16 w-16 object-contain"
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (item.imagen_url) onImageVisible(item.id);
            }}
            disabled={!item.imagen_url}
            className={`flex h-16 w-16 flex-col items-center justify-center rounded border border-report-rule text-xs ${
              item.imagen_url
                ? "cursor-pointer bg-report-paper2 text-report-navy2 hover:bg-report-paper hover:text-report-navy"
                : "bg-gray-50 text-gray-400"
            }`}
            title={item.imagen_url ? "Clic para ver imagen" : "Sin imagen"}
          >
            <span className="text-lg">📷</span>
            {item.imagen_url && <span className="mt-0.5 text-[9px]">Ver</span>}
          </button>
        )}
      </div>

      <div className="flex-1">
        <div className="text-sm font-semibold text-report-navy">
          L{item.linea_codigo} · R{item.ref_codigo}
        </div>
        <div className="text-xs text-report-muted">
          {item.color_nombre}
          {item.material_nombre && ` · ${item.material_nombre}`}
        </div>
        {item.gradas_fmt && (
          <div className="mt-1 text-[10px] font-mono text-report-muted">{item.gradas_fmt}</div>
        )}
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">
          {item.cajas} caj · {item.pares} p
        </div>
        <div className="text-xs tabular-nums text-report-muted">
          Gs. {item.subtotal.toLocaleString("es-PY")}
        </div>
      </div>
    </div>
  );
}
