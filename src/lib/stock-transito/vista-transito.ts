import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

export type StockTransitoVista = "disponible" | "ventas";

export const STOCK_TRANSITO_VISTA_META: Record<
  StockTransitoVista,
  { title: string; subtitle: string; hubHref: string }
> = {
  disponible: {
    title: "Saldo disponible · Compra previa",
    subtitle: "Stock en tránsito · control de partidas vendibles",
    hubHref: "/stock-transito",
  },
  ventas: {
    title: "Ventas ejecutadas · Compra previa",
    subtitle: "Detalle de ventas · pares vendidos por molécula",
    hubHref: "/stock-transito",
  },
};

export function filterTransitoRowsByVista(
  rows: DepositoRow[],
  vista: StockTransitoVista,
  opts?: { casoActivo?: string | null },
): DepositoRow[] {
  if (vista === "disponible") return rows.filter((r) => r.cantidad > 0);
  // Ventas sin caso: solo moléculas con pares vendidos.
  // Con caso activo: mostrar todo el universo del caso (vendido puede ser 0 en algunas líneas).
  if (opts?.casoActivo) return rows;
  return rows.filter((r) => (r.pares_vendidos ?? 0) > 0);
}
