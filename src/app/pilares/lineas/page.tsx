import { Suspense } from "react";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { LineasAdminClient } from "../components/LineasAdminClient";

export const dynamic = "force-dynamic";

export default async function PilaresLineasPage() {
  const session = await getSession();

  if (!session || session.rol_id !== 1) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="pilares" />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Acceso restringido</h1>
        </section>
        <ReportFooter note="Pilares · acceso restringido" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="pilares" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Suspense fallback={<p className="text-sm text-neutral-600">Cargando…</p>}>
          <LineasAdminClient />
        </Suspense>
      </main>
      <ReportFooter note="Pilares · líneas" />
    </div>
  );
}
