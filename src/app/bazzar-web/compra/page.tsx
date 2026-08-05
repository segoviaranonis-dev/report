import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { CompraWebClient } from "./components/CompraWebClient";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default function CompraWebPage() {
  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="bazzar-web-compra" />

      <section className="border-b-2 border-neutral-300 bg-card-bg py-8">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">Compra Web Bazzar</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Recepción mercadería cliente <strong>5000</strong> (Bazzar.py) · ALM_WEB_01 · {today}
          </p>
        </div>
      </section>

      <CompraWebClient />

      <ReportFooter note="Compra Web · Facturación → traspaso ENVIADO → confirmar → stock tienda" />
    </div>
  );
}
