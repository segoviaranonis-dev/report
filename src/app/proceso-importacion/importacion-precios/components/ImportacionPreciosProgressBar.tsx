"use client";

const PASOS = ["Carga", "Memoria", "Casos", "Preview", "Validación", "Cierre"] as const;

type Props = {
  pasoActivo?: number;
};

export function ImportacionPreciosProgressBar({ pasoActivo = 0 }: Props) {
  return (
    <div className="grid grid-cols-6 gap-1 sm:gap-2">
      {PASOS.map((label, i) => {
        const activo = i === pasoActivo;
        const hecho = i < pasoActivo;
        return (
          <div
            key={label}
            className={`rounded-md px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide sm:text-xs ${
              activo
                ? "bg-rimec-azul text-white shadow-md"
                : hecho
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-300 text-slate-600"
            }`}
          >
            {i}. {label}
          </div>
        );
      })}
    </div>
  );
}
