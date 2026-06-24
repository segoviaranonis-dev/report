"use client";

import {
  FECHA_DE_EMBARQUE_LABEL,
  descripcionFechaEmbarque,
  quincenaSliderValue,
} from "@/lib/intencion-compra/quincena-arribo";

type Props = {
  value: number | null | undefined;
  lookup: Record<number, string>;
  disabled?: boolean;
  onChange: (sliderValue: number) => void;
};

/** Slider 0–24 · paridad Streamlit «Llegada» · label holding «FECHA DE EMBARQUE» */
export function FechaEmbarqueSlider({ value, lookup, disabled, onChange }: Props) {
  const slider = quincenaSliderValue(value);
  const desc = descripcionFechaEmbarque(slider, lookup);

  return (
    <div className="min-w-[140px]">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {FECHA_DE_EMBARQUE_LABEL}
      </label>
      <input
        type="range"
        min={0}
        max={24}
        step={1}
        value={slider}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-rimec-azul disabled:opacity-50"
        title="0 = sin definir · 1–24 = quincena del año"
      />
      <p className={`mt-1 text-xs ${slider === 0 ? "text-amber-700" : "font-medium text-rimec-azul-dark"}`}>
        {slider === 0 ? "⚠ Sin definir" : `📦 ${desc}`}
      </p>
    </div>
  );
}
