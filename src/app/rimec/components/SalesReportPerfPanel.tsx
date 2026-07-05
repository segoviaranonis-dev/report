"use client";

import { useEffect, useState } from "react";
import {
  formatPerfLines,
  getSalesReportPerf,
  subscribeSalesReportPerf,
} from "@/lib/rimec/sales-report-perf";

export function SalesReportPerfPanel() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setLines(formatPerfLines(getSalesReportPerf()));
    refresh();
    return subscribeSalesReportPerf(refresh);
  }, []);

  if (lines.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] max-w-sm rounded-xl border border-rimec-azul/25 bg-white/95 px-4 py-3 font-mono text-[10px] leading-relaxed text-rimec-azul shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-rimec-azul/70">
        ⏱ Sales Report — medición
      </p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
