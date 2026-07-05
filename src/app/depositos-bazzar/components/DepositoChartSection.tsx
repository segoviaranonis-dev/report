"use client";

import type { StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";
import { ChartAccordion } from "./charts/ChartAccordion";
import { InteractiveBarChart } from "./charts/ChartTooltip";
import { InteractiveDonutChart } from "./charts/InteractiveDonutChart";

type Props = {
  index: number;
  title: string;
  subtitle?: string;
  slices: StatSlice[];
  totalPares: number;
  defaultOpen?: boolean;
};

export function DepositoChartSection({
  index,
  title,
  subtitle,
  slices,
  totalPares,
  defaultOpen = false,
}: Props) {
  if (slices.length === 0) {
    return (
      <ChartAccordion index={index} title={title} subtitle={subtitle} defaultOpen={defaultOpen}>
        <p className="py-6 text-center text-sm text-report-muted">Sin datos en esta vista.</p>
      </ChartAccordion>
    );
  }

  return (
    <ChartAccordion
      index={index}
      title={title}
      subtitle={subtitle}
      defaultOpen={defaultOpen}
      badge={`${totalPares.toLocaleString("es-PY")} p · ${slices.length} ítems`}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <InteractiveDonutChart slices={slices} totalPares={totalPares} />
        <InteractiveBarChart slices={slices} />
      </div>
    </ChartAccordion>
  );
}
