import Link from "next/link";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { EjecutarProtocoloImportacionPreciosButton } from "@/components/motor-precios/EjecutarProtocoloImportacionPreciosButton";
import { UI_NIVEL_SUPERIOR } from "@/lib/auth/nivel-dios";
import { IMPORTACION_PRECIOS_HISTORIAL, MOTOR_PRECIOS } from "@/lib/report/routes";

export const dynamic = "force-dynamic";

export default function ImportacionPreciosHubPage() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="proceso-importacion" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href={MOTOR_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-rimec-azul/70">
          2.3.1.7.2 · Corazón 2
        </p>
        <h1 className="mt-2 font-serif text-3xl text-rimec-azul-dark">Importación de precios</h1>
        <p className="mt-2 text-sm text-slate-600">
          Excel proveedor + biblioteca → Preview → Conversión → Cierre. Sin intentos en historial hasta
          cerrar.
        </p>
        <p className="mt-3 text-xs font-semibold text-amber-900">
          Ejecutar protocolo = solo {UI_NIVEL_SUPERIOR}. Historial: Admin RIMEC.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <EjecutarProtocoloImportacionPreciosButton />
          <Link
            href={IMPORTACION_PRECIOS_HISTORIAL}
            className="inline-flex rounded-xl border-2 border-rimec-azul px-6 py-3 text-sm font-bold text-rimec-azul hover:bg-rimec-azul/5"
          >
            Historial listas · 🔒 / 🗑️
          </Link>
        </div>
      </main>
      <ReportFooter note="Importación precios · hub" />
    </div>
  );
}
