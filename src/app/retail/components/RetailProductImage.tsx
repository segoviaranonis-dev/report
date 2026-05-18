"use client";

import { useCallback, useState } from "react";

type Props = {
  alt: string;
  candidates: string[];
  placeholderClass: string;
  /** Nombre de archivo en bucket `productos` (ej. 1122-828-5881-68592.jpg) si no hay foto. */
  searchFileName?: string | null;
};

function fileNameFromUrl(url: string): string {
  try {
    const path = url.split("/storage/v1/object/public/productos/")[1];
    return path ? decodeURIComponent(path.split("?")[0] ?? path) : url;
  } catch {
    return url;
  }
}

export function RetailProductImage({ alt, candidates, placeholderClass, searchFileName }: Props) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = candidates[idx];

  const label =
    searchFileName?.trim() ||
    (candidates[0] ? fileNameFromUrl(candidates[0]) : null) ||
    "Sin nombre (faltan códigos de los 4 pilares o NEXT_PUBLIC_SUPABASE_URL)";

  const tryNextOrFail = useCallback(() => {
    setIdx((i) => {
      if (i + 1 < candidates.length) return i + 1;
      setFailed(true);
      return i;
    });
  }, [candidates.length]);

  const onImgError = useCallback(() => {
    tryNextOrFail();
  }, [tryNextOrFail]);

  const onImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      if (naturalWidth < 1 || naturalHeight < 1) tryNextOrFail();
    },
    [tryNextOrFail],
  );

  if (!src || failed) {
    return (
      <div
        className={`relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl p-3 text-center shadow-inner ring-1 ring-black/5 ${placeholderClass}`}
        role="img"
        aria-label={alt}
      >
        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Buscando en Storage</p>
        <p className="break-all font-mono text-[11px] leading-snug text-white/90">productos/{label}</p>
      </div>
    );
  }

  return (
    <div className="flex aspect-[3/4] w-full flex-col overflow-hidden rounded-xl ring-1 ring-black/5">
      <div className="relative min-h-0 flex-1 bg-white">
        {/* <img> nativo: onError más fiable que next/image con URLs públicas de Storage */}
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain p-2"
          loading="lazy"
          decoding="async"
          onError={onImgError}
          onLoad={onImgLoad}
        />
      </div>
      <div className="shrink-0 border-t border-black/10 bg-slate-100 px-2 py-1.5 text-center">
        <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">Archivo en productos</p>
        <p className="break-all font-mono text-[10px] leading-snug text-slate-900">{label}</p>
      </div>
    </div>
  );
}
