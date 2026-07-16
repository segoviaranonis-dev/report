"use client";

import { useCallback, useRef, useState } from "react";
import type { OrdenReposicionModo } from "@/lib/herramienta-reposicion/orden-compra-previa";
import { etiquetaOrdenModo } from "@/lib/herramienta-reposicion/orden-compra-previa";
import {
  despuesDePintar,
  mostrarOrdenandoInmediato,
  ocultarOrdenandoInmediato,
} from "@/components/report/rimec-ordenando-imperativo";

/**
 * Prioridad: animación al click (portal imperativo, sin re-render de grilla).
 * Luego, tras pintar (~&lt;50ms), aplica el reorden pesado.
 */
export function useOrdenReposicionConAnimacion(inicial: OrdenReposicionModo) {
  const [ordenModo, setOrdenModo] = useState<OrdenReposicionModo>(inicial);
  const [ordenUi, setOrdenUi] = useState<OrdenReposicionModo>(inicial);
  const [ordenando, setOrdenando] = useState(false);
  const seqRef = useRef(0);
  const ordenModoRef = useRef(ordenModo);
  ordenModoRef.current = ordenModo;

  const etiquetaOrden = etiquetaOrdenModo(ordenUi);

  const pedirOrden = useCallback((modo: OrdenReposicionModo) => {
    const seq = ++seqRef.current;
    const etiqueta = etiquetaOrdenModo(modo);

    // 1) Solo DOM/portal — NADA de setState aquí (evita reconciliar 9k tarjetas)
    mostrarOrdenandoInmediato(etiqueta);

    // 2) Tras paint: recién ahí tocar React / reordenar
    despuesDePintar(() => {
      if (seq !== seqRef.current) return;

      setOrdenando(true);
      setOrdenUi(modo);

      if (modo === ordenModoRef.current) {
        window.setTimeout(() => {
          if (seq !== seqRef.current) return;
          setOrdenando(false);
          ocultarOrdenandoInmediato();
        }, 280);
        return;
      }

      setOrdenModo(modo);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (seq !== seqRef.current) return;
          setOrdenando(false);
          ocultarOrdenandoInmediato();
        });
      });
    });
  }, []);

  return { ordenModo, ordenUi, ordenando, etiquetaOrden, pedirOrden };
}
