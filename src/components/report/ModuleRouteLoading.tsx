import { RimecCargandoPantalla } from "@/components/report/RimecCargandoPantalla";
import { NexusGlobalHeader, type NexusNavKey } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { niifNavPresetForPath } from "@/lib/niif/navigation-latency";

/** Shell liviano para `loading.tsx` de módulos hub — soft nav sin pantalla blanca. */
export function ModuleRouteLoading({
  pathname,
  active = "home",
  note,
}: {
  pathname: string;
  active?: NexusNavKey;
  note?: string;
}) {
  const preset = niifNavPresetForPath(pathname);
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active={active} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <RimecCargandoPantalla
          mensaje={preset.mensaje}
          subtitulo={preset.subtitulo}
          etapas={preset.etapas}
        />
      </main>
      <ReportFooter note={note ?? "Report · cargando módulo"} />
    </div>
  );
}
