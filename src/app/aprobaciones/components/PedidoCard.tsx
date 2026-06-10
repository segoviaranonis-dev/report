import { Button, LoadingSpinner, MoneyDisplay, Skeleton } from "@/components/ui";
import type { DescuentosFactura, Factura, Item, Pedido } from "../lib/aprobaciones-types";
import { EstadoBadge } from "./EstadoBadge";
import { FacturaCard } from "./FacturaCard";

type PedidoCardProps = {
  pedido: Pedido;
  expandido: boolean;
  procesando: boolean;
  cargandoFacturas: boolean;
  facturas: Factura[];
  items: Record<number, Item[]>;
  descuentosFactura: Record<number, DescuentosFactura>;
  listasFactura: Record<number, number>;
  imagenesVisibles: Set<number>;
  onToggleDetalle: () => void;
  onAprobar: () => void;
  onRechazar: () => void;
  onListaChange: (facturaId: number, listaId: number) => void;
  onDescuentoChange: (facturaId: number, descuentos: DescuentosFactura) => void;
  onImageVisible: (itemId: number) => void;
};

export function PedidoCard({
  pedido,
  expandido,
  procesando,
  cargandoFacturas,
  facturas,
  items,
  descuentosFactura,
  listasFactura,
  imagenesVisibles,
  onToggleDetalle,
  onAprobar,
  onRechazar,
  onListaChange,
  onDescuentoChange,
  onImageVisible,
}: PedidoCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-rimec-azul/30 hover:bg-rimec-azul/5 hover:shadow-lg">
      <div className="border-b-2 border-slate-100 bg-white p-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onToggleDetalle}
            className="flex-shrink-0 pt-1 text-rimec-azul transition-colors hover:text-rimec-azul-light"
          >
            {expandido ? "▼" : "▶"}
          </button>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-mono text-lg font-bold text-rimec-azul-dark">{pedido.nro_pedido}</h3>
                <p className="text-sm font-semibold text-rimec-azul">{pedido.cliente}</p>
                <div className="mt-1 flex gap-4 text-sm text-neutral-700">
                  <span className="tabular-nums">{pedido.items_count} pares</span>
                  <MoneyDisplay amount={pedido.total} size="sm" className="text-neutral-ink" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <EstadoBadge estado={pedido.estado} />

                {pedido.estado === "PENDIENTE" && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={onAprobar}
                      loading={procesando}
                      disabled={procesando}
                    >
                      Aprobar
                    </Button>
                    <Button variant="danger" size="sm" onClick={onRechazar} disabled={procesando}>
                      Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {expandido && (
        <div className="bg-neutral-50 p-4">
          {cargandoFacturas ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-neutral-ink-medium">
                <LoadingSpinner size="sm" />
                <span>Cargando facturas e items...</span>
              </div>
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="space-y-3 rounded-lg border border-neutral-300 bg-white p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="flex gap-3">
                          <Skeleton className="h-16 w-16" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : facturas.length === 0 ? (
            <p className="py-4 text-sm text-neutral-ink-muted">No hay facturas para este pedido.</p>
          ) : (
            <div className="space-y-6">
              {facturas.map((factura) => {
                const descuentos = descuentosFactura[factura.id] || {
                  d1: factura.descuento_1,
                  d2: factura.descuento_2,
                  d3: factura.descuento_3,
                  d4: factura.descuento_4,
                };
                const listaId = listasFactura[factura.id] ?? factura.lista_precio_id ?? 1;

                return (
                  <FacturaCard
                    key={factura.id}
                    factura={factura}
                    items={items[factura.id] || []}
                    pedidoEstado={pedido.estado}
                    descuentos={descuentos}
                    listaId={listaId}
                    imagenesVisibles={imagenesVisibles}
                    onListaChange={onListaChange}
                    onDescuentoChange={onDescuentoChange}
                    onImageVisible={onImageVisible}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
