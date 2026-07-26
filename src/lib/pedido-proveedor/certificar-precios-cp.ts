import type { Pool } from "pg";

export type CertificacionPreciosCp = {
  ok: boolean;
  ts: string;
  pp_ids: number[];
  gates: {
    G1_ppd_sin_lpn: number;
    G2_web_vs_ppd: number;
    G3_ppd_vs_listado_canon: number;
    G4_fi_vs_ppd: number;
    G5_carrito_vs_web: number;
    G6_vista_solo_ppd: boolean;
    G7_ppd_vs_listado_lpc?: number;
    G8_fantasma_lpn_only?: number;
  };
};

export async function certificarPreciosCpRimec(
  pool: Pool,
  ppId?: number,
): Promise<CertificacionPreciosCp> {
  const { rows } = await pool.query<{ certificar_precios_cp_rimec: CertificacionPreciosCp }>(
    `SELECT certificar_precios_cp_rimec($1) AS certificar_precios_cp_rimec`,
    [ppId ?? null],
  );
  const raw = rows[0]?.certificar_precios_cp_rimec;
  if (!raw) {
    return {
      ok: false,
      ts: new Date().toISOString(),
      pp_ids: [],
      gates: {
        G1_ppd_sin_lpn: -1,
        G2_web_vs_ppd: -1,
        G3_ppd_vs_listado_canon: -1,
        G4_fi_vs_ppd: -1,
        G5_carrito_vs_web: -1,
        G6_vista_solo_ppd: false,
        G7_ppd_vs_listado_lpc: -1,
        G8_fantasma_lpn_only: -1,
      },
    };
  }
  return raw;
}

export function formatCertificacionPreciosCp(c: CertificacionPreciosCp): string {
  if (c.ok) {
    const drift = (c as CertificacionPreciosCp & { listado_drift?: number }).listado_drift;
    if (drift && drift > 0) return `CERTIFICADO OK — integridad venta PASS · aviso listado drift ${drift}`;
    return "CERTIFICADO OK — integridad venta 8/8 PASS";
  }
  const g = c.gates;
  const fails: string[] = [];
  if (g.G1_ppd_sin_lpn > 0) fails.push(`G1 sin LPN: ${g.G1_ppd_sin_lpn}`);
  if (g.G2_web_vs_ppd > 0) fails.push(`G2 Web≠PPD: ${g.G2_web_vs_ppd}`);
  if (g.G3_ppd_vs_listado_canon > 0) fails.push(`G3 PPD≠listado: ${g.G3_ppd_vs_listado_canon}`);
  if (g.G4_fi_vs_ppd > 0) fails.push(`G4 FI≠PPD: ${g.G4_fi_vs_ppd}`);
  if (g.G5_carrito_vs_web > 0) fails.push(`G5 carrito≠Web: ${g.G5_carrito_vs_web}`);
  if (!g.G6_vista_solo_ppd) fails.push("G6 vista usa pl.lpn");
  if ((g.G7_ppd_vs_listado_lpc ?? 0) > 0) fails.push(`G7 LPC≠listado: ${g.G7_ppd_vs_listado_lpc}`);
  if ((g.G8_fantasma_lpn_only ?? 0) > 0) fails.push(`G8 LPN-only ghost: ${g.G8_fantasma_lpn_only}`);
  return `CERTIFICADO FAIL — ${fails.join(" · ")}`;
}
