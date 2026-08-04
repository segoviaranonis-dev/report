import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { isNivelDios, mensajeAccesoNivelDios, UI_NIVEL_SUPERIOR } from "@/lib/auth/nivel-dios";
import { isRimecDbUnreachableError, mensajeRimecDbOffline } from "@/lib/rimec/pool";
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
          <h1 className="font-serif text-3xl text-rimec-azul-dark">{UI_NIVEL_SUPERIOR} requerido</h1>
          <p className="mt-4 text-neutral-700">{mensajeAccesoNivelDios()}</p>
          <p className="mt-2 text-sm text-neutral-600">
            Solo perfiles de máximo nivel autorizado por el holding.
          </p>
        </section>
        <ReportFooter note={`Aprobaciones · acceso restringido ${UI_NIVEL_SUPERIOR}`} />
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof fetchAprobacionesData>>;
  let catalogos: Awaited<ReturnType<typeof fetchAprobacionesCatalogos>>;
  try {
    const t0 = Date.now();
    [data, catalogos] = await Promise.all([fetchAprobacionesData(), fetchAprobacionesCatalogos()]);
    console.log(`[SSR] Aprobaciones FI-centric cargadas en ${Date.now() - t0}ms`);
  } catch (e) {
    const offline = isRimecDbUnreachableError(e);
    console.error("[SSR] Aprobaciones BD:", e);
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="aprobaciones" />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">
            {offline ? "Base de datos sin conexión" : "Error al cargar aprobaciones"}
          </h1>
          <p className="mt-4 text-neutral-700">
            {offline ? mensajeRimecDbOffline(e) : e instanceof Error ? e.message : String(e)}
          </p>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>Supabase Dashboard → proyecto holding → Restore si está pausado.</li>
            <li>Settings → Database → copiar Connection string (Transaction / 6543).</li>
            <li>
              Pegar en <code className="rounded bg-neutral-200 px-1">report/.env.local</code> como
              DATABASE_URL.
            </li>
            <li>Reiniciar Report en el puerto 3000 y recargar esta página.</li>
          </ol>
        </section>
        <ReportFooter note="Aprobaciones · BD offline" />
      </div>
    );
  }

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
