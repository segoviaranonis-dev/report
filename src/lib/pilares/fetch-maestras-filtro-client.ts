/** Cliente — maestras Estilo/Género del Administrador de Pilares (siamese AM/DPE). */

export type MaestraFiltroClientItem = { id: number; label: string };

export type MaestrasFiltroClient = {
  tipo_v2_id: 1 | 2;
  estilos: MaestraFiltroClientItem[];
  generos: MaestraFiltroClientItem[];
};

export function tipoV2IdFromRamoTipoClient(ramoTipo: string | null | undefined): 1 | 2 | null {
  const u = String(ramoTipo ?? "")
    .trim()
    .toUpperCase();
  if (u === "CALZADO" || u === "CALZADOS") return 1;
  if (u === "CONFECCIONES" || u === "CONFECCION") return 2;
  return null;
}

export async function fetchMaestrasFiltroTriangulo(
  ramoTipo: string | null | undefined,
): Promise<MaestrasFiltroClient | null> {
  const tipo = tipoV2IdFromRamoTipoClient(ramoTipo);
  if (tipo == null) return null;
  const qs = new URLSearchParams({ tipo_v2_id: String(tipo), ramo_tipo: String(ramoTipo ?? "") });
  const res = await fetch(`/api/pilares/maestras-filtro?${qs}`, { cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    estilos?: MaestraFiltroClientItem[];
    generos?: MaestraFiltroClientItem[];
    tipo_v2_id?: number;
  };
  return {
    tipo_v2_id: tipo,
    estilos: Array.isArray(j.estilos) ? j.estilos : [],
    generos: Array.isArray(j.generos) ? j.generos : [],
  };
}
