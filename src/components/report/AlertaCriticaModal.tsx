"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { esDestinatarioAlertaAprobacion } from "@/lib/notificaciones/destinatarios";
import {
  EVENTO_RECARGAR_ALERTAS,
  mostrarNotificacionBarraSiCorresponde,
  permisoNotificacionBarra,
  registrarServiceWorkerAlertas,
} from "@/lib/notificaciones/native-bar";
import {
  deepLinkNotificacion,
  type NotificacionRow,
} from "@/lib/notificaciones/types";

const POLL_MS = 8_000;

async function marcarLeidaEnFondo(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/notificaciones/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function AlertaCriticaModal() {
  const pathname = usePathname();
  const router = useRouter();
  const [alerta, setAlerta] = useState<NotificacionRow | null>(null);
  const [sesionOk, setSesionOk] = useState(false);
  const [esAprobador, setEsAprobador] = useState(false);
  const alertaRef = useRef<NotificacionRow | null>(null);
  /** Evita que el poll reabra la misma alerta mientras el PATCH aún no marcó leída. */
  const descartadasRef = useRef<Set<number>>(new Set());
  const accionEnCursoRef = useRef(false);
  const ingresarRef = useRef<(n: NotificacionRow) => Promise<void>>(async () => {});

  const ingresar = useCallback(
    async (n: NotificacionRow) => {
      if (accionEnCursoRef.current) return;
      accionEnCursoRef.current = true;
      const dest = deepLinkNotificacion(n);
      descartadasRef.current.add(n.id);
      setAlerta(null);
      alertaRef.current = null;
      void marcarLeidaEnFondo(n.id);
      router.push(dest);
      accionEnCursoRef.current = false;
    },
    [router],
  );

  ingresarRef.current = ingresar;

  useEffect(() => {
    if (permisoNotificacionBarra() === "granted") {
      void registrarServiceWorkerAlertas();
    }
  }, []);

  const intentarBarra = useCallback(async (n: NotificacionRow) => {
    await mostrarNotificacionBarraSiCorresponde(n, {
      onIngresar: (x) => void ingresarRef.current(x),
    });
  }, []);

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      if (pathname === "/login") return;
      try {
        const me = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });
        if (!me.ok) {
          setSesionOk(false);
          setAlerta(null);
          alertaRef.current = null;
          setEsAprobador(false);
          return;
        }
        const meData = (await me.json()) as { user?: { name?: string } };
        const aprobador = esDestinatarioAlertaAprobacion(meData.user?.name);
        setEsAprobador(aprobador);
        setSesionOk(true);

        if (!aprobador) {
          setAlerta(null);
          alertaRef.current = null;
          return;
        }

        const res = await fetch("/api/notificaciones?no_leidas=true&criticas=true", {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { notificaciones?: NotificacionRow[] };
        const top =
          data.notificaciones?.find((n) => !descartadasRef.current.has(n.id)) ?? null;

        if (!top) {
          setAlerta(null);
          alertaRef.current = null;
          return;
        }

        alertaRef.current = top;
        setAlerta(top);

        if (document.hidden || !document.hasFocus()) {
          await intentarBarra(top);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    },
    [pathname, intentarBarra],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const tick = () => void cargar(ctrl.signal);

    tick();
    const t = setInterval(tick, POLL_MS);

    const onVisibility = () => {
      if (document.hidden && alertaRef.current) {
        void intentarBarra(alertaRef.current);
      }
      tick();
    };

    const onBlur = () => {
      if (alertaRef.current) void intentarBarra(alertaRef.current);
    };

    const onRecargar = () => tick();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener(EVENTO_RECARGAR_ALERTAS, onRecargar);

    return () => {
      ctrl.abort();
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener(EVENTO_RECARGAR_ALERTAS, onRecargar);
    };
  }, [cargar, intentarBarra]);

  function cerrar(id: number) {
    if (accionEnCursoRef.current) return;
    accionEnCursoRef.current = true;
    // Cierre al instante: no esperar PATCH (antes el clic “no respondía”).
    descartadasRef.current.add(id);
    setAlerta(null);
    alertaRef.current = null;
    void marcarLeidaEnFondo(id).then((ok) => {
      if (!ok) descartadasRef.current.delete(id);
      accionEnCursoRef.current = false;
    });
  }

  if (!sesionOk || !esAprobador || !alerta || pathname === "/login") return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[9998] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-md">
        <span>🔔 {alerta.titulo}</span>
        <button
          type="button"
          onClick={() => void ingresar(alerta)}
          className="rounded bg-emerald-800 px-3 py-1 text-xs text-white hover:bg-emerald-900"
        >
          Ingresar
        </button>
        <button
          type="button"
          onClick={() => void cerrar(alerta.id)}
          className="rounded border border-amber-800/40 px-2 py-0.5 text-xs hover:bg-amber-600"
        >
          Cerrar
        </button>
      </div>

      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 pt-12"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alerta-critica-titulo"
      >
        <div className="w-full max-w-md rounded-xl border border-amber-300 bg-white shadow-2xl">
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Alerta operativa
            </p>
            <h2 id="alerta-critica-titulo" className="mt-1 text-lg font-bold text-gray-900">
              {alerta.titulo}
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm leading-relaxed text-gray-700">{alerta.mensaje}</p>
            <p className="mt-2 text-xs text-gray-400">
              {new Date(alerta.created_at).toLocaleString("es-PY")}
            </p>
            <p className="mt-3 text-xs text-amber-800/90">
              La barra de Windows suena cuando Report está en segundo plano. Minimizá o cambiá de
              pestaña tras confirmar en Web.
            </p>
          </div>
          <div className="flex gap-3 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={() => void ingresar(alerta)}
              className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Ingresar → Aprobaciones
            </button>
            <button
              type="button"
              onClick={() => void cerrar(alerta.id)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
