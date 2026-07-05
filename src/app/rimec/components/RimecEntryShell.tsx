"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/LoadingState";

type Props = {
  message?: string;
  variant?: "main" | "full";
};

const LOAD_STAGES = [
  "Conectando con la base operativa…",
  "Leyendo v_ventas_pivot…",
  "Calculando KPIs ejecutivos…",
  "Armando evolución mensual…",
  "Preparando dashboard…",
];

const TARGET_MS = 1000;

function useLoaderProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - started;
      const t = Math.min(1, elapsed / TARGET_MS);
      const eased = 1 - (1 - t) ** 2.2;
      setProgress(Math.min(96, eased * 96));
      setStageIndex(Math.min(LOAD_STAGES.length - 1, Math.floor(elapsed / 200)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return { progress, stage: LOAD_STAGES[stageIndex] };
}

function RimecLoaderHero({ message }: { message: string }) {
  const { progress, stage } = useLoaderProgress(true);

  return (
    <div className="relative overflow-hidden border-b border-rimec-azul/10 bg-gradient-to-r from-white via-rimec-azul/[0.03] to-white px-6 py-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,43,78,0.06),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center gap-6">
        <div className="relative h-16 w-16 shrink-0">
          <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-rimec-azul/15" />
          <div className="absolute inset-1 animate-rimec-orbit rounded-full border-2 border-transparent border-t-rimec-azul border-r-rimec-azul/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-[11px] font-bold tracking-widest text-rimec-azul">RIMEC</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-serif text-xs font-semibold uppercase tracking-[0.28em] text-rimec-azul">
            Sales Report
          </p>
          <motion.p
            key={stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-1 text-sm text-neutral-ink-medium"
          >
            {stage}
          </motion.p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-ink-muted">{message}</p>
        </div>

        <div className="w-full min-w-[200px] sm:w-48">
          <div className="mb-1 flex justify-between text-[10px] tabular-nums text-rimec-azul/80">
            <span>Sincronizando</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-rimec-azul/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rimec-azul via-rimec-azul-light to-rimec-azul"
              style={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="rounded-xl border border-rimec-azul/10 bg-app-bg/60 p-4"
          >
            <Skeleton className="mb-3 h-3 w-24 animate-rimec-shimmer bg-rimec-azul/10" />
            <Skeleton className="h-8 w-full max-w-[180px] animate-rimec-shimmer bg-rimec-azul/10" />
          </motion.div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="flex min-h-[320px] flex-col rounded-xl border border-rimec-azul/10 bg-app-bg/40 p-4"
        >
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-lg bg-rimec-azul/[0.04]">
            <div className="absolute inset-0 animate-rimec-shimmer bg-gradient-to-r from-transparent via-rimec-azul/10 to-transparent" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 origin-bottom rounded-t bg-rimec-azul/20 animate-rimec-bar-rise"
                style={{
                  left: `${8 + i * 14}%`,
                  width: "9%",
                  height: `${28 + (i % 3) * 18}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex min-h-[320px] flex-col items-center rounded-xl border border-rimec-azul/10 bg-app-bg/40 p-6"
        >
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="relative mb-6 h-40 w-40">
            <div className="absolute inset-0 animate-spin-slow rounded-full border-[3px] border-rimec-azul/10" />
            <div
              className="absolute inset-2 rounded-full border-[6px] border-rimec-azul/15 border-t-rimec-azul animate-rimec-gauge-spin"
              style={{ borderRightColor: "rgba(0,43,78,0.35)" }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-serif text-2xl font-bold text-rimec-azul/40">
              …
            </div>
          </div>
          <Skeleton className="h-3 w-48" />
        </motion.div>
      </div>
    </div>
  );
}

export function RimecEntryShell({ message = "Calculando informe…", variant = "main" }: Props) {
  if (variant === "main") {
    return (
      <motion.div
        className="flex h-full flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <RimecLoaderHero message={message} />
        <DashboardSkeleton />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg font-sans text-neutral-ink">
      <div className="border-b border-rimec-azul/15 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
      <div className="flex h-[calc(100vh-72px)] gap-6 p-6">
        <aside className="hidden w-[300px] shrink-0 flex-col gap-4 rounded-2xl border border-rimec-azul/15 bg-white p-6 shadow-sm md:flex">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-auto h-12 w-full" />
        </aside>
        <main className="flex-1 overflow-hidden rounded-2xl bg-white shadow-sm">
          <RimecEntryShell message={message} variant="main" />
        </main>
      </div>
    </div>
  );
}
