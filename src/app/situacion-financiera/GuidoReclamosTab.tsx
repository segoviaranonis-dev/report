"use client";

import {
  OBSERVACION_FINAL_GUIDO,
  RECLAMOS_GUIDO_0308,
  type ReclamoGuidoEstado,
} from "@/lib/situacion-financiera/reclamos-guido-0308";

const ESTADO_STYLE: Record<
  ReclamoGuidoEstado,
  { bg: string; label: string }
> = {
  abierto: { bg: "bg-amber-50 border-amber-200 text-amber-900", label: "Abierto" },
  en_curso: {
    bg: "bg-sky-50 border-sky-200 text-sky-900",
    label: "En curso",
  },
  cerrado: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
    label: "Cerrado",
  },
};

export function GuidoReclamosTab() {
  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-[#1F4E79]/30 bg-[#1F4E79]/5 p-4">
        <p className="text-sm font-semibold text-[#1F4E79]">
          Reclamos Guido · Excel 08 SF AL · 01/08/2026
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Hoja <strong>Situacion Comentarios</strong> · respuesta fila por fila ·
          canon <code className="rounded bg-white px-1">2.3.1.50.30</code> · la
          opinión de Guido manda — Nexus alinea, no debate.
        </p>
      </div>

      {RECLAMOS_GUIDO_0308.map((r) => {
        const st = ESTADO_STYLE[r.estado];
        return (
          <article
            key={r.id}
            className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <span className="text-xs font-bold text-rimec-azul">
                  #{r.id}
                </span>
                <h3 className="font-serif text-lg text-slate-900">
                  {r.concepto}
                </h3>
              </div>
              <span
                className={`rounded-full border px-3 py-0.5 text-xs font-medium ${st.bg}`}
              >
                {st.label}
              </span>
            </header>
            <div className="space-y-3 px-4 py-4 text-sm">
              <Block title="Comentario Guido" tone="guido">
                {r.textoGuido}
              </Block>
              {r.captura ? (
                <p className="text-xs text-slate-500">
                  Evidencia: {r.captura}
                </p>
              ) : null}
              <Block title="Regla canon (G1–G11)" tone="neutral">
                {r.reglaCanon}
              </Block>
              <Block title="Qué hace Nexus hoy" tone="warn">
                {r.nexusHoy}
              </Block>
              <Block title="Respuesta a Guido" tone="ok">
                {r.respuesta}
              </Block>
              <Block title="Acción Nexus" tone="action">
                {r.accion}
              </Block>
            </div>
          </article>
        );
      })}

      <footer className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Observación final Guido</p>
        <p className="mt-2 italic">{OBSERVACION_FINAL_GUIDO}</p>
        <p className="mt-3 text-xs text-slate-500">
          Motor único:{" "}
          <code className="rounded bg-white px-1">
            cuadro_vencimientos_html.py
          </code>{" "}
          · intake{" "}
          <code className="rounded bg-white px-1">
            colaborador-completo-20260809
          </code>
        </p>
      </footer>
    </div>
  );
}

function Block({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "guido" | "neutral" | "warn" | "ok" | "action";
}) {
  const border =
    tone === "guido"
      ? "border-l-[#1F4E79]"
      : tone === "warn"
        ? "border-l-amber-500"
        : tone === "ok"
          ? "border-l-emerald-600"
          : tone === "action"
            ? "border-l-violet-600"
            : "border-l-slate-400";
  return (
    <div className={`border-l-4 pl-3 ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-slate-800">{children}</p>
    </div>
  );
}
