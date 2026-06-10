import React from "react";

type PrintHeaderProps = {
  title: string;
  subtitle?: string;
  filters?: string;
};

export function PrintHeader({ title, subtitle, filters }: PrintHeaderProps) {
  const today = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="hidden print:block mb-6 pb-4 border-b-2 border-rimec-azul/25">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              RIMEC · Report NIIF
            </span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-neutral-600">{subtitle}</p>}
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div className="font-semibold">Informe Ejecutivo</div>
          <div>{today}</div>
          <div className="mt-1 text-[10px]">Documento Confidencial</div>
        </div>
      </div>
      {filters && (
        <div className="mt-3 text-xs text-neutral-600 bg-gray-50 px-3 py-2 rounded">
          <strong>Filtros aplicados:</strong> {filters}
        </div>
      )}
    </div>
  );
}
