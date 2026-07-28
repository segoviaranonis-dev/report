import { prefetchSalesReportSnapshot } from "@/lib/rimec/sales-report-prefetch";

/** Prefetch de ruta App Router (+ snapshot Sales Report si aplica). */
export function prefetchHubHref(
  prefetch: (href: string) => void,
  href: string,
): void {
  const path = href.split("?")[0] || href;
  if (!path.startsWith("/")) return;
  prefetch(path);
  if (path === "/rimec" || path === "/sales-report") {
    void prefetchSalesReportSnapshot();
  }
}
