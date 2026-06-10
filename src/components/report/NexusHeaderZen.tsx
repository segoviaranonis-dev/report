"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type NexusNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "depositos-bazzar" | "tablet-bazzar" | "informes";

type Props = {
  active?: NexusNavKey;
  maxWidthClass?: string;
};

const rimecModules = [
  { key: "rimec", href: "/rimec", label: "Ventas", roles: [1] },
  { key: "ventas-fotos", href: "/ventas-fotos", label: "Ventas + Fotos", roles: [1, 3] },
  { key: "aprobaciones", href: "/aprobaciones", label: "Aprobaciones", roles: [1] },
];

const bazzarModules = [
  { key: "retail", href: "/retail", label: "Stock / Retail", roles: [1, 2] },
  { key: "depositos-bazzar", href: "/depositos-bazzar", label: "Depósitos", roles: [1, 2] },
  { key: "tablet-bazzar", href: "/tablet-bazzar", label: "Tablet", roles: [1, 2] },
];

export function NexusHeaderZen({ active = "home", maxWidthClass = "max-w-6xl" }: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const hoverRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRolId(data?.authenticated ? Number(data.user?.rol_id) || 0 : null))
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

    scheduleHide();
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

  const visibleRimec = rolId == null ? [] : rimecModules.filter((item) => item.roles.includes(rolId));
  const visibleBazzar = rolId == null ? [] : bazzarModules.filter((item) => item.roles.includes(rolId));

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
      className={`fixed top-0 z-50 w-full border-b-4 border-rimec-azul bg-white shadow-lg transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "-translate-y-[calc(100%-6px)]"
      }`}
    >
      <div className={`mx-auto ${maxWidthClass}`}>
        {/* Top Bar: Marca + Logout - Con marco y animación */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-neutral-200 bg-gradient-to-r from-white to-rimec-celeste-bg">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-rimec-azul flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl tracking-wide text-rimec-azul-dark group-hover:text-rimec-azul transition-colors font-bold">
                Report
              </span>
              <span className="text-neutral-300 font-bold">·</span>
              <span className="font-sans text-sm font-light text-neutral-500 tracking-wide uppercase group-hover:text-neutral-700 transition-colors">
                RIMEC
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

        {/* Navigation Bar: RIMEC (celeste) vs BAZZAR (naranja) - Con sombra y hover */}
        <div className="grid grid-cols-2 divide-x-2 divide-neutral-300">
          {/* RIMEC Section - Azul Marino Profundo */}
          {visibleRimec.length > 0 && (
            <div className="bg-rimec-celeste-bg px-6 py-5 border-l-4 border-rimec-azul-dark shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏢</span>
                <span className="text-xs font-bold uppercase tracking-wider text-rimec-azul-dark">
                  RIMEC
                </span>
                <span className="text-xs text-rimec-azul/70 font-medium">
                  ({visibleRimec.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleRimec.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-full transition-all duration-300 ${
                      active === item.key
                        ? "bg-rimec-azul text-rimec-text-white shadow-lg scale-105"
                        : "text-rimec-azul-dark bg-card-bg border-2 border-rimec-azul/20 hover:bg-rimec-azul/10 hover:border-rimec-azul hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* BAZZAR Section - Naranja Quemado Premium */}
          {visibleBazzar.length > 0 && (
            <div className="bg-bazzar-fondo px-6 py-5 border-r-4 border-bazzar-naranja-dark shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏪</span>
                <span className="text-xs font-bold uppercase tracking-wider text-bazzar-naranja-dark">
                  BAZZAR
                </span>
                <span className="text-xs text-bazzar-naranja/70 font-medium">
                  ({visibleBazzar.length})
                </span>
              </div>
              <nav className="flex flex-wrap gap-2">
                {visibleBazzar.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-full transition-all duration-300 ${
                      active === item.key
                        ? "bg-bazzar-naranja text-bazzar-text-white shadow-lg scale-105"
                        : "text-bazzar-text-dark bg-card-bg border-2 border-bazzar-naranja/20 hover:bg-bazzar-naranja/10 hover:text-bazzar-naranja-dark hover:border-bazzar-naranja hover:scale-105 hover:shadow-md"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
    </>
  );
}