import { ReportAppNav } from "@/components/report/ReportAppNav";
import { ReportFooter } from "@/components/report/ReportFooter";
import { VentasFotosPageBody } from "./VentasFotosPageBody";

export default function VentasFotosPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <ReportAppNav active="ventas-fotos" title="Ventas con fotos" maxWidthClass="max-w-6xl" />
      <VentasFotosPageBody />
      <ReportFooter note="Ventas con fotos: integración inicial del informe legacy dentro de Report, preparada para el mismo origen de datos del Sales Report." />
    </div>
  );
}
