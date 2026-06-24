import type { TicketPosRow } from "./tickets-db";
import { formatFacturaInternaPos } from "./fi-fa-display";

/** Factura interna POS — encabezado (1 venta tablet → N pares ORO). */
export type FacturaPosHeader = {
  key: string;
  staging_id: number | null;
  numero_fi_fa: number | null;
  numero_factura_legal: string | null;
  cedula_cliente: string | null;
  nombre_cliente: string | null;
  vendedor_nombre: string | null;
  marca: string;
  created_at: string;
  pares: number;
  lineas: TicketPosRow[];
  codigos: string[];
};

export function groupTicketsByFactura(tickets: TicketPosRow[]): FacturaPosHeader[] {
  const map = new Map<string, FacturaPosHeader>();

  for (const t of tickets) {
    const key =
      t.staging_id != null
        ? `stg:${t.staging_id}`
        : `legacy:${t.cedula_cliente ?? "?"}:${t.vendedor_nombre ?? "?"}:${t.created_at.slice(0, 16)}`;

    let h = map.get(key);
    if (!h) {
      h = {
        key,
        staging_id: t.staging_id,
        numero_fi_fa: t.numero_fi_fa,
        numero_factura_legal: t.numero_factura_legal,
        cedula_cliente: t.cedula_cliente,
        nombre_cliente: t.nombre_cliente,
        vendedor_nombre: t.vendedor_nombre,
        marca: t.marca,
        created_at: t.created_at,
        pares: 0,
        lineas: [],
        codigos: [],
      };
      map.set(key, h);
    }
    h.lineas.push(t);
    h.codigos.push(t.codigo_ticket);
    h.pares += 1;
    if (t.created_at < h.created_at) h.created_at = t.created_at;
    const cand = t.nombre_cliente?.trim();
    if (cand && !cand.startsWith("CI ") && (!h.nombre_cliente || h.nombre_cliente.startsWith("CI "))) {
      h.nombre_cliente = cand;
    }
    if (t.numero_fi_fa != null && h.numero_fi_fa == null) h.numero_fi_fa = t.numero_fi_fa;
    if (t.numero_factura_legal?.trim() && !h.numero_factura_legal) {
      h.numero_factura_legal = t.numero_factura_legal.trim();
    }
  }

  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function facturaDisplayId(f: FacturaPosHeader): string {
  return formatFacturaInternaPos({
    nombre_cliente: f.nombre_cliente,
    cedula_cliente: f.cedula_cliente,
    numero_fi_fa: f.numero_fi_fa,
    staging_id: f.staging_id,
  });
}

/** Nombre del titular para encabezado caja — siempre destacado. */
export function titularFacturaPos(f: FacturaPosHeader): string {
  const n = f.nombre_cliente?.trim();
  if (n && !n.startsWith("CI ")) return n;
  return f.cedula_cliente ? `Cliente CI ${f.cedula_cliente}` : "Cliente sin nombre";
}
