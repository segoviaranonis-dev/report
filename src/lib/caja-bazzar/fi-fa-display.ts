/** Formato canónico factura interna POS — `{titular} - FI_FA: {n}` */
export function titularParaFiFa(nombreCliente: string | null | undefined, cedula: string | null | undefined): string {
  const n = nombreCliente?.trim();
  if (n && !n.startsWith("CI ") && !n.startsWith("Cliente CI")) return n;
  return cedula?.trim() ? `Cliente CI ${cedula.trim()}` : "Cliente sin nombre";
}

export function formatFacturaInternaPos(input: {
  nombre_cliente?: string | null;
  cedula_cliente?: string | null;
  numero_fi_fa?: number | null;
  staging_id?: number | null;
}): string {
  const titular = titularParaFiFa(input.nombre_cliente, input.cedula_cliente);
  const n = input.numero_fi_fa ?? input.staging_id ?? "?";
  return `${titular} - FI_FA: ${n}`;
}

/** Nombre de archivo CSV seguro */
export function fiFaSlug(input: {
  nombre_cliente?: string | null;
  cedula_cliente?: string | null;
  numero_fi_fa?: number | null;
  staging_id?: number | null;
  cliente_id?: number;
}): string {
  const n = input.numero_fi_fa ?? input.staging_id;
  if (n != null) return `FI_FA-${n}`;
  return `caja-${input.cliente_id ?? "x"}`;
}
