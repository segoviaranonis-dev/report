"use client";

import { useState } from "react";
import {
  productImageCandidatesForRow,
  type ProductImageContext,
} from "@/lib/retail/product-image";

type Props = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  imagenNombre?: string | null;
  size?: number;
  /** Protocolo 654|638 vía tipo_v2 / proveedor (FK). */
  imageCtx?: ProductImageContext;
  /**
   * icon = miniatura fija (listas)
   * frame = llena el padre (aspect + overflow) con object-fit contain — LEY 2.01.04.021
   */
  variant?: "icon" | "frame";
};

export function DepositoProductThumb({
  linea,
  referencia,
  material,
  color,
  imagenNombre,
  size = 40,
  imageCtx,
  variant = "icon",
}: Props) {
  const candidates = productImageCandidatesForRow(
    linea,
    referencia,
    material,
    color,
    imagenNombre,
    "thumb",
    imageCtx,
  );
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];

  if (!src) {
    if (variant === "frame") {
      return (
        <span
          className="absolute inset-0 flex items-center justify-center bg-slate-50 text-2xl text-slate-400"
          title="Sin foto"
        >
          📷
        </span>
      );
    }
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded border border-report-rule bg-report-paper text-xs text-report-muted"
        style={{ width: size, height: size }}
        title="Sin foto"
      >
        📷
      </span>
    );
  }

  if (variant === "frame") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-contain object-center"
        onError={() => {
          if (idx + 1 < candidates.length) setIdx(idx + 1);
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded border border-report-rule object-contain bg-white"
      onError={() => {
        if (idx + 1 < candidates.length) setIdx(idx + 1);
      }}
    />
  );
}
