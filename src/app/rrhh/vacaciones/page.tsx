import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { VacacionesClient } from "./VacacionesClient";
import { fetchVacaciones, fetchEstadisticasVacaciones } from "./lib/queries";
import { fetchEntes } from "../lib/rrhh-queries";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());
const anioActual = new Date().getFullYear();

export default async function VacacionesPage() {
  const session = await getSession();

  // Control de acceso: rol 1 (Admin) y 2 (Supervisor)
  if (!session || ![1, 2].includes(session.rol_id)) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Acceso Restringido</h1>
          <p className="mt-4 text-neutral-700">
            El módulo Vacaciones requiere permisos de administrador o supervisor.
          </p>
        </section>
        <ReportFooter note="RRHH · Vacaciones · acceso restringido" />
      </div>
    );
  }

  // Cargar datos
  const t0 = Date.now();
  let vacaciones, estadisticas, entes;

  try {
    [vacaciones, estadisticas, entes] = await Promise.all([
      fetchVacaciones({ anio: anioActual }),
      fetchEstadisticasVacaciones(anioActual),
      fetchEntes(),
    ]);
    console.log(`[SSR] Vacaciones cargadas en ${Date.now() - t0}ms`);
  } catch (error) {
    // Tablas no existen - mostrar página de setup
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen />
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-2xl border-2 border-bazzar-naranja bg-card-bg p-12 text-center">
            <div className="mb-6 text-6xl">🏖️</div>
            <h1 className="font-serif text-4xl font-bold text-rimec-azul">
              Módulo Vacaciones - Setup Requerido
            </h1>
            <p className="mt-4 text-lg text-neutral-700">
              Las tablas de RRHH no están creadas. Ejecuta primero el SQL de setup.
            </p>

            <div className="mt-8 rounded-xl bg-app-bg p-6 text-left">
              <h2 className="mb-4 text-xl font-bold text-rimec-azul">Ejecutar en Supabase:</h2>
              <div className="rounded-lg bg-neutral-800 p-4 font-mono text-sm text-white">
                C:\Users\hecto\Nexus_Core\report\RRHH_COMPLETO.sql
              </div>
            </div>

            <a
              href="https://app.supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block rounded-lg bg-rimec-azul px-8 py-3 font-bold text-white transition-colors hover:bg-rimec-azul-dark"
            >
              Ir a Supabase →
            </a>
          </div>
        </section>
        <ReportFooter note="RRHH · Vacaciones · Setup requerido" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="rrhh" />

      {/* Submódulos RRHH */}
      <section className="border-b border-white/20 bg-gradient-to-r from-rimec-azul-dark to-rimec-azul py-3">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-3">
            <a
              href="/rrhh"
              className="rounded-lg bg-white/10 px-6 py-2 font-bold text-white transition-colors hover:bg-white/30"
            >
              👥 Funcionarios
            </a>
            <a
              href="/rrhh/vacaciones"
              className="rounded-lg bg-white/20 px-6 py-2 font-bold text-white transition-colors hover:bg-white/30"
            >
              🏖️ Vacaciones
            </a>
          </div>
        </div>
      </section>

      {/* Hero NIIF */}
      <section className="border-b-2 border-rimec-azul bg-gradient-to-br from-rimec-azul-dark to-rimec-azul py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between">
            <div className="text-white">
              <h1 className="font-serif text-5xl font-light">Vacaciones {anioActual}</h1>
              <p className="mt-3 text-lg text-white/90">
                Consulta de días de vacaciones pendientes por funcionario · {today}
              </p>
            </div>

            {/* KPIs */}
            <div className="flex gap-8">
              <div className="text-right">
                <div className="text-5xl font-bold text-white">
                  {estadisticas.total_dias_pendientes}
                </div>
                <div className="mt-1 text-sm uppercase tracking-wider text-white/80">
                  Días pendientes total
                </div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-white">
                  {estadisticas.promedio_dias_pendientes}
                </div>
                <div className="mt-1 text-sm uppercase tracking-wider text-white/80">
                  Promedio por funcionario
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VacacionesClient
        vacaciones={vacaciones}
        estadisticas={estadisticas}
        entes={entes}
        anioActual={anioActual}
      />

      <ReportFooter note="RRHH · Vacaciones · Sistema Nexus Holding" />
    </div>
  );
}
