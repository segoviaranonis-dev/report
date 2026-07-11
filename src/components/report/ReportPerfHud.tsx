"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getReportPerfEntries,
  markReportRoutePaint,
  markReportRouteStart,
  subscribeReportPerf,
} from "@/lib/report/report-perf";
import { formatPerfLines, getSalesReportPerf, subscribeSalesReportPerf } from "@/lib/rimec/sales-report-perf";

export function ReportPerfHud() {
  const pathname = usePathname();
  const [lines, setLines] = useState<{ key: string; text: string }[]>([]);

  useEffect(() => {
    markReportRouteStart(pathname);
    const id = requestAnimationFrame(() => markReportRoutePaint(pathname));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      const globalEntries = getReportPerfEntries().slice(0, 8);
      const salesLines = pathname.startsWith("/rimec") ? formatPerfLines(getSalesReportPerf()) : [];
      const items: { key: string; text: string }[] = [
        ...salesLines.map((text, i) => ({ key: `sales-${i}`, text })),
        ...globalEntries.map((e) => ({
          key: e.id,
          text: e.label.includes("→ pantalla") || e.label.includes("s ·")
            ? `${e.label}: ${(e.ms / 1000).toFixed(2)} s`
            : e.label.includes("s")
              ? e.label
              : `${e.label}: ${(e.ms / 1000).toFixed(2)} s`,
        })),
      ];
      setLines(items.slice(0, 10));
    };
    refresh();
    const unsubA = subscribeReportPerf(refresh);
    const unsubB = subscribeSalesReportPerf(refresh);
    return () => {
      unsubA();
      unsubB();
    };
  }, [pathname]);

  if (process.env.NODE_ENV === "production") return null;
  if (process.env.NEXT_PUBLIC_REPORT_PERF_HUD !== "1") return null;
  if (lines.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-rimec-azul/30 bg-white/95 px-4 py-3 font-mono text-[10px] leading-relaxed text-rimec-azul shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-rimec-azul/70">
        ⏱ Report — reacción (dev)
      </p>
      {lines.map((line) => (
        <p key={line.key}>{line.text}</p>
      ))}
    </div>
  );
}
