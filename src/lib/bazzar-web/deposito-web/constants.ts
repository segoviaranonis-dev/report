/**
 * Depósito Web — 4.º hermano cadena Bazzar Web (Compra · Depósito · Motor · Stock Sano).
 * Tabs siameses: ingreso bruto (Streamlit) vs vendible tienda (v_stock_web).
 */
export type DepositoWebTab = "ingreso" | "vendible";

export const DEPOSITO_WEB_TABS: ReadonlyArray<{
  id: DepositoWebTab;
  label: string;
  icon: string;
  hint: string;
}> = [
  {
    id: "ingreso",
    label: "Ingreso ALM",
    icon: "📦",
    hint: "INGRESO_COMPRA confirmado · gemelo Streamlit deposito_web",
  },
  {
    id: "vendible",
    label: "Vendible tienda",
    icon: "🛒",
    hint: "v_stock_web neto · hermano bazzar-web catálogo",
  },
] as const;

export const WEB_NAVY = "#1E3A5F";
export const WEB_ORANGE = "#F97316";
