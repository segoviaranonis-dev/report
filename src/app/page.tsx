"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { canAccessAprobaciones } from "@/lib/auth/nivel-dios";
import { prefetchSalesReportSnapshot } from "@/lib/rimec/sales-report-prefetch";
import { SalesReportHubStatus } from "@/components/report/SalesReportHubStatus";
import {
  filterHubModules,
  modulesByGroup,
  REPORT_HUB_GROUP_META,
  REPORT_HUB_MODULES,
  type ReportHubGroup,
} from "@/lib/report/hub-modules";

const WEB_NAVY = "#1E3A5F";

const GROUP_STYLES: Record<
  Exclude<ReportHubGroup, "recursos">,
  { border: string; summaryHover: string; titleClass: string; cardBorder: string; titleHover: string }
> = {
  rimec: {
    border: "border-rimec-azul-dark",
    summaryHover: "hover:bg-rimec-celeste-bg",
    titleClass: "text-rimec-azul-dark",
    cardBorder: "border-rimec-azul/20 hover:border-rimec-azul",
    titleHover: "group-hover:text-rimec-azul",
  },
  bazzar: {
    border: "border-bazzar-naranja-dark",
    summaryHover: "hover:bg-bazzar-naranja/10",
    titleClass: "text-bazzar-naranja-dark",
    cardBorder: "border-bazzar-naranja/20 hover:border-bazzar-naranja-dark",
    titleHover: "group-hover:text-bazzar-naranja",
  },
  "bazzar-web": {
    border: "border-[#1E3A5F]",
    summaryHover: "hover:bg-slate-50",
    titleClass: "",
    cardBorder: "",
    titleHover: "",
  },
};

function HubAccordion({
  group,
  modules,
  rolId,
}: {
  group: Exclude<ReportHubGroup, "recursos">;
  modules: typeof REPORT_HUB_MODULES;
  rolId: number;
}) {
  const router = useRouter();
  if (modules.length === 0) return null;
  const meta = REPORT_HUB_GROUP_META[group];
  const st = GROUP_STYLES[group];
  const isWeb = group === "bazzar-web";

  return (
    <details open className={`group rounded-2xl border-3 ${st.border} bg-card-bg shadow-lg transition-all hover:shadow-xl`}>
      <summary className={`cursor-pointer bg-card-bg px-6 py-4 rounded-t-2xl transition-all ${st.summaryHover}`}>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-xl">
            <span>{meta.icon}</span>
            <span
              className={`font-bold ${st.titleClass}`}
              style={isWeb ? { color: WEB_NAVY } : undefined}
            >
              {meta.label}
            </span>
            <span
              className="text-sm font-normal opacity-70"
              style={isWeb ? { color: WEB_NAVY } : undefined}
            >
              ({modules.length} módulos)
            </span>
          </span>
          <span className="text-sm opacity-80" style={isWeb ? { color: WEB_NAVY } : undefined}>
            Roles: {roleLabel(rolId)}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">{meta.moria}</p>
      </summary>
      <div
        className={`grid gap-4 p-6 bg-card-bg rounded-b-2xl ${
          group === "bazzar" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            onMouseEnter={() => {
              if (mod.href === "/rimec") void prefetchSalesReportSnapshot();
              if (mod.href === "/ventas-fotos") router.prefetch("/ventas-fotos");
            }}
            onFocus={() => {
              if (mod.href === "/rimec") void prefetchSalesReportSnapshot();
              if (mod.href === "/ventas-fotos") router.prefetch("/ventas-fotos");
            }}
            className={`group block rounded-xl border-2 bg-card-bg p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] ${
              isWeb ? "" : st.cardBorder
            }`}
            style={isWeb ? { borderColor: `${WEB_NAVY}33` } : undefined}
          >
            <div className="mb-3 text-3xl transition-transform group-hover:scale-110">{mod.icon}</div>
            <h2
              className={`mb-2 font-serif text-lg font-semibold transition-colors ${st.titleHover}`}
              style={isWeb ? { color: WEB_NAVY } : undefined}
            >
              {mod.title}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-700">{mod.description}</p>
            {mod.href === "/rimec" ? <SalesReportHubStatus /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}

function roleLabel(rolId: number): string {
  if (rolId === 1) return "1 (Admin)";
  if (rolId === 2) return "2 (Bazzar)";
  if (rolId === 3) return "3 (Vendedor)";
  return String(rolId);
}

export default function HomePage() {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [enteCodigo, setEnteCodigo] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          const userRolId = data.user.rol_id || 1;
          setRolId(userRolId);
          setCategoria(data.user.categoria || "ADMIN");
          setEnteCodigo(
            data.user.ente_codigo != null ? Number(data.user.ente_codigo) : null,
          );
          if (userRolId === 2) router.replace("/retail");
          else if (userRolId === 3) router.replace("/ventas-fotos");
          else if (userRolId === 1) {
            void prefetchSalesReportSnapshot();
            router.prefetch("/rimec");
          }
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (rolId === null || categoria === null) return;
    const canDios = canAccessAprobaciones(rolId, categoria);
    const visible = filterHubModules(REPORT_HUB_MODULES, rolId, categoria, canDios, enteCodigo);
    if (visible.some((m) => m.href === "/rimec")) {
      void prefetchSalesReportSnapshot();
      router.prefetch("/rimec");
    }
  }, [rolId, categoria, enteCodigo, router]);

  if (rolId === null || categoria === null || rolId === 2 || rolId === 3) {
    return null;
  }

  const canDios = canAccessAprobaciones(rolId, categoria);
  const visible = filterHubModules(REPORT_HUB_MODULES, rolId, categoria, canDios, enteCodigo);
  const rimecModules = modulesByGroup(visible, "rimec");
  const bazzarModules = modulesByGroup(visible, "bazzar");
  const bazzarWebModules = modulesByGroup(visible, "bazzar-web");
  const recursosModules = modulesByGroup(visible, "recursos");

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusHeaderZen />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12 text-center group cursor-default">
          <h1 className="font-serif text-5xl font-light text-neutral-800 mb-4 transition-all duration-300 group-hover:scale-105">
            RIMEC Holding
          </h1>
          <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100">
            <p className="text-lg text-neutral-700 max-w-2xl mx-auto py-2">
              Tres entes · RIMEC importadora · BAZZAR tiendas · BAZZAR WEB e-commerce
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <HubAccordion group="rimec" modules={rimecModules} rolId={rolId} />
          <HubAccordion group="bazzar" modules={bazzarModules} rolId={rolId} />
          <HubAccordion group="bazzar-web" modules={bazzarWebModules} rolId={rolId} />

          {recursosModules.length > 0 && (
            <div className="rounded-2xl border-2 border-neutral-300 bg-white p-6 shadow-lg">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-ink-muted">
                Recursos adicionales
              </h3>
              <p className="mb-4 text-xs text-neutral-500">Documentación · no operación diaria</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recursosModules.map((mod) => (
                  <Link
                    key={mod.href}
                    href={mod.href}
                    className="group block rounded-xl border-2 border-neutral-300 bg-neutral-50 p-5 shadow-sm transition-all hover:shadow-lg hover:border-bazzar-naranja hover:-translate-y-0.5"
                  >
                    <div className="mb-3 text-3xl">{mod.icon}</div>
                    <h2 className="mb-2 font-serif text-lg font-semibold text-neutral-ink group-hover:text-bazzar-naranja transition-colors">
                      {mod.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-ink-muted">{mod.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-16 text-center text-xs text-neutral-600">
          Acceso restringido · Solo usuarios autorizados
        </footer>
      </main>

      <ReportFooter />
    </div>
  );
}
