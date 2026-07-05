"use client";

import { useEffect, useState } from "react";
import {
  getSalesReportPrefetchState,
  subscribeSalesReportPrefetch,
} from "@/lib/rimec/sales-report-prefetch";

export function SalesReportHubStatus() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      const s = getSalesReportPrefetchState();
      if (s.status === "loading") setLabel("Preparando informe…");
      else if (s.status === "ready" && s.snapshot) setLabel("Listo — entrá");
      else if (s.status === "ready") setLabel(null);
      else if (s.status === "error") setLabel("Reintentar al entrar");
      else setLabel(null);
    };
    refresh();
    return subscribeSalesReportPrefetch(refresh);
  }, []);

  if (!label) return null;

  return (
    <span className="mt-2 inline-block rounded-full bg-rimec-azul/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rimec-azul">
      {label}
    </span>
  );
}
