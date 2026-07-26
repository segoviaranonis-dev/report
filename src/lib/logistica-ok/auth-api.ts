import { NextResponse } from "next/server";
import { getSession, type SessionData } from "@/lib/auth/session";
import {
  puedeVerTabLogistica,
  tabsPermitidasLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";

/** Acceso base al módulo: RIMEC (rol_id=1) con al menos una pestaña ACL. */
export async function requireLogisticaOkAccess(tab?: LogisticaTabId | null) {
  const session = await getSession();
  if (!session || session.rol_id !== 1) {
    return {
      session: null as SessionData | null,
      error: NextResponse.json({ error: "RIMEC requerido (rol_id=1)" }, { status: 403 }),
    };
  }
  const cat = (session.role || "").toUpperCase().trim();
  const tabs = tabsPermitidasLogistica(cat);
  if (tabs.length === 0) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Sin pestañas Logística OK para tu categoría" },
        { status: 403 },
      ),
    };
  }
  if (tab && !puedeVerTabLogistica(tab, cat)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: `Pestaña «${tab}» no permitida para ${cat || "tu perfil"}` },
        { status: 403 },
      ),
    };
  }
  return { session, error: null, tabsPermitidas: tabs, categoria: cat };
}
