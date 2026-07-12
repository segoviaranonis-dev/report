/**
 * Ley visual Director 2026-07-12: VENTA = VERDE (emerald).
 * Prohibido rose/red para vendido · ventas ejecutadas · badge «v» · compradores.
 */
export const VENTA_VISUAL = {
  badge: "bg-emerald-600",
  badgeFg: "text-white",
  label: "text-emerald-700",
  value: "text-emerald-800",
  valueStrong: "text-emerald-900",
  valueMuted: "text-emerald-800/80",
  chipBorder: "border-emerald-300",
  chipBg: "bg-emerald-50",
  chipBorder2: "border-2 border-emerald-300",
  tileBorder: "border-emerald-200",
  tileBg: "bg-emerald-50/80",
  tileHoverBorder: "hover:border-emerald-400",
  tileHoverBg: "hover:bg-emerald-50",
  tileLink: "text-emerald-700",
  tileTitle: "text-emerald-800",
  hubBorder: "border-emerald-300 hover:border-emerald-600",
  hubBg: "hover:bg-emerald-50/80",
} as const;

export const ventaTileClass = `flex flex-col rounded-xl border ${VENTA_VISUAL.tileBorder} ${VENTA_VISUAL.tileBg} p-3 transition ${VENTA_VISUAL.tileHoverBorder} ${VENTA_VISUAL.tileHoverBg}`;

export const ventaChipClass = `rounded-lg ${VENTA_VISUAL.chipBorder2} ${VENTA_VISUAL.chipBg} px-3 py-1.5`;
