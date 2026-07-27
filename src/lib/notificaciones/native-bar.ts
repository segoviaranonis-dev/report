import type { NotificacionRow } from "./types";

export const EVENTO_RECARGAR_ALERTAS = "nexus-alerta-recargar";

const OPCIONES_PERSISTENTES = {
  requireInteraction: true as const,
  silent: false as const,
};

export function dispararRecargaAlertas(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_RECARGAR_ALERTAS));
}

let swRegPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registrarServiceWorkerAlertas(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!swRegPromise) {
    swRegPromise = (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw-alertas.js", {
          scope: "/",
          updateViaCache: "none",
        });
        await reg.update();
        await navigator.serviceWorker.ready;
        return reg;
      } catch {
        return null;
      }
    })();
  }
  return swRegPromise;
}

const STORAGE_LAST_NATIVE = "nexus_report_last_native_notif_id";

export function notificacionesBarraDisponibles(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permisoNotificacionBarra(): NotificationPermission | "unsupported" {
  if (!notificacionesBarraDisponibles()) return "unsupported";
  return Notification.permission;
}

export async function solicitarPermisoNotificacionBarra(): Promise<NotificationPermission | "unsupported"> {
  if (!notificacionesBarraDisponibles()) return "unsupported";
  if (Notification.permission === "granted") {
    await registrarServiceWorkerAlertas();
    return "granted";
  }
  if (Notification.permission === "denied") return "denied";
  const perm = await Notification.requestPermission();
  if (perm === "granted") await registrarServiceWorkerAlertas();
  return perm;
}

function lastNativeId(): number | null {
  try {
    const v = sessionStorage.getItem(STORAGE_LAST_NATIVE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function setLastNativeId(id: number): void {
  try {
    sessionStorage.setItem(STORAGE_LAST_NATIVE, String(id));
  } catch {
    /* ignore */
  }
}

export type NativeBarHandlers = {
  onIngresar: (n: NotificacionRow) => void;
};

function destino(n: NotificacionRow): string {
  return n.deep_link?.trim() || "/aprobaciones?tab=pendientes";
}

async function mostrarViaServiceWorker(n: NotificacionRow, dest: string): Promise<boolean> {
  await registrarServiceWorkerAlertas();
  const reg = await navigator.serviceWorker.ready;
  if (!reg?.showNotification) return false;

  const existentes = await reg.getNotifications({ tag: `nexus-aprobacion-${n.id}` });
  existentes.forEach((x) => x.close());

  await reg.showNotification(n.titulo, {
    body: n.mensaje,
    tag: `nexus-aprobacion-${n.id}`,
    ...OPCIONES_PERSISTENTES,
    actions: [
      { action: "ingresar", title: "Ingresar → Aprobaciones" },
      { action: "cerrar", title: "Cerrar" },
    ],
    data: { url: dest, notifId: n.id },
  });
  return true;
}

function mostrarViaNotificationApi(n: NotificacionRow, handlers: NativeBarHandlers): boolean {
  const notif = new Notification(n.titulo, {
    body: n.mensaje,
    tag: `nexus-aprobacion-${n.id}`,
    ...OPCIONES_PERSISTENTES,
  });
  notif.onclose = () => {
    /* usuario cerró manualmente */
  };
  notif.onclick = () => {
    window.focus();
    notif.close();
    handlers.onIngresar(n);
  };
  return true;
}

export async function mostrarNotificacionBarraSiCorresponde(
  n: NotificacionRow,
  handlers: NativeBarHandlers,
  opts?: { forzar?: boolean },
): Promise<boolean> {
  if (!notificacionesBarraDisponibles()) return false;
  if (Notification.permission !== "granted") return false;

  const id = Number(n.id);
  const enBackground = document.hidden || !document.hasFocus();
  if (!enBackground && !opts?.forzar) return false;
  if (lastNativeId() === id && !opts?.forzar) return false;

  const dest = destino(n);

  try {
    let ok = false;
    try {
      ok = await mostrarViaServiceWorker(n, dest);
    } catch {
      ok = false;
    }
    if (!ok) ok = mostrarViaNotificationApi(n, handlers);
    if (ok && id > 0) setLastNativeId(id);
    return ok;
  } catch {
    return false;
  }
}

export async function probarNotificacionBarra(): Promise<boolean> {
  if (Notification.permission !== "granted") return false;
  const n: NotificacionRow = {
    id: -1,
    usuario_id: 0,
    tipo: "APROBACION_PENDIENTE",
    titulo: "Prueba · Aprobaciones Nexus",
    mensaje: "Debe quedar visible hasta que cierres o pulses Ingresar.",
    entidad_tipo: null,
    entidad_id: null,
    deep_link: "/aprobaciones?tab=pendientes",
    leida: false,
    created_at: new Date().toISOString(),
  };
  return mostrarNotificacionBarraSiCorresponde(n, { onIngresar: () => {} }, { forzar: true });
}

export function resetNativeNotifTracking(): void {
  try {
    sessionStorage.removeItem(STORAGE_LAST_NATIVE);
  } catch {
    /* ignore */
  }
}
