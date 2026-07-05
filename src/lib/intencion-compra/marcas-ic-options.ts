import type { IcCatalogos } from "./ic-catalogos-types";

export type MarcaIcOption = { id: number; label: string };

function marcasPorTipoId(
  catalogos: IcCatalogos,
  tipoId: number,
): MarcaIcOption[] | undefined {
  const map = catalogos.marcasPorTipo;
  if (!map) return undefined;
  const direct = map[tipoId];
  if (direct?.length) return direct;
  const asRecord = map as Record<string, MarcaIcOption[] | undefined>;
  return asRecord[String(tipoId)];
}

function saneMarcas(list: MarcaIcOption[] | undefined | null): MarcaIcOption[] {
  if (!list?.length) return [];
  return list.filter((m) => Number.isFinite(m.id) && m.id > 0 && String(m.label ?? "").trim() !== "");
}

/** Opciones MARCA en IC — paridad bandeja Streamlit (marca_v2 + filtro tipo). */
export function resolveMarcasIcOptions(
  catalogos: IcCatalogos,
  tipoId: number | null | undefined,
  marcasApi: MarcaIcOption[] = [],
): MarcaIcOption[] {
  const fromApi = saneMarcas(marcasApi);
  if (fromApi.length > 0) return fromApi;

  if (tipoId) {
    const byTipo = saneMarcas(marcasPorTipoId(catalogos, tipoId));
    if (byTipo.length > 0) return byTipo;
  }

  return saneMarcas(catalogos.marcas);
}
