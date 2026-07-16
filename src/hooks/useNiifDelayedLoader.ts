"use client";

import { useEffect, useState } from "react";
import { NIIF_NAV_LATENCIA_MS } from "@/lib/niif/navigation-latency";

/**
 * NIIF-NAV-LAT-500: devuelve true solo si `pending` sigue activo tras el umbral.
 */
export function useNiifDelayedLoader(
  pending: boolean,
  delayMs: number = NIIF_NAV_LATENCIA_MS,
): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), delayMs);
    return () => {
      window.clearTimeout(timer);
      setShow(false);
    };
  }, [pending, delayMs]);

  return show;
}
