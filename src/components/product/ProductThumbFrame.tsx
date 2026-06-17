"use client";

import { useCallback, useState } from "react";

type Props = {
  alt: string;
  candidates: string[];
  size?: number;
  className?: string;
  onClick?: () => void;
};

/**
 * Marco sagrado para thumbs en grillas/tablas — object-contain, overflow hidden, sin hover scale.
 */
export function ProductThumbFrame({
  alt,
  candidates,
  size = 56,
  className = "",
  onClick,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = candidates[idx];

  const tryNextOrFail = useCallback(() => {
    setIdx((i) => {
      if (i + 1 < candidates.length) return i + 1;
      setFailed(true);
      return i;
    });
  }, [candidates.length]);

  const boxStyle = { width: size, height: size };
  const frameClass = `relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-white p-1.5 ${className}`;

  if (!src || failed) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center justify-center text-neutral-400 ${frameClass}`}
          style={boxStyle}
          aria-label={alt}
        >
          <span className="text-lg" aria-hidden>
            📷
          </span>
        </button>
      );
    }
    return (
      <div className={`flex items-center justify-center text-neutral-400 ${frameClass}`} style={boxStyle}>
        <span className="text-lg" aria-hidden>
          📷
        </span>
      </div>
    );
  }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="block max-h-full max-w-full object-contain object-center"
      loading="lazy"
      decoding="async"
      onError={tryNextOrFail}
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (naturalWidth < 1 || naturalHeight < 1) tryNextOrFail();
      }}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${frameClass} ring-1 ring-gray-200 transition-shadow hover:ring-2 hover:ring-bazzar-naranja hover:shadow-md cursor-pointer`}
        style={boxStyle}
        aria-label={`Ampliar ${alt}`}
      >
        {img}
      </button>
    );
  }

  return (
    <div className={frameClass} style={boxStyle}>
      {img}
    </div>
  );
}
