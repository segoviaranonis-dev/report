/**
 * Tipo 1 canónico PE — Stock valorizado Excel → pilares tipo_1.
 *
 * Desambiguación ACCESORIOS:
 * - CALZADOS + señal MEDIA / COD.GRUPO d23=04 → MEDIAS
 * - confecciones / resto → ACT ROPAS (Actv. confecciones)
 */
import { codGrupoEsMedias, esMarcaMedias } from "@/lib/filtros/pe-modulo-medias";

export const PE_TIPO1_VALORIZADO_ALIASES: Readonly<Record<string, string>> = {
  "ACT ROPAS": "ACT ROPAS",
  "ACT. ROPAS": "ACT ROPAS",
  CARTERA: "CARTERAS",
  CARTERAS: "CARTERAS",
  LENTES: "LENTES",
  ANTEOJOS: "LENTES",
  OCULOS: "LENTES",
  ÓCULOS: "LENTES",
  MEDIAS: "MEDIAS",
  MEDIA: "MEDIAS",
};

export type PeTipo1ResolveSignals = {
  tipo1Raw?: string | null;
  tipo0?: string | null;
  marca?: string | null;
  cod_grupo?: string | null;
};

export function resolvePeTipo1Canon(sig: PeTipo1ResolveSignals): string {
  const raw = String(sig.tipo1Raw ?? "").trim().toUpperCase();
  const t0 = String(sig.tipo0 ?? "").trim().toUpperCase();

  if (esMarcaMedias(sig.marca) || codGrupoEsMedias(sig.cod_grupo)) return "MEDIAS";
  if (raw === "MEDIAS" || raw === "MEDIA") return "MEDIAS";

  if (raw === "ACCESORIOS") {
    if (t0 === "CALZADOS" || t0 === "CALZADO") return "MEDIAS";
    return "ACT ROPAS";
  }

  return PE_TIPO1_VALORIZADO_ALIASES[raw] ?? raw;
}

/** Alias simple sin contexto (evitar en import valorizado — usar resolvePeTipo1Canon). */
export function canonPeTipo1Valorizado(raw: string | null | undefined): string {
  return resolvePeTipo1Canon({ tipo1Raw: raw });
}
