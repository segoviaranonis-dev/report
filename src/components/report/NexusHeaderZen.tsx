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
import { useEffect, useRef, useState } from "react";
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
  /** Oculto por defecto — no bajar en cada cambio de módulo; solo hover arriba. */
  const [visible, setVisible] = useState(false);
  const hoverRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const clearHideTimer = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    };
    const scheduleHide = () => {
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        if (!hoverRef.current) setVisible(false);
      }, 1400);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (event.clientY <= 28) {
        setVisible(true);
        scheduleHide();
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      clearHideTimer();
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

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
      <div
        className="fixed left-0 top-0 z-[60] h-4 w-full"
        onMouseEnter={() => setVisible(true)}
        aria-hidden="true"
      />
      <header
        onMouseEnter={() => {
          hoverRef.current = true;
          setVisible(true);
        }}
        onMouseLeave={() => {
          hoverRef.current = false;
          setVisible(false);
        }}
        className={`fixed top-0 z-50 w-full border-b-4 border-rimec-azul bg-white shadow-lg transition-transform duration-200 ease-out ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className={`mx-auto ${maxWidthClass}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 bg-gradient-to-r from-white to-rimec-celeste-bg">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-rimec-azul flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl tracking-wide text-rimec-azul-dark group-hover:text-rimec-azul transition-colors font-bold">
                  Report
                </span>
                <span className="text-neutral-300 font-bold">·</span>
                <span className="font-sans text-sm font-light text-neutral-500 tracking-wide uppercase group-hover:text-neutral-700 transition-colors">
                  Holding
                </span>
              </div>
            </Link>

            {rolId != null && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-semantic-error/10 hover:text-semantic-error border-2 border-transparent hover:border-semantic-error-light transition-all disabled:opacity-50"
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
                className={`${styles.bg} px-4 py-4 md:px-6 md:py-5 border-l-4 ${styles.border} shadow-md`}
              >
                <div className="flex items-center gap-2 mb-3">
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
                        className={`text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-full transition-all duration-300 ${pillClass}`}
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
