import { Suspense } from "react";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { PilaresHubClient } from "./components/PilaresHubClient";

export const dynamic = "force-dynamic";

export default async function PilaresPage() {
  const session = await getSession();

  if (!session || session.rol_id !== 1) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="pilares" />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Acceso restringido</h1>
          <p className="mt-4 text-neutral-700">Administrador de Pilares — solo rol administrador (rol_id=1).</p>
        </section>
        <ReportFooter note="Pilares · acceso restringido" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="pilares" />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-serif text-3xl text-rimec-azul-dark">Administrador de Pilares</h1>
        <p className="mt-3 text-neutral-700">
          Edición directa en BD de <strong>linea</strong> y <strong>linea_referencia</strong>. Elegí tipo de catálogo
          y entrá a cada administrador.
        </p>
        <div className="mt-8">
          <PilaresHubClient />
        </div>
      </main>
      <ReportFooter note="Administrador de Pilares · hub" />
    </div>
  );
}
