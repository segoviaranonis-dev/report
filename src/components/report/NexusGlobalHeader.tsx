"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type NexusNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "depositos-bazzar" | "tablet-bazzar" | "informes";

const baseLink = "text-xs tracking-widest uppercase text-neutral-light-55 hover:text-brand-gold hover:border-brand-gold/50 transition-all duration-300 py-1.5 border-b-2 border-transparent";
const activeLink = "text-xs tracking-widest uppercase text-brand-gold font-semibold py-1.5 border-b-2 border-brand-gold drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]";

const navItems: Array<{ key: NexusNavKey; href: string; label: string; roles: number[] }> = [
  { key: "home", href: "/", label: "Hub Comercial", roles: [1] },
  { key: "rimec", href: "/rimec", label: "RIMEC — Ventas", roles: [1] },
  { key: "retail", href: "/retail", label: "Stock / Retail", roles: [1, 2] },
  { key: "ventas-fotos", href: "/ventas-fotos", label: "Ventas + Fotos", roles: [1, 3] },
  { key: "aprobaciones", href: "/aprobaciones", label: "Aprobaciones", roles: [1] },
  { key: "depositos-bazzar", href: "/depositos-bazzar", label: "Depósitos Bazzar", roles: [1, 2] },
  { key: "tablet-bazzar", href: "/tablet-bazzar", label: "Tablet Bazzar", roles: [1, 2] },
  { key: "informes", href: "/informes", label: "Anexo Documental", roles: [1] },
];

type Props = {
  active?: NexusNavKey;
  title?: string;
  maxWidthClass?: string;
};

export function NexusGlobalHeader({ active = "home", title, maxWidthClass = "max-w-5xl" }: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRolId(data?.authenticated ? Number(data.user?.rol_id) || 0 : null))
      .catch(() => setRolId(null));
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

  const visibleNav = rolId == null ? [] : navItems.filter((item) => item.roles.includes(rolId));

  return (
    <header className="sticky top-0 z-50 w-full bg-neutral-950 border-b border-neutral-800">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 ${maxWidthClass}`}>
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-widest text-neutral-light hover:opacity-90 transition-opacity">
            NEXUS <span className="text-brand-gold font-sans">·</span> <span className="font-sans text-xs font-light text-neutral-light-55 tracking-widest uppercase">Report</span>
          </Link>
          {title && (
            <span className="text-xs text-neutral-light-40 border-l border-neutral-800 pl-3 uppercase tracking-widest hidden sm:inline">
              {title}
            </span>
          )}
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {visibleNav.map((item) => (
            <Link key={item.key} href={item.href} className={active === item.key ? activeLink : baseLink}>
              {item.label}
            </Link>
          ))}
          {rolId != null ? (
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-light-88 transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-50"
            >
              {loggingOut ? "Saliendo..." : "Cerrar sesión"}
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
