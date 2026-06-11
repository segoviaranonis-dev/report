import { getSession } from "@/lib/auth/session";
import { isNivelDios, mensajeAccesoNivelDios } from "@/lib/auth/nivel-dios";

export async function requireNivelDiosAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!isNivelDios(session)) {
    return { ok: false, error: mensajeAccesoNivelDios() };
  }
  return { ok: true };
}
