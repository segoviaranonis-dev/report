export type RatificarFiApiResult = {
  ok: boolean;
  error?: string;
  n_fi?: number;
  fi_total?: number;
  fi_borradas?: number;
  brands_reparados?: number;
  integridad?: { fi_multi_marca: number; fi_multi_caso: number };
  avisos?: string[];
  plan?: {
    n_ic: number;
    n_jobs: number;
    ic_sin_fi: { nro: string; id_cliente: number; pares: number }[];
  };
};

export async function ejecutarRatificarFiProgramado(
  ppId: number,
  regenerar: boolean,
): Promise<RatificarFiApiResult> {
  const res = await fetch(`/api/proceso-importacion/pedido-proveedor/${ppId}/ratificar-fi-programado`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regenerar }),
  });
  const data = (await res.json()) as RatificarFiApiResult;
  if (!res.ok) {
    throw new Error(data.error ?? "Error al generar FI programadas");
  }
  return data;
}

export function resumenRatificarFi(data: RatificarFiApiResult): string {
  const parts = [
    `${data.n_fi ?? 0} FI creadas`,
    data.integridad ? `0 multi-marca · 0 multi-caso` : null,
    data.plan?.ic_sin_fi.length ? `${data.plan.ic_sin_fi.length} IC sin FI (gap proforma)` : null,
    data.avisos?.length ? `${data.avisos.length} avisos` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
