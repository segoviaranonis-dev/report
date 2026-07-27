"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { esDestinatarioAlertaAprobacion } from "@/lib/notificaciones/destinatarios";
import {
  dispararRecargaAlertas,
  notificacionesBarraDisponibles,
  permisoNotificacionBarra,
  probarNotificacionBarra,
  resetNativeNotifTracking,
  solicitarPermisoNotificacionBarra,
} from "@/lib/notificaciones/native-bar";

/**
 * Banner para aprobadores designados: activar avisos en barra del sistema.
 */
export function NotificacionBarraPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState<NotificationPermission | "unsupported">("default");
  const [activando, setActivando] = useState(false);

  const revisar = useCallback(async () => {
    if (pathname === "/login") return;
    if (!notificacionesBarraDisponibles()) return;

    const perm = permisoNotificacionBarra();
    setEstado(perm);
    if (perm === "granted" || perm === "unsupported") {
      setVisible(false);
      return;
    }

    try {
      const me = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (!me.ok) {
        setVisible(false);
        return;
      }
      const data = (await me.json()) as { user?: { name?: string } };
      if (!esDestinatarioAlertaAprobacion(data.user?.name)) {
        setVisible(false);
        return;
      }
      setVisible(perm === "default");
    } catch {
      setVisible(false);
    }
  }, [pathname]);

  useEffect(() => {
    void revisar();
  }, [revisar]);

  async function activar() {
    setActivando(true);
    const perm = await solicitarPermisoNotificacionBarra();
    setEstado(perm);
    setVisible(perm === "default");
    setActivando(false);
    if (perm === "granted") dispararRecargaAlertas();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] max-w-sm rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-sky-950">Avisos de Aprobaciones</p>
      <p className="mt-1 text-xs text-sky-900/80">
        Activá la barra de Windows para enterarte cuando confirmen un pedido en RIMEC Web aunque
        Report esté en segundo plano.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={activando}
          onClick={() => void activar()}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {activando ? "Esperando…" : "Activar avisos en barra"}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg border border-sky-300 px-3 py-1.5 text-xs text-sky-900 hover:bg-sky-100"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}

/** Botón opcional en pantalla de login (pre-sesión). */
export function ActivarBarraLoginButton() {
  const [estado, setEstado] = useState<NotificationPermission | "unsupported" | "loading">(
    "loading",
  );
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    setEstado(notificacionesBarraDisponibles() ? permisoNotificacionBarra() : "unsupported");
  }, []);

  if (estado === "loading" || estado === "unsupported") return null;

  async function activar() {
    setActivando(true);
    const perm = await solicitarPermisoNotificacionBarra();
    setEstado(perm);
    setActivando(false);
  }

  if (estado === "granted") {
    return (
      <div className="space-y-2">
        <p className="text-center text-xs text-emerald-700 font-medium">
          ✓ Avisos en barra activados en este navegador
        </p>
        <button
          type="button"
          onClick={() => {
            resetNativeNotifTracking();
            void probarNotificacionBarra();
          }}
          className="w-full rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
        >
          Probar aviso en barra Windows
        </button>
      </div>
    );
  }

  if (estado === "denied") {
    return (
      <p className="text-center text-xs text-amber-800">
        Avisos bloqueados — habilitalos en configuración del navegador (chrome://settings/content/notifications)
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={activando}
      onClick={() => void activar()}
      className="w-full rounded-lg border-2 border-dashed border-sky-400 bg-sky-50/80 px-4 py-2.5 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
    >
      {activando ? "Esperando permiso…" : "🔔 Activar avisos en barra (Aprobaciones)"}
    </button>
  );
}
