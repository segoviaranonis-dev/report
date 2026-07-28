import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { LogisticaOkClient } from "../LogisticaOkClient";

export const dynamic = "force-dynamic";

export default function LogisticaProcesoPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="logistica-ok" maxWidthClass="max-w-6xl" />
      <LogisticaOkClient />
    </div>
  );
}
