import { Suspense } from "react";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { DepositoRimecHubClient } from "./DepositoRimecHubClient";

export const dynamic = "force-dynamic";

export default function DepositoRimecPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="deposito-rimec" maxWidthClass="max-w-3xl" />
      <Suspense fallback={<p className="px-4 py-8 text-sm text-slate-500">Cargando…</p>}>
        <DepositoRimecHubClient />
      </Suspense>
      <ReportFooter note="Depósito RIMEC · hub 2 tarjetas · 2.3.1.10" />
    </div>
  );
}
