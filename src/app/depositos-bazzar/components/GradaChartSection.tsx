"use client";

import type { StatSlice } from "@/lib/depositos/deposito-estadisticas-charts";
import { ChartAccordion } from "./charts/ChartAccordion";
import { GradaQuantityTable, ParallelGradaBarChart } from "./charts/ParallelGradaBarChart";

type Props = {
  index: number;
  title: string;
  subtitle?: string;
  slices: StatSlice[];
  totalPares: number;
  defaultOpen?: boolean;
};

export function GradaChartSection({
  index,
  title,
  subtitle,
  slices,
  totalPares,
  defaultOpen = false,
}: Props) {
  return (
    <ChartAccordion
      index={index}
      title={title}
      subtitle={subtitle}
      defaultOpen={defaultOpen}
      badge={`${totalPares.toLocaleString("es-PY")} p · ${slices.length} gradas`}
    >
      {slices.length === 0 ? (
        <p className="py-6 text-center text-sm text-report-muted">Sin gradas en esta vista.</p>
      ) : (
        <div className="space-y-4">
          <ParallelGradaBarChart slices={slices} totalPares={totalPares} />
          <GradaQuantityTable slices={slices} />
        </div>
      )}
    </ChartAccordion>
  );
}
