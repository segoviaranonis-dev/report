import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { AuditoriaIntegridadClient } from "./components/AuditoriaIntegridadClient";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default function AuditoriaIntegridadPage() {
  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="bazzar-web-auditoria" />

      <section className="border-b-2 border-neutral-300 bg-card-bg py-8">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#F97316" }}>
            Etapa · Auditoría integridad stock Bazzar Web
          </p>
          <h1 className="mt-1 font-serif text-4xl font-light text-rimec-azul-dark">
            Auditoría integridad stock
          </h1>
          <p className="mt-2 text-sm text-neutral-700">
            Pestaña Estadística · Depósito ↔ Sano ↔ Web · Tipo_v2 / marca / estilo · {today}
          </p>
        </div>
      </section>

      <AuditoriaIntegridadClient />

      <ReportFooter note="Auditoría integridad · Stock Sano + siameses Depósito ↔ tienda · 2.5.1.6" />
    </div>
  );
}
