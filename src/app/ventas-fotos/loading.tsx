import { ReportAppNav } from "@/components/report/ReportAppNav";
import { VentasFotosEntryShell } from "./VentasFotosEntryShell";

export default function VentasFotosLoading() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <ReportAppNav active="ventas-fotos" title="Ventas con fotos" maxWidthClass="max-w-6xl" />
      <VentasFotosEntryShell />
    </div>
  );
}
