import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { isNivelDios, mensajeAccesoNivelDios } from "@/lib/auth/nivel-dios";
import { AprobacionesClient } from "./AprobacionesClient";
import { fetchAprobacionesCatalogos, fetchAprobacionesData } from "./lib/aprobaciones-queries";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default async function AprobacionesPage() {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="aprobaciones" />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Nivel Dios requerido</h1>
          <p className="mt-4 text-neutral-700">{mensajeAccesoNivelDios()}</p>
          <p className="mt-2 text-sm text-neutral-600">
            Solo profesionales muy autorizados: <code>usuario_v2.rol_id = 1</code> y{" "}
            <code>usuario_v2.categoria = &apos;DIOS&apos;</code>.
          </p>
        </section>
        <ReportFooter note="Aprobaciones · acceso restringido Nivel Dios" />
      </div>
    );
  }

  const t0 = Date.now();
  const [data, catalogos] = await Promise.all([
    fetchAprobacionesData(),
    fetchAprobacionesCatalogos(),
  ]);
  console.log(`[SSR] Aprobaciones FI-centric cargadas en ${Date.now() - t0}ms`);

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="aprobaciones" />

      <section className="border-b-2 border-neutral-300 bg-card-bg py-8">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">
            Aprobación de Pedidos RIMEC
          </h1>
          <p className="mt-2 text-sm text-neutral-700">
            Gemelo operativo Streamlit · PV global (PV000147) · {today}
          </p>
        </div>
      </section>

      <AprobacionesClient dataInicial={data} catalogos={catalogos} />

      <ReportFooter note="Aprobaciones · Misma lógica que Control Central (factura_interna + pv_global)" />
    </div>
  );
}
