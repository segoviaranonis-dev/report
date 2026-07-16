"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const DEFAULT_ETAPAS = [
  "Conectando con la base operativa…",
  "Leyendo inventario y tránsito…",
  "Calculando niveles Alejandro Magno…",
  "Preparando tarjetas de reposición…",
];

type Props = {
  mensaje?: string;
  subtitulo?: string;
  etapas?: string[];
  className?: string;
};

function useLoaderProgress(active: boolean, etapas: string[]) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - started;
      const t = Math.min(1, elapsed / 2800);
      const eased = 1 - (1 - t) ** 2.2;
      setProgress(Math.min(94, eased * 94));
      setStageIndex(Math.min(etapas.length - 1, Math.floor(elapsed / 650)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, etapas.length]);

  return { progress, stage: etapas[stageIndex] ?? etapas[0] };
}

function RimecSpinner({ size = "lg" }: { size?: "lg" | "md" }) {
  const box = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const text = size === "lg" ? "text-sm" : "text-[11px]";

  return (
    <div className={`relative ${box} shrink-0`}>
      <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-rimec-azul/20" />
      <div className="absolute inset-1 animate-rimec-orbit rounded-full border-[3px] border-transparent border-t-rimec-azul border-r-rimec-azul/35" />
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-rimec-azul/[0.06] to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className={`font-serif ${text} font-bold tracking-[0.32em] text-rimec-azul`}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          RIMEC
        </motion.span>
      </div>
    </div>
  );
}

export function RimecCargandoPantalla({
  mensaje = "Cargando…",
  subtitulo = "Aguarde unos segundos, por favor.",
  etapas = DEFAULT_ETAPAS,
  className = "",
}: Props) {
  const { progress, stage } = useLoaderProgress(true, etapas);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative overflow-hidden rounded-2xl border border-rimec-azul/12 bg-gradient-to-b from-white via-rimec-azul/[0.02] to-white px-6 py-12 sm:px-10 sm:py-14 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,43,78,0.07),transparent_65%)]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-rimec-azul/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-36 w-36 rounded-full bg-rimec-azul/[0.05] blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <RimecSpinner size="lg" />

        <p className="mt-8 font-serif text-xs font-semibold uppercase tracking-[0.35em] text-rimec-azul">
          RIMEC
        </p>

        <h2 className="mt-3 font-serif text-xl font-bold text-rimec-azul-dark sm:text-2xl">
          {mensaje}
        </h2>

        <p className="mt-2 max-w-md text-sm text-neutral-600">{subtitulo}</p>

        <motion.p
          key={stage}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-5 min-h-[1.25rem] text-xs font-medium text-rimec-azul/80"
        >
          {stage}
        </motion.p>

        <div className="mt-8 w-full max-w-xs">
          <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-rimec-azul/70">
            <span>Sincronizando</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-rimec-azul/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rimec-azul via-rimec-azul-light to-rimec-azul"
              style={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-rimec-azul/50"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
