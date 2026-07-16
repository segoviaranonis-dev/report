import Link from "next/link";
import { redirect } from "next/navigation";
import { isNivelDios, mensajeAccesoNivelDios, UI_NIVEL_SUPERIOR } from "@/lib/auth/nivel-dios";
import { getSession } from "@/lib/auth/session";
import { IMPORTACION_PRECIOS, MOTOR_PRECIOS } from "@/lib/report/routes";

export const dynamic = "force-dynamic";

/**
 * Pasos 0–5 del protocolo Importación de precios — solo Nivel Dios.
 */
export default async function ImportacionPreciosNuevoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800">{UI_NIVEL_SUPERIOR}</p>
        <h1 className="mt-2 font-serif text-2xl text-rimec-azul-dark">Protocolo bloqueado</h1>
        <p className="mt-3 text-sm text-slate-600">{mensajeAccesoNivelDios()}</p>
        <p className="mt-2 text-xs text-slate-500">
          Ejecutar importación de precios (Pasos 0–5) requiere perfil de máximo nivel autorizado.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={IMPORTACION_PRECIOS}
            className="rounded-xl border border-rimec-azul px-4 py-2 text-sm font-semibold text-rimec-azul"
          >
            ← Hub importación
          </Link>
          <Link
            href={MOTOR_PRECIOS}
            className="rounded-xl bg-rimec-azul px-4 py-2 text-sm font-semibold text-white"
          >
            Motor de precios
          </Link>
        </div>
      </div>
    );
  }

  if (!session) redirect("/login");

  return children;
}
