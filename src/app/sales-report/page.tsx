import Link from "next/link";
import { SALES_REPORT_DB_CONTRACT } from "@/modules/sales-report/constants";

export default function SalesReportModulePage() {
  return (
    <div className="min-h-screen bg-report-paper text-report-ink">
      <div className="border-b border-report-rule bg-report-navy px-6 py-3 text-sm text-report-paper">
        <div className="mx-auto flex max-w-4xl justify-between">
          <span>Módulo · Sales Report (port)</span>
          <Link href="/" className="underline underline-offset-4">
            Portada
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-6 py-10 font-sans">
        <h1 className="font-serif text-2xl font-bold text-report-navy">
          Sales Report — emulación Vercel
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-report-muted">
          Próximas entregas: mismas consultas y tubería que Streamlit (QueryCenter +
          SalesLogic), PDF, agrupaciones y porcentaje objetivo; RBAC por usuario; política
          holding de pilares (normalizar / insertar si falta) en capa servidor.
        </p>
        <h2 className="mt-8 font-serif text-lg font-semibold text-report-navy">
          Contrato de datos (9 objetos en BD — incluye la vista)
        </h2>
        <ul className="mt-3 list-inside list-disc text-sm text-report-ink">
          {SALES_REPORT_DB_CONTRACT.map((name) => (
            <li key={name}>
              <code className="rounded bg-report-paper2 px-1">{name}</code>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-report-muted">
          Mencionaste 8 tablas; en código el conjunto completo que alimenta el pivot son
          estos 9 (8 tablas + vista <code>v_ventas_pivot</code>). Si el convenio holding es
          contar 8 sin la vista, lo ajustamos en una línea en constants.
        </p>
      </main>
    </div>
  );
}
