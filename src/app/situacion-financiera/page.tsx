import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { SituacionFinancieraClient } from "./SituacionFinancieraClient";

export const dynamic = "force-dynamic";

/**
 * Situación financiera Rimec · 2.3.1.50
 * Hub Report — previsión liquidez importadora (Excel SF AL · guía Guido).
 */
export default function SituacionFinancieraPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="situacion-financiera" maxWidthClass="max-w-6xl" />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/" className="text-sm text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
          Situación financiera
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <span className="font-semibold text-rimec-azul">2.3.1.50</span>
          {" · "}
          Previsión de liquidez de la importadora · CxC · cheques · PV · cobros ·
          egresos. Norte: Excel <strong>SF AL</strong> (versión Guido / OneDrive).
        </p>

        <SituacionFinancieraClient />
      </main>

      <ReportFooter note="Situación financiera · importadora · 2.3.1.50 · F4 Sales Report blindado" />
    </div>
  );
}
