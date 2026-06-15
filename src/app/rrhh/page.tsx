import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { getSession } from "@/lib/auth/session";
import { RRHHClient } from "./RRHHClient";
import {
  fetchFuncionarios,
  fetchEntes,
  fetchEstadisticas,
  fetchDepartamentos,
  fetchCargos,
} from "./lib/rrhh-queries";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default async function RRHHPage() {
  const session = await getSession();

  // Control de acceso: solo rol_id 1 (Admin) y 2 (Supervisor)
  if (!session || ![1, 2].includes(session.rol_id)) {
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="rrhh" />
        <section className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-serif text-3xl text-rimec-azul-dark">Acceso Restringido</h1>
          <p className="mt-4 text-neutral-700">
            El módulo RRHH requiere permisos de administrador o supervisor.
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Roles permitidos: <code>rol_id = 1</code> (Admin) o <code>rol_id = 2</code> (Supervisor).
          </p>
        </section>
        <ReportFooter note="RRHH · acceso restringido" />
      </div>
    );
  }

  // Cargar datos en paralelo
  const t0 = Date.now();
  let funcionarios, entes, estadisticas, departamentos, cargos;

  try {
    [funcionarios, entes, estadisticas, departamentos, cargos] = await Promise.all([
      fetchFuncionarios(),
      fetchEntes(),
      fetchEstadisticas(),
      fetchDepartamentos(),
      fetchCargos(),
    ]);
    console.log(`[SSR] RRHH datos cargados en ${Date.now() - t0}ms`);
  } catch (error) {
    // Tablas no existen - mostrar página de setup
    return (
      <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
        <NexusHeaderZen active="rrhh" />
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-2xl border-2 border-bazzar-naranja bg-card-bg p-12 text-center">
            <div className="mb-6 text-6xl">⚙️</div>
            <h1 className="font-serif text-4xl font-bold text-rimec-azul">
              Setup Requerido
            </h1>
            <p className="mt-4 text-lg text-neutral-700">
              Las tablas de RRHH aún no han sido creadas en la base de datos.
            </p>

            <div className="mt-8 rounded-xl bg-app-bg p-6 text-left">
              <h2 className="mb-4 text-xl font-bold text-rimec-azul">
                Pasos para activar RRHH:
              </h2>
              <ol className="space-y-3 text-neutral-700">
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul font-bold text-white">
                    1
                  </span>
                  <div>
                    <strong>Ir a Supabase:</strong>{" "}
                    <a
                      href="https://app.supabase.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rimec-azul underline hover:text-rimec-azul-dark"
                    >
                      app.supabase.com
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul font-bold text-white">
                    2
                  </span>
                  <div>
                    <strong>Abrir SQL Editor:</strong> Menú lateral → SQL Editor → New query
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul font-bold text-white">
                    3
                  </span>
                  <div>
                    <strong>Ejecutar SQL:</strong> Copiar todo el archivo{" "}
                    <code className="rounded bg-neutral-200 px-2 py-1 font-mono text-sm">
                      RRHH_COMPLETO.sql
                    </code>{" "}
                    y hacer click en RUN
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rimec-azul font-bold text-white">
                    4
                  </span>
                  <div>
                    <strong>Recargar esta página</strong>
                  </div>
                </li>
              </ol>
            </div>

            <div className="mt-6 text-sm text-neutral-600">
              Archivo SQL: <code className="font-mono">C:\Users\hecto\Nexus_Core\report\RRHH_COMPLETO.sql</code>
            </div>
          </div>
        </section>
        <ReportFooter note="RRHH · Setup requerido" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      <NexusHeaderZen active="rrhh" />

      {/* Submódulos RRHH */}
      <section className="border-b-2 border-rimec-azul bg-gradient-to-r from-rimec-azul-dark to-rimec-azul py-4">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-3">
            <a
              href="/rrhh"
              className="rounded-lg bg-white/20 px-6 py-2 font-bold text-white transition-colors hover:bg-white/30"
            >
              👥 Funcionarios
            </a>
            <a
              href="/rrhh/vacaciones"
              className="rounded-lg bg-white/10 px-6 py-2 font-bold text-white transition-colors hover:bg-white/30"
            >
              🏖️ Vacaciones
            </a>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-neutral-300 bg-card-bg py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">
                Funcionarios
              </h1>
              <p className="mt-2 text-sm text-neutral-700">
                Gestión de funcionarios por ente · {today}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-3xl font-bold text-rimec-azul">{estadisticas.total}</div>
                <div className="text-xs uppercase tracking-wider text-neutral-600">
                  Funcionarios
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-rimec-azul">
                  {estadisticas.antiguedad_promedio_anios}
                </div>
                <div className="text-xs uppercase tracking-wider text-neutral-600">
                  Años promedio
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <RRHHClient
        funcionarios={funcionarios}
        entes={entes}
        estadisticas={estadisticas}
        departamentos={departamentos}
        cargos={cargos}
      />

      <ReportFooter note="RRHH · Módulo Recursos Humanos Nexus Holding" />
    </div>
  );
}
