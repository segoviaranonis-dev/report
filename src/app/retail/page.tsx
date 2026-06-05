import Link from "next/link";
import { ReportAppNav } from "@/components/report/ReportAppNav";
import { ReportFooter } from "@/components/report/ReportFooter";
import { RetailStockClient } from "./RetailStockClient";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default function RetailStockPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <ReportAppNav active="retail" title="Stock / Retail multi-tienda" maxWidthClass="max-w-6xl" />

      <RetailStockClient todayLabel={today} />

      <nav className="mx-auto max-w-4xl px-6 py-8 text-center">
        <Link
          href="/rimec"
          className="font-semibold text-report-navy2 underline decoration-report-rule underline-offset-4 hover:decoration-report-navy"
        >
          Volver al informe RIMEC (ventas)
        </Link>
        <span className="text-report-muted"> · </span>
        <Link
          href="/"
          className="font-semibold text-report-navy2 underline decoration-report-rule underline-offset-4 hover:decoration-report-navy"
        >
          Portada
        </Link>
      </nav>

      <ReportFooter note="Retail: rejilla superior por referencia (stock/venta por talla). Resumen operativo = snapshot Excel completo (Ente → Género → Marca → SKU, sin acumular lotes)." />
    </div>
  );
}
