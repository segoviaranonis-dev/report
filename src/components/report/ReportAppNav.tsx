"use client"

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ReportNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "informes";

const base = "underline decoration-report-paper/40 underline-offset-4 hover:opacity-90";
const activeClass = "font-semibold underline decoration-report-paper underline-offset-4";

type Props = {
  active: ReportNavKey;
  title?: string;
  maxWidthClass?: string;
};

type NavItem = {
  key: ReportNavKey;
  href: string;
  label: string;
  roles: number[]; // Roles permitidos
};

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/", label: "Portada", roles: [1] },
  { key: "rimec", href: "/rimec", label: "RIMEC — ventas", roles: [1] },
  { key: "retail", href: "/retail", label: "Stock / Retail", roles: [1, 2] },
  { key: "ventas-fotos", href: "/ventas-fotos", label: "Ventas + fotos", roles: [1, 3] },
  { key: "aprobaciones", href: "/aprobaciones", label: "Aprobaciones", roles: [1] },
  { key: "informes", href: "/informes", label: "Anexo documental", roles: [1] },
];

export function ReportAppNav({ active, title, maxWidthClass = "max-w-5xl" }: Props) {
  const router = useRouter();
  const [rolId, setRolId] = useState<number>(1);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setRolId(data.user.rol_id || 1);
        }
      })
      .catch(() => setRolId(1));
  }, []);

  const navItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(rolId));

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logout:', error);
      // Forzar redirect incluso si falla
      router.push('/login');
    }
  }

  return (
    <div className="bg-report-nav text-report-paper">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs font-sans tracking-wide ${maxWidthClass}`}>
        <span className="opacity-90">{title ?? "Report · RIMEC Holding"}</span>
        <div className="flex items-center gap-4">
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {navItems.map(item => (
              <Link
                key={item.key}
                href={item.href}
                className={active === item.key ? activeClass : base}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 rounded border border-report-paper/30 px-3 py-1 text-xs hover:bg-report-paper/10 transition-colors disabled:opacity-50"
          >
            {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
