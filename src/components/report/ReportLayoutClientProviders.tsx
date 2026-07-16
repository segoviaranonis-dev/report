"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

/** Provider NIIF fuera del chunk `app/layout` — evita ChunkLoadError por bundle pesado. */
const NiifNavigationLatenciaProvider = dynamic(
  () =>
    import("@/components/report/NiifNavigationLatenciaProvider").then(
      (m) => m.NiifNavigationLatenciaProvider,
    ),
  { ssr: false },
);

export function ReportLayoutClientProviders({ children }: { children: ReactNode }) {
  return <NiifNavigationLatenciaProvider>{children}</NiifNavigationLatenciaProvider>;
}
