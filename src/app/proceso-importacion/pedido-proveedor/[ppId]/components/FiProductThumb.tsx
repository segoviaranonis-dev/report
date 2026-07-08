"use client";

import { useState } from "react";

type Props = {
  candidates: string[];
  alt: string;
};

/** Miniatura FI — tier sm, object-contain, contenedor fijo (POLITICA_THUMBNAILS). */
export function FiProductThumb({ candidates, alt }: Props) {
  const [idx, setIdx] = useState(0);
  const src = candidates[idx] ?? "";
  const box = "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white";

  if (!candidates.length) {
    return (
      <div className={`${box} border-dashed bg-slate-100 text-[9px] font-bold uppercase text-slate-400`}>
        Sin foto
      </div>
    );
  }

  return (
    <div className={box}>
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => {
          if (idx + 1 < candidates.length) setIdx((i) => i + 1);
        }}
      />
    </div>
  );
}
