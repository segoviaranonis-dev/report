"use client";

import { ReportPerfHud } from "@/components/report/ReportPerfHud";
import { SalesReportWarmup } from "@/components/report/SalesReportWarmup";

export function ReportPerfRoot() {
  return (
    <>
      <SalesReportWarmup />
      <ReportPerfHud />
    </>
  );
}
