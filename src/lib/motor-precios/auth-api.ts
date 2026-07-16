import { NextResponse } from "next/server";
import { isNivelDios, mensajeAccesoNivelDios } from "@/lib/auth/nivel-dios";
import { getSession } from "@/lib/auth/session";

export async function requireMotorPreciosAdmin() {
  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return { session: null, error: NextResponse.json({ error: "RIMEC Admin requerido (rol_id=1)" }, { status: 403 }) };
  }
  return { session, error: null };
}

/** Ejecutar protocolo Importación de precios (Paso 0 carga, etc.) — solo Nivel Dios. */
export async function requireMotorPreciosNivelDios() {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: mensajeAccesoNivelDios(), code: "NIVEL_DIOS_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  return { session, error: null };
}
