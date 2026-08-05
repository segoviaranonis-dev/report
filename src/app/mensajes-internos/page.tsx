import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { BandejaMensajesInternos } from "./BandejaMensajesInternos";

export const dynamic = "force-dynamic";

/**
 * Mensajes internos · 2.3.1.36
 * Acordeones: textos · PDFs logística · PDFs PE · salida.
 */
export default function MensajesInternosPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="mensajes-internos" maxWidthClass="max-w-6xl" />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link href="/" className="text-sm text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
          Mensajes internos
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          <span className="font-semibold text-rimec-azul">2.3.1.36</span>
          {" · "}
          Acordeones: <strong>Mensajes</strong> ·{" "}
          <strong>PDFs confirmación de entregas</strong> ·{" "}
          <strong>PDFs pronta entrega</strong> · Salida.
        </p>

        <BandejaMensajesInternos />

        <p className="mt-8 text-sm text-slate-500">
          Configurar envíos automáticos:{" "}
          <Link href="/automatizacion-informes" className="text-rimec-azul hover:underline">
            Automatización de informes
          </Link>
        </p>
      </main>

      <ReportFooter note="Mensajes internos · entrada · PDF · salida · 2.3.1.36" />
    </div>
  );
}
