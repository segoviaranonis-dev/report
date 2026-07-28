import { NextResponse } from "next/server";
import { getSession, type SessionData } from "@/lib/auth/session";
import {
  puedeVerTabLogistica,
  tabsPermitidasLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";
import { isVendedorLogisticaReport } from "@/lib/logistica-ok/vendedor-usuario";

/** Acceso base: RIMEC DIOS/ADMIN/… (rol 1) o VENDEDOR legado (rol 3). */
export async function requireLogisticaOkAccess(tab?: LogisticaTabId | null) {
  const session = await getSession();
  const cat = (session?.role || "").toUpperCase().trim();
  const rolOk =
    session &&
    (session.rol_id === 1 || isVendedorLogisticaReport(session.rol_id, cat));
  if (!rolOk || !session) {
    return {
      session: null as SessionData | null,
      error: NextResponse.json({ error: "RIMEC / Vendedor requerido" }, { status: 403 }),
      tabsPermitidas: [] as LogisticaTabId[],
      categoria: "",
    };
  }
  const tabs = tabsPermitidasLogistica(cat);
  if (tabs.length === 0) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Sin pestañas Logística OK para tu categoría" },
        { status: 403 },
      ),
      tabsPermitidas: [] as LogisticaTabId[],
      categoria: cat,
    };
  }
  if (tab && !puedeVerTabLogistica(tab, cat)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: `Pestaña «${tab}» no permitida para ${cat || "tu perfil"}` },
        { status: 403 },
      ),
      tabsPermitidas: tabs,
      categoria: cat,
    };
  }
  return { session, error: null, tabsPermitidas: tabs, categoria: cat };
}
