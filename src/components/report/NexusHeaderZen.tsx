"use client";

import Link from "next/link";
import { canAccessAprobaciones } from "@/lib/auth/nivel-dios";
import {
  filterHubModules,
  modulesByGroup,
  REPORT_HUB_GROUP_META,
  REPORT_HUB_MODULES,
  type ReportHubGroup,
} from "@/lib/report/hub-modules";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type NexusNavKey =
  | "home"
  | "rimec"
  | "retail"
  | "ventas-fotos"
  | "aprobaciones"
  | "pilares"
  | "depositos-bazzar"
  | "tablet-bazzar"
  | "proceso-importacion"
  | "compra-legal"
  | "facturacion"
  | "deposito-rimec"
  | "bazzar-web-compra"
  | "bazzar-web-deposito"
  | "bazzar-web-motor"
  | "bazzar-web-stock"
  | "informes"
  | "rrhh";

type Props = {
  active?: NexusNavKey;
  maxWidthClass?: string;
};

const WEB_NAVY = "#1E3A5F";

const HEADER_GROUP_ORDER: Exclude<ReportHubGroup, "recursos">[] = [
  "rimec",
  "bazzar",
  "bazzar-web",
];

const HEADER_STYLES: Record<
  Exclude<ReportHubGroup, "recursos">,
  { bg: string; border: string; label: string; pillActive: string; pillIdle: string }
> = {
  rimec: {
    bg: "bg-rimec-celeste-bg",
    border: "border-rimec-azul-dark",
    label: "text-rimec-azul-dark",
    pillActive: "bg-rimec-azul text-rimec-text-white shadow-lg scale-105",
    pillIdle:
      "text-rimec-azul-dark bg-card-bg border-2 border-rimec-azul/20 hover:bg-rimec-azul/10 hover:border-rimec-azul hover:scale-105",
  },
  bazzar: {
    bg: "bg-bazzar-fondo",
    border: "border-bazzar-naranja-dark",
    label: "text-bazzar-naranja-dark",
    pillActive: "bg-bazzar-naranja text-bazzar-text-white shadow-lg scale-105",
    pillIdle:
      "text-bazzar-text-dark bg-card-bg border-2 border-bazzar-naranja/20 hover:bg-bazzar-naranja/10 hover:border-bazzar-naranja hover:scale-105",
  },
  "bazzar-web": {
    bg: "bg-slate-50",
    border: "border-[#1E3A5F]",
    label: "",
    pillActive: "text-white shadow-lg scale-105",
    pillIdle: "bg-card-bg border-2 hover:scale-105 hover:shadow-md",
  },
};

export function NexusHeaderZen({ active = "home", maxWidthClass = "max-w-6xl" }: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [enteCodigo, setEnteCodigo] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setRolId(Number(data.user?.rol_id) || 0);
          setCategoria(data.user?.categoria ?? data.user?.role ?? null);
          setEnteCodigo(
            data.user?.ente_codigo != null ? Number(data.user.ente_codigo) : null,
          );
        } else {
          setRolId(null);
          setEnteCodigo(null);
        }
      })
      .catch(() => setRolId(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const canDios = rolId != null && canAccessAprobaciones(rolId, categoria);
  const visibleModules =
    rolId == null
      ? []
      : filterHubModules(REPORT_HUB_MODULES, rolId, categoria, canDios, enteCodigo);

  const headerGroups = HEADER_GROUP_ORDER.map((group) => ({
    group,
    meta: REPORT_HUB_GROUP_META[group],
    modules: modulesByGroup(visibleModules, group).filter((m) => m.shortLabel),
    styles: HEADER_STYLES[group],
  })).filter((g) => g.modules.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="nexus-nav-menu"
        className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-xl border-2 border-rimec-azul/30 bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-rimec-azul-dark shadow-lg transition hover:border-rimec-azul hover:bg-rimec-celeste-bg sm:bottom-5 sm:left-5"
      >
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
        {open ? "Ocultar menú" : "Módulos"}
      </button>

      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}

      <header
        id="nexus-nav-menu"
        className={`fixed top-0 z-50 w-full border-b-4 border-rimec-azul bg-white shadow-lg transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "-translate-y-full pointer-events-none"
        }`}
      >
        <div className={`mx-auto ${maxWidthClass}`}>
          <div className="flex items-center justify-between border-b-2 border-neutral-200 bg-gradient-to-r from-white to-rimec-celeste-bg px-6 py-4">
            <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rimec-azul shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl font-bold tracking-wide text-rimec-azul-dark transition-colors group-hover:text-rimec-azul">
                  Report
                </span>
                <span className="font-bold text-neutral-300">·</span>
                <span className="font-sans text-sm font-light uppercase tracking-wide text-neutral-500 transition-colors group-hover:text-neutral-700">
                  Holding
                </span>
              </div>
            </Link>

            {rolId != null && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg border-2 border-transparent px-4 py-2 text-xs font-semibold text-neutral-600 transition-all hover:border-semantic-error-light hover:bg-semantic-error/10 hover:text-semantic-error disabled:opacity-50"
              >
                {loggingOut ? "Saliendo..." : "× Cerrar Sesión"}
              </button>
            )}
          </div>

          <div
            className={`grid divide-x-2 divide-neutral-300 ${
              headerGroups.length >= 3
                ? "grid-cols-1 md:grid-cols-3"
                : headerGroups.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-1"
            }`}
          >
            {headerGroups.map(({ group, meta, modules, styles }) => (
              <div
                key={group}
                className={`${styles.bg} border-l-4 px-4 py-4 shadow-md md:px-6 md:py-5 ${styles.border}`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${styles.label}`}
                    style={group === "bazzar-web" ? { color: WEB_NAVY } : undefined}
                  >
                    {meta.label}
                  </span>
                  <span
                    className="text-xs font-medium opacity-70"
                    style={group === "bazzar-web" ? { color: WEB_NAVY } : undefined}
                  >
                    ({modules.length})
                  </span>
                </div>
                <nav className="flex flex-wrap gap-2">
                  {modules.map((item) => {
                    const isActive = item.navKey != null && active === item.navKey;
                    const pillClass = isActive ? styles.pillActive : styles.pillIdle;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-300 ${pillClass}`}
                        style={
                          group === "bazzar-web"
                            ? isActive
                              ? { backgroundColor: WEB_NAVY }
                              : { color: WEB_NAVY, borderColor: `${WEB_NAVY}33` }
                            : undefined
                        }
                      >
                        {item.shortLabel}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}
