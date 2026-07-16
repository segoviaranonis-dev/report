"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { RimecOrdenandoOverlay } from "@/components/report/RimecOrdenandoOverlay";

/**
 * Portal imperativo fuera del árbol de ~9k tarjetas.
 * Evita que setState del client bloquee el paint del overlay (torpeza ~9s).
 */
let host: HTMLDivElement | null = null;
let root: Root | null = null;

function ensureRoot(): Root | null {
  if (typeof document === "undefined") return null;
  if (!host) {
    host = document.createElement("div");
    host.id = "rimec-ordenando-portal";
    document.body.appendChild(host);
    root = createRoot(host);
  }
  return root;
}

export function mostrarOrdenandoInmediato(etiqueta?: string): void {
  const r = ensureRoot();
  if (!r) return;
  // Commit sync del portal (árbol chico) → el browser puede pintar ya
  flushSync(() => {
    r.render(
      createElement(RimecOrdenandoOverlay, {
        active: true,
        etiqueta: etiqueta ?? undefined,
      }),
    );
  });
}

export function ocultarOrdenandoInmediato(): void {
  const r = ensureRoot();
  if (!r) return;
  r.render(createElement(RimecOrdenandoOverlay, { active: false }));
}

/** Espera pintura del browser (~2 frames + 1 tick) antes del trabajo sync pesado. */
export function despuesDePintar(fn: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(fn, 16);
    });
  });
}
