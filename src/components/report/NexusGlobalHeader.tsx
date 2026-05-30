import Link from "next/link";

export type NexusNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "informes";

const baseLink = "text-xs tracking-widest uppercase text-slate-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all duration-300 py-1.5 border-b-2 border-transparent";
const activeLink = "text-xs tracking-widest uppercase text-[#D4AF37] font-semibold py-1.5 border-b-2 border-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]";

type Props = {
  active: NexusNavKey;
  title?: string;
  maxWidthClass?: string;
};

export function NexusGlobalHeader({ active, title, maxWidthClass = "max-w-5xl" }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#070b12]/90 border-b border-slate-800/80 backdrop-blur-xl">
      <div className={`mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 ${maxWidthClass}`}>
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg tracking-widest text-white hover:opacity-90 transition-opacity">
            NEXUS <span className="text-[#D4AF37] font-sans">·</span> <span className="font-sans text-xs font-light text-[#94a3b8] tracking-widest uppercase">Report</span>
          </Link>
          {title && (
            <span className="text-[10px] text-slate-500 border-l border-slate-800 pl-3 uppercase tracking-widest hidden sm:inline">
              {title}
            </span>
          )}
        </div>
        
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/" className={active === "home" ? activeLink : baseLink}>
            Hub Comercial
          </Link>
          <Link href="/rimec" className={active === "rimec" ? activeLink : baseLink}>
            RIMEC — Ventas
          </Link>
          <Link href="/retail" className={active === "retail" ? activeLink : baseLink}>
            Stock / Retail
          </Link>
          <Link href="/ventas-fotos" className={active === "ventas-fotos" ? activeLink : baseLink}>
            Ventas + Fotos
          </Link>
          <Link href="/informes" className={active === "informes" ? activeLink : baseLink}>
            Anexo Documental
          </Link>
        </nav>
      </div>
    </header>
  );
}
