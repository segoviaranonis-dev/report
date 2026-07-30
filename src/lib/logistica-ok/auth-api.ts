import { NextResponse } from "next/server";
import { getSession, type SessionData } from "@/lib/auth/session";
import {
  puedeVerTabLogistica,
  tabsPermitidasLogistica,
  type LogisticaTabId,
} from "@/lib/logistica-ok/constants";
import {
  LOGISTICA_VENDEDOR_LANZADA,
  isVendedorRimecReport,
} from "@/lib/auth/vendedor-rimec-report";

/** Acceso: RIMEC rol 1; VENDEDOR solo si LOGISTICA_VENDEDOR_LANZADA. */
export async function requireLogisticaOkAccess(tab?: LogisticaTabId | null) {
  const session = await getSession();
  const cat = (session?.role || "").toUpperCase().trim();
  const esVendedor = Boolean(session && isVendedorRimecReport(session.rol_id, cat));
  if (esVendedor && !LOGISTICA_VENDEDOR_LANZADA) {
    return {
      session: null as SessionData | null,
      error: NextResponse.json(
        { error: "Logística Vendedor en desarrollo — acceso bloqueado" },
        { status: 403 },
      ),
      tabsPermitidas: [] as LogisticaTabId[],
      categoria: cat,
    };
  }
  const rolOk = Boolean(
    session && (session.rol_id === 1 || (esVendedor && LOGISTICA_VENDEDOR_LANZADA)),
  );
  if (!rolOk || !session) {
    return {
      session: null as SessionData | null,
      error: NextResponse.json({ error: "RIMEC requerido" }, { status: 403 }),
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
