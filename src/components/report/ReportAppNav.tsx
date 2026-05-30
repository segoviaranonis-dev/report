import Link from "next/link";

export type ReportNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "informes";

const base = "underline decoration-report-paper/40 underline-offset-4 hover:opacity-90";
const active = "font-semibold underline decoration-report-paper underline-offset-4";

type Props = {
  active: ReportNavKey;
  /** Texto izquierdo de la barra (por defecto título del holding). */
  title?: string;
  /** Ancho máximo del contenedor interior. */
  maxWidthClass?: string;
};

export function ReportAppNav({ active, title, maxWidthClass = "max-w-5xl" }: Props) {
  return (
    <div className="bg-report-navy text-report-paper">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs font-sans tracking-wide ${maxWidthClass}`}>
        <span className="opacity-90">{title ?? "RIMEC Nexus · Report (holding)"}</span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/" className={active === "home" ? active : base}>
            Portada
          </Link>
          <Link href="/rimec" className={active === "rimec" ? active : base}>
            RIMEC — ventas
          </Link>
          <Link href="/retail" className={active === "retail" ? active : base}>
            Stock / Retail
          </Link>
          <Link href="/ventas-fotos" className={active === "ventas-fotos" ? active : base}>
            Ventas + fotos
          </Link>
          <Link href="/informes" className={active === "informes" ? active : base}>
            Anexo documental
          </Link>
        </nav>
      </div>
    </div>
  );
}
