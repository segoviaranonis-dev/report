import { ReportAppNav } from "@/components/report/ReportAppNav";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReportSection } from "@/components/report/ReportSection";
import { VentasFotosClient } from "./VentasFotosClient";

export default function VentasFotosPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <ReportAppNav active="ventas-fotos" title="Ventas con fotos" maxWidthClass="max-w-6xl" />

      <VentasFotosClient />

      <article className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        <ReportSection number="1." title="Qué absorbe del sistema viejo">
          <p>
            Este módulo reemplaza la app desktop <code className="text-xs">info_ventas_fotos</code>: filtros por cliente,
            período, marca y referencia; clasificación de cantidad en <strong>VENTA</strong> / <strong>TRANSITO</strong>;
            tabla imprimible con miniaturas del bucket <code className="text-xs">productos</code>.
          </p>
        </ReportSection>
        <ReportSection number="2." title="Qué queda fuera del legado">
          <p>
            No se migra PyQt, MySQL Railway, credenciales hardcodeadas, carpetas UNC ni PyInstaller. Report queda como
            módulo web con datos server-side desde <code className="text-xs">DATABASE_URL</code>.
          </p>
        </ReportSection>
      </article>

      <ReportFooter note="Ventas con fotos: integración inicial del informe legacy dentro de Report, preparada para el mismo origen de datos del Sales Report." />
    </div>
  );
}
