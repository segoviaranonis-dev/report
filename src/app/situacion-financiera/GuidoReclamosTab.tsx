"use client";

import {
  countByEstado,
  getReclamosCatalog,
  listReclamos,
  type ReclamoSitFinEstado,
} from "@/lib/situacion-financiera/reclamos";

const ESTADO_STYLE: Record<
  ReclamoSitFinEstado,
  { bg: string; label: string }
> = {
  abierto: { bg: "bg-amber-50 border-amber-200 text-amber-900", label: "Abierto" },
  en_curso: { bg: "bg-sky-50 border-sky-200 text-sky-900", label: "En curso" },
  diferido: {
    bg: "bg-orange-50 border-orange-200 text-orange-900",
    label: "Diferido (Guido)",
  },
  verificado_canon: {
    bg: "bg-indigo-50 border-indigo-200 text-indigo-900",
    label: "Verificado canon",
  },
  verificado_txt: {
    bg: "bg-teal-50 border-teal-200 text-teal-900",
    label: "Verificado TXT",
  },
  esperando_guido: {
    bg: "bg-violet-50 border-violet-300 text-violet-900",
    label: "Esperando Guido",
  },
  cerrado: {
    bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
    label: "Cerrado",
  },
  no_aplica_sf_al: {
    bg: "bg-slate-100 border-slate-300 text-slate-700",
    label: "No aplica SF AL",
  },
};

export function GuidoReclamosTab() {
  const catalog = getReclamosCatalog();
  const reclamos = listReclamos();
  const resumen = countByEstado();

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-[#1F4E79]/30 bg-[#1F4E79]/5 p-4">
        <p className="text-sm font-semibold text-[#1F4E79]">
          Registro de reclamos · Sit Fin · entorno 2.3.1.50.31
        </p>
        <p className="mt-1 text-xs text-slate-600">
          <strong>Reclamo ≠ bug.</strong> Observaciones de canon financiero (Guido).
          Los bugs técnicos van a{" "}
          <code className="rounded bg-white px-1">protocolo_errores</code>.
        </p>
        {catalog.meta.esperandoRespuestaGuido ? (
          <p className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
            ⏳ Esperando respuesta de Guido desde {catalog.meta.esperandoDesde}{" "}
            · lote Excel 08 comentarios · doc{" "}
            <code className="rounded bg-white px-1">50.30</code>
          </p>
        ) : null}
      </div>

      <section className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="bg-slate-100 text-left uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Doc</th>
              <th className="px-3 py-2">Deploy</th>
            </tr>
          </thead>
          <tbody>
            {reclamos.map((r) => {
              const st = ESTADO_STYLE[r.estado];
              return (
                <tr key={r.code} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-[11px]">{r.code}</td>
                  <td className="px-3 py-2 font-medium">{r.conceptoSitFin}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 ${st.bg}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{r.docChusar ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                    {r.commitDeploy ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
          Resumen: {resumen.cerrado} cerrados · {resumen.esperando_guido} esperando
          Guido · {resumen.en_curso} en curso · {resumen.abierto} abiertos
        </p>
      </section>

      {reclamos
        .filter((r) => r.loteId === "excel-08-comentarios-0308")
        .map((r) => {
          const st = ESTADO_STYLE[r.estado];
          return (
            <article
              key={r.code}
              className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <span className="font-mono text-[10px] text-rimec-azul">
                    {r.code}
                  </span>
                  <h3 className="font-serif text-lg text-slate-900">
                    {r.conceptoSitFin}
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
                  {r.textoReclamo}
                </Block>
                {r.evidencia ? (
                  <p className="text-xs text-slate-500">
                    Evidencia: {r.evidencia}
                  </p>
                ) : null}
                {r.reglaCanon ? (
                  <Block title="Regla canon" tone="neutral">
                    {r.reglaCanon}
                  </Block>
                ) : null}
                {r.nexusAntes ? (
                  <Block title="Qué hacía Nexus" tone="warn">
                    {r.nexusAntes}
                  </Block>
                ) : null}
                {r.nexusDespues ? (
                  <Block title="Después (Ola 2)" tone="ok">
                    {r.nexusDespues}
                  </Block>
                ) : null}
                {r.respuestaNexus ? (
                  <Block title="Respuesta Nexus" tone="ok">
                    {r.respuestaNexus}
                  </Block>
                ) : null}
                {r.accionNexus ? (
                  <Block title="Acción" tone="action">
                    {r.accionNexus}
                  </Block>
                ) : null}
              </div>
            </article>
          );
        })}

      {catalog.meta.observacionFinal ? (
        <footer className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Observación final Guido</p>
          <p className="mt-2 italic">{catalog.meta.observacionFinal}</p>
          <p className="mt-3 text-xs text-slate-500">
            Catálogo:{" "}
            <code className="rounded bg-white px-1">
              src/lib/situacion-financiera/reclamos/catalog.json
            </code>
            {" · "}
            API:{" "}
            <code className="rounded bg-white px-1">
              GET /api/situacion-financiera/reclamos
            </code>
          </p>
        </footer>
      ) : null}
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
