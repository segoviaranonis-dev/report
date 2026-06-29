import { notFound } from "next/navigation";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { UsuariosAdminClient } from "./components/UsuariosAdminClient";

export const dynamic = "force-dynamic";

export default async function PilaresUsuariosPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="pilares" />
        <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Acceso restringido</h1>
          <p className="mt-4 text-neutral-700">Solo rol_id=1 en entorno local.</p>
        </section>
        <ReportFooter note="Usuarios · local only" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="pilares" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800">Solo local · no producción</p>
        <h1 className="mt-2 font-serif text-2xl text-rimec-azul-dark sm:text-3xl">Administrador de Usuarios</h1>
        <p className="mt-2 text-sm text-neutral-700 sm:text-base">
          Vista y edición de <strong>usuario_v2</strong>, <strong>maestro_rol_acceso</strong> y{" "}
          <strong>usuario_categoria</strong>.
        </p>

        <div className="mt-6">
          <UsuariosAdminClient />
        </div>
      </main>
      <ReportFooter note="Usuarios · 2.3.5.4 · LOCAL ONLY" />
    </div>
  );
}
