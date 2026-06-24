"use client";

import { useEffect, useState } from "react";

export type MarcaOption = { id: number; label: string };

export function useMarcasPorTipo(tipoId: number | null, proveedorId?: number | "" | null) {
  const [marcas, setMarcas] = useState<MarcaOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tipoId) {
      setMarcas([]);
      return;
    }
    const qs = new URLSearchParams({ tipo_id: String(tipoId) });
    if (proveedorId && Number(proveedorId) > 0) {
      qs.set("proveedor_id", String(proveedorId));
    }
    setLoading(true);
    fetch(`/api/proceso-importacion/intencion-compra/marcas?${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setMarcas(d.marcas ?? []))
      .catch(() => setMarcas([]))
      .finally(() => setLoading(false));
  }, [tipoId, proveedorId]);

  return { marcas, loading };
}
