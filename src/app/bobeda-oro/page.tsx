import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { BobedaOroClient } from "./BobedaOroClient";

export default function BobedaOroPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="bobeda-oro" maxWidthClass="max-w-[1400px]" />
      <BobedaOroClient />
      <ReportFooter note="Bóveda ORO · bobeda_venta_pos · Sales Report Bazzar futuro · no mezclar registro_ventas_general_v2" />
    </div>
  );
}
