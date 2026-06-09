/**
 * NIIF UI - Indicador de Variación
 * Norma del "Indicador Doble": Color + Texto + Ícono geométrico
 * Un usuario daltónico debe saber si ganó o perdió sin ver el color
 */

interface VariationIndicatorProps {
  value: number;
  format?: "percentage" | "currency";
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function VariationIndicator({
  value,
  format = "percentage",
  showIcon = true,
  size = "md",
}: VariationIndicatorProps) {
  const isPositive = value >= 0;
  const isNeutral = value === 0;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const colorClass = isNeutral
    ? "text-neutral-ink-muted"
    : isPositive
    ? "text-semantic-success"
    : "text-semantic-error";

  const formattedValue =
    format === "percentage"
      ? `${isPositive && value > 0 ? "+" : ""}${value.toFixed(1)}%`
      : `${isPositive && value > 0 ? "+" : ""}${value.toLocaleString("es-PY")}`;

  const icon = isNeutral ? "–" : isPositive ? "▲" : "▼";

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold tabular-nums ${colorClass} ${sizeClasses[size]}`}
    >
      {showIcon && <span className="flex-shrink-0">{icon}</span>}
      <span>{formattedValue}</span>
    </span>
  );
}

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MoneyDisplay({
  amount,
  currency = "Gs.",
  size = "md",
  className = "",
}: MoneyDisplayProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <span className={`font-semibold tabular-nums ${sizeClasses[size]} ${className}`}>
      {currency} {amount.toLocaleString("es-PY")}
    </span>
  );
}