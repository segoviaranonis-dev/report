import type { DescuentosFactura, Factura, Item, PedidoEstado } from "../lib/aprobaciones-types";
import { ItemRow } from "./ItemRow";

type FacturaCardProps = {
  factura: Factura;
  items: Item[];
  pedidoEstado: PedidoEstado;
  descuentos: DescuentosFactura;
  listaId: number;
  imagenesVisibles: Set<number>;
  onListaChange: (facturaId: number, listaId: number) => void;
  onDescuentoChange: (facturaId: number, descuentos: DescuentosFactura) => void;
  onImageVisible: (itemId: number) => void;
};

export function FacturaCard({
  factura,
  items,
  pedidoEstado,
  descuentos,
  listaId,
  imagenesVisibles,
  onListaChange,
  onDescuentoChange,
  onImageVisible,
}: FacturaCardProps) {
  return (
    <div className="rounded border border-report-rule bg-report-paper p-4">
      <div className="mb-4 border-b border-report-rule pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-serif text-lg font-semibold text-report-navy">{factura.nro_factura}</h4>
            <p className="text-xs text-report-muted">
              {factura.nro_pp} · {factura.marca}
            </p>
            {factura.nro_factura_legacy && factura.nro_factura_legacy !== factura.nro_factura && (
              <p className="text-[11px] text-report-muted">Legacy: {factura.nro_factura_legacy}</p>
            )}
            <p className="text-sm font-semibold text-report-navy2">Caso: {factura.caso}</p>
            {factura.fecha_arribo_estimada && (
              <p className="text-xs text-report-muted">
                Flt prevista: {new Date(factura.fecha_arribo_estimada).toLocaleDateString("es-PY")}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums text-report-navy">
              {factura.total_pares} pares
            </div>
            <div className="text-sm tabular-nums text-report-muted">
              Gs. {factura.total_monto.toLocaleString("es-PY")}
            </div>
          </div>
        </div>

        {pedidoEstado === "PENDIENTE" && (
          <div className="mt-3 grid grid-cols-5 gap-3 rounded bg-white p-3 text-sm">
            <div>
              <label className="text-xs text-report-muted">Lista de precios</label>
              <select
                value={listaId}
                onChange={(e) => onListaChange(factura.id, parseInt(e.target.value, 10))}
                className="mt-1 w-full rounded border border-report-rule px-2 py-1 text-sm"
              >
                <option value={1}>LPN</option>
                <option value={2}>LP2</option>
                <option value={3}>LP3</option>
              </select>
            </div>
            {([1, 2, 3, 4] as const).map((i) => (
              <div key={i}>
                <label className="text-xs text-report-muted">Descuento {i} (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={descuentos[`d${i}`]}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const key = `d${i}` as keyof DescuentosFactura;
                    onDescuentoChange(factura.id, { ...descuentos, [key]: val });
                  }}
                  className="mt-1 w-full rounded border border-report-rule px-2 py-1 text-sm tabular-nums"
                />
              </div>
            ))}
          </div>
        )}

        {pedidoEstado !== "PENDIENTE" && (
          <div className="mt-3 text-xs text-report-muted">
            Lista: LP{factura.lista_precio_id || 1} · Descuentos: {factura.descuento_1}% /{" "}
            {factura.descuento_2}% / {factura.descuento_3}% / {factura.descuento_4}%
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-report-muted">Sin items</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              imagenCargada={imagenesVisibles.has(item.id)}
              onImageVisible={onImageVisible}
            />
          ))}
        </div>
      )}
    </div>
  );
}
