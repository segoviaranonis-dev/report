/** Máx. caracteres visibles en tarjeta expandida (cadena o cliente). */
export const ETIQUETA_COMPRADOR_MAX = 28;

export type VentaCompradorLinea = {
  etiqueta: string;
  pares: number;
};

export function truncarEtiquetaComprador(texto: string, max = ETIQUETA_COMPRADOR_MAX): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Sin cadena: primeros dos tokens del nombre (descripción larga). */
export function primerosDosNombresCliente(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}

/**
 * Cadena activa manda; si no hay cadena → dos primeros nombres del cliente.
 * Prohibido S/C o «sin cadena» — siempre nombre real truncado.
 */
export function etiquetaComprador(
  cadena: string | null | undefined,
  clienteDesc: string,
  max = ETIQUETA_COMPRADOR_MAX,
): string {
  const cad = cadena?.trim();
  if (cad) return truncarEtiquetaComprador(cad, max);
  const cliente = clienteDesc?.trim();
  if (!cliente) return "—";
  return truncarEtiquetaComprador(primerosDosNombresCliente(cliente), max);
}

export function moleculeKeyVentas(
  linea: string,
  referencia: string,
  material: string,
  color: string,
): string {
  return `${String(linea ?? "").trim()}-${String(referencia ?? "").trim()}-${String(material ?? "").trim()}-${String(color ?? "").trim()}`;
}

export function agregarVentasPorComprador(
  rows: {
    linea: string;
    referencia: string;
    material_code: string;
    color_code: string;
    cadena: string | null;
    cliente: string;
    pares: number;
  }[],
): Map<string, VentaCompradorLinea[]> {
  const acc = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const mol = moleculeKeyVentas(r.linea, r.referencia, r.material_code, r.color_code);
    const etiqueta = etiquetaComprador(r.cadena, r.cliente);
    const bucket = acc.get(mol) ?? new Map<string, number>();
    bucket.set(etiqueta, (bucket.get(etiqueta) ?? 0) + r.pares);
    acc.set(mol, bucket);
  }

  const out = new Map<string, VentaCompradorLinea[]>();
  for (const [mol, bucket] of acc) {
    const lines = [...bucket.entries()]
      .map(([etiqueta, pares]) => ({ etiqueta, pares }))
      .filter((l) => l.pares > 0)
      .sort((a, b) => b.pares - a.pares || a.etiqueta.localeCompare(b.etiqueta, "es"));
    if (lines.length) out.set(mol, lines);
  }
  return out;
}
