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
};

export function DepositoProductThumb({
  linea,
  referencia,
  material,
  color,
  imagenNombre,
  size = 40,
  imageCtx,
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded border border-report-rule object-cover bg-white"
      onError={() => {
        if (idx + 1 < candidates.length) setIdx(idx + 1);
      }}
    />
  );
}
