"use client";

export type ImportQueueStepStatus = "pending" | "running" | "ok" | "fail";

export type ImportQueueStep = {
  id: string;
  label: string;
  status: ImportQueueStepStatus;
  detail?: string;
};

type Props = {
  open: boolean;
  title: string;
  steps: ImportQueueStep[];
  hint?: string;
  /** Muestra pantalla de éxito antes de cerrar. */
  success?: boolean;
};

function StepIcon({ status }: { status: ImportQueueStepStatus }) {
  if (status === "running") {
    return (
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rimec-azul border-t-transparent"
        aria-hidden
      />
    );
  }
  if (status === "ok") {
    return (
      <span
        className="inline-flex h-5 w-5 animate-[scale-in_0.35s_ease-out] items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-700"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-sm text-red-700"
        aria-hidden
      >
        ✕
      </span>
    );
  }
  return <span className="text-slate-300" aria-hidden>○</span>;
}

/** Cola de importación por lotes — progreso visible + éxito (anti-timeout oficina RIMEC). */
export function ProcesoImportacionQueueOverlay({ open, title, steps, hint, success = false }: Props) {
  if (!open) return null;

  const running = steps.find((s) => s.status === "running");
  const lotSteps = steps.filter((s) => s.id.startsWith("lot-"));
  const lotsOk = lotSteps.filter((s) => s.status === "ok").length;
  const lotsTotal = lotSteps.length;
  const doneCount = steps.filter((s) => s.status === "ok").length;
  const totalSteps = steps.length;
  const pct =
    lotsTotal > 0 ? Math.round((lotsOk / lotsTotal) * 100) : totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  const analyzeStep = steps.find((s) => s.id === "analyze");
  const doneStep = steps.find((s) => s.id === "done");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]"
      role="alertdialog"
      aria-modal="true"
      aria-busy={!!running && !success}
      aria-labelledby="import-queue-title"
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes success-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes progress-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div className="mx-4 max-w-lg rounded-xl bg-white px-6 py-7 shadow-2xl animate-[scale-in_0.25s_ease-out]">
        {success && doneStep?.status === "ok" ? (
          <div className="text-center animate-[success-pop_0.5s_ease-out]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
              ✓
            </div>
            <p className="mt-4 font-serif text-xl font-bold text-emerald-800">¡Importación exitosa!</p>
            <p className="mt-2 text-sm text-slate-600">
              {lotsTotal > 0
                ? `${lotsOk}/${lotsOk} lotes completados · 100%`
                : "Proforma cargada correctamente"}
            </p>
            {analyzeStep?.detail ? (
              <p className="mt-1 text-xs text-slate-500">{analyzeStep.detail}</p>
            ) : null}
            <p className="mt-4 text-xs text-emerald-700">Cerrando en un momento…</p>
          </div>
        ) : (
          <>
            <p id="import-queue-title" className="font-serif text-lg text-rimec-azul-dark">
              {title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {running
                ? running.id.startsWith("lot-")
                  ? `Procesando lote ${running.label.replace(/.*(\d+\/\d+).*/, "$1")}… no cierres la pestaña.`
                  : `${running.label} — aguardá…`
                : "Preparando cola de importación…"}
            </p>

            {lotsTotal > 0 ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                  <span>Progreso total</span>
                  <span>{lotsOk}/{lotsTotal} lotes · {pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      running
                        ? "bg-gradient-to-r from-rimec-azul via-sky-400 to-rimec-azul bg-[length:200%_100%] animate-[progress-shimmer_1.5s_linear_infinite]"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.max(pct, running ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <ol className="mt-5 max-h-56 space-y-2 overflow-y-auto text-left text-sm">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={`flex gap-2 rounded-lg px-2 py-1.5 transition-colors duration-300 ${
                    step.status === "running"
                      ? "animate-pulse bg-sky-50 ring-1 ring-sky-200"
                      : step.status === "fail"
                        ? "bg-red-50 ring-1 ring-red-200"
                        : step.status === "ok"
                          ? "bg-emerald-50/60"
                          : ""
                  }`}
                >
                  <span className="mt-0.5 w-5 shrink-0 text-center">
                    <StepIcon status={step.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${
                        step.status === "ok"
                          ? "text-emerald-800"
                          : step.status === "fail"
                            ? "text-red-800"
                            : step.status === "running"
                              ? "text-rimec-azul-dark"
                              : "text-slate-500"
                      }`}
                    >
                      {step.label}
                      {step.status === "ok" && step.id.startsWith("lot-") ? " — 100% exitoso" : null}
                      {step.status === "running" && step.id.startsWith("lot-") ? " …" : null}
                    </p>
                    {step.detail ? <p className="text-xs text-slate-600">{step.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>

            {hint ? <p className="mt-4 text-xs text-slate-600">{hint}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
