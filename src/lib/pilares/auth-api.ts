import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function requirePilaresAdmin() {
  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return { session: null, error: NextResponse.json({ error: "RIMEC Admin requerido (rol_id=1)" }, { status: 403 }) };
  }
  return { session, error: null };
}
