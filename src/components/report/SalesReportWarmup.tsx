"use client";

import { useEffect } from "react";
import { prefetchSalesReportSnapshot } from "@/lib/rimec/sales-report-prefetch";

/** Calienta Sales Report en cuanto hay sesión rol 1 (login, hub o cualquier ruta). */
export function SalesReportWarmup() {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.authenticated) return;
        const rolId = data.user?.rol_id ?? 1;
        if (rolId === 1) {
          void prefetchSalesReportSnapshot();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
