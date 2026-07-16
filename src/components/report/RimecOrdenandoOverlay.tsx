"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  active: boolean;
  /** Etiqueta del KPI / modo (ej. Vendido CP) */
  etiqueta?: string;
};

/**
 * Overlay inmediato de ordenamiento AM · Report.
 * Entrada &lt; 0.5s (NIIF): captura visual del click KPI antes del reorden pesado.
 * Posición fixed: siempre visible aunque la grilla mida miles de filas.
 */
export function RimecOrdenandoOverlay({ active, etiqueta }: Props) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="rimec-ordenando"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-white/55 backdrop-blur-[2px]"
          role="status"
          aria-live="assertive"
          aria-busy="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="mx-4 flex max-w-sm flex-col items-center rounded-2xl border border-rimec-azul/15 bg-white px-8 py-7 shadow-lg shadow-rimec-azul/15"
          >
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-rimec-azul/25" />
              <div className="absolute inset-1 animate-rimec-orbit rounded-full border-[3px] border-transparent border-t-rimec-azul border-r-rimec-azul/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-serif text-[10px] font-bold tracking-[0.28em] text-rimec-azul">
                  RIMEC
                </span>
              </div>
            </div>
            <p className="mt-4 font-serif text-xs font-semibold uppercase tracking-[0.28em] text-rimec-azul">
              Ordenando
            </p>
            <p className="mt-2 text-center font-serif text-base font-bold text-rimec-azul-dark">
              Reordenando grilla…
            </p>
            <p className="mt-1 text-center text-xs text-neutral-600">
              {etiqueta
                ? `${etiqueta} · aguarde un momento`
                : "Aguarde un momento, por favor."}
            </p>
            <div className="mt-4 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-violet-500/70"
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16 }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
