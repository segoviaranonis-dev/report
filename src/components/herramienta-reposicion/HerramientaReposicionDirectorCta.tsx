"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type Props = {
  className?: string;
};

const RIMEC_LETTERS = ["R", "I", "M", "E", "C"] as const;

function RimecLogoAnimado() {
  return (
    <div className="relative h-20 w-20 shrink-0">
      <motion.div
        className="absolute inset-0 rounded-full border border-dashed border-white/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-1 rounded-full border-2 border-transparent border-t-amber-300 border-r-white/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-2 rounded-full bg-amber-400/10"
        animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.92, 1.06, 0.92] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-[1px]">
        {RIMEC_LETTERS.map((letter, i) => (
          <motion.span
            key={letter}
            className="font-serif text-[8px] font-black text-white"
            animate={{
              opacity: [0.45, 1, 0.45],
              y: [0, -2, 0],
              textShadow: [
                "0 0 0 rgba(251,191,36,0)",
                "0 0 12px rgba(251,191,36,0.85)",
                "0 0 0 rgba(251,191,36,0)",
              ],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.14,
            }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/**
 * CTA vanguardista — Herramienta del Director · Alejandro Magno.
 * Panel de Control → culminación reposición molecular.
 */
export function HerramientaReposicionDirectorCta({ className = "" }: Props) {
  return (
    <Link
      href="/herramienta-reposicion"
      className={`group relative mt-8 block overflow-hidden rounded-2xl border border-rimec-azul/20 bg-gradient-to-br from-[#001a33] via-rimec-azul to-[#003d6b] p-[1px] animate-rimec-card-breathe transition duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rimec-azul ${className}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl transition group-hover:bg-amber-300/25" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.15, 0.45, 0.15] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 animate-rimec-shimmer bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </motion.div>

      <div className="relative rounded-[15px] bg-gradient-to-br from-rimec-azul-dark/95 via-rimec-azul/90 to-[#002b4e]/95 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                Herramienta del Director
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
                Alejandro Magno · 2.3.1.20
              </span>
            </div>

            <h3 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Herramienta
              <br />
              <span className="bg-gradient-to-r from-amber-200 via-white to-emerald-200 bg-clip-text text-transparent">
                de reposición
              </span>
            </h3>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
              Una grilla molecular · PE + CP (disp/vend) + PROGRAMADO · niveles N1→N3 · integridad
              transferencia bancaria. El mando operativo del holding en una sola pantalla.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { l: "Pronta entrega", c: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" },
                { l: "Compra previa", c: "border-sky-300/40 bg-sky-400/15 text-sky-100" },
                { l: "Programado", c: "border-amber-300/40 bg-amber-400/15 text-amber-100" },
                { l: "N1 · N2 · N3", c: "border-violet-300/40 bg-violet-400/15 text-violet-100" },
              ].map((pill) => (
                <span
                  key={pill.l}
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pill.c}`}
                >
                  {pill.l}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
            <RimecLogoAnimado />

            <span className="mt-4 inline-flex animate-rimec-cta-pulse items-center gap-2 rounded-xl border border-amber-200/40 bg-gradient-to-r from-amber-500/25 to-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm transition group-hover:border-amber-100 group-hover:from-amber-400/35">
              Entrar al mando
              <motion.span
                aria-hidden
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                →
              </motion.span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
