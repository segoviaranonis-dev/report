"use client";

import { useCallback, useState } from "react";

type Props = {
  alt: string;
  candidates: string[];
  placeholderClass: string;
  searchFileName?: string | null;
  /** Cuadrado tipo catálogo (RIMEC Web) vs retrato legacy */
  aspect?: "square" | "portrait";
  showFileFooter?: boolean;
};

function fileNameFromUrl(url: string): string {
  try {
    const path = url.split("/storage/v1/object/public/productos/")[1];
    return path ? decodeURIComponent(path.split("?")[0] ?? path) : url;
  } catch {
    return url;
  }
}

export function RetailProductImage({
  alt,
  candidates,
  placeholderClass,
  searchFileName,
  aspect = "square",
  showFileFooter = false,
}: Props) {
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

  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[3/4]";

  if (!src || failed) {
    return (
      <div
        className={`relative flex ${aspectClass} w-full flex-col items-center justify-center gap-2 rounded-t-2xl p-4 text-center ${placeholderClass}`}
        role="img"
        aria-label={alt}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Sin foto</p>
        <p className="break-all font-mono text-[10px] leading-snug text-slate-600">productos/{label}</p>
      </div>
    );
  }

  return (
    <div
      className={`relative grid ${aspectClass} w-full min-h-0 min-w-0 place-items-center overflow-hidden rounded-t-2xl bg-app-bg`}
    >
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-contain object-center"
        loading="lazy"
        decoding="async"
        onError={onImgError}
        onLoad={onImgLoad}
      />
      {showFileFooter ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-black/10 bg-white/90 px-2 py-1 text-center backdrop-blur-sm">
          <p className="break-all font-mono text-[9px] leading-snug text-slate-600">{label}</p>
        </div>
      ) : null}
    </div>
  );
}
