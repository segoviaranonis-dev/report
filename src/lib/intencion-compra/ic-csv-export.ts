import type { IcPendienteRow } from "./pendientes-query";

const IC_HEADERS = [
  "Proveedor",
  "Nro IC",
  "Tipo",
  "Categoría",
  "Marca",
  "Cód cliente",
  "Cliente",
  "Vendedor",
  "Fecha embarque",
  "Pares",
  "Monto bruto",
  "Monto neto",
  "D1",
  "D2",
  "D3",
  "D4",
  "Evento precio",
  "Listado LP",
  "Nota pedido",
] as const;

function escCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stampFilename(prefix: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15);
  return `${prefix}_${stamp}.csv`;
}

export function icPendientesCsvFilename(): string {
  return stampFilename("ic_pendientes_por_proveedor");
}

function rowFromPendiente(ic: IcPendienteRow): string[] {
  return [
    ic.proveedor,
    ic.numero_registro,
    ic.tipo,
    ic.categoria,
    ic.marca,
    String(ic.id_cliente),
    ic.cliente,
    ic.vendedor,
    ic.fecha_embarque ?? "",
    String(ic.pares),
    "",
    String(ic.monto_neto),
    "",
    "",
    "",
    "",
    ic.evento_precio ?? "",
    ic.listado_precio_id != null ? String(ic.listado_precio_id) : "",
    ic.nota_pedido ?? "",
  ];
}

/** IC pendientes operativos — secciones por proveedor (orden alfabético). */
export function buildIcPendientesCsv(rows: IcPendienteRow[]): string {
  const byProveedor = new Map<string, IcPendienteRow[]>();
  for (const ic of rows) {
    const key = ic.proveedor.trim() || "—";
    const list = byProveedor.get(key) ?? [];
    list.push(ic);
    byProveedor.set(key, list);
  }

  const proveedores = [...byProveedor.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const lines: string[] = [IC_HEADERS.join(",")];

  for (const prov of proveedores) {
    const group = byProveedor.get(prov) ?? [];
    group.sort((a, b) => a.numero_registro.localeCompare(b.numero_registro));
    lines.push(
      escCsv(`# PROVEEDOR: ${prov} (${group.length} IC · ${group.reduce((s, x) => s + x.pares, 0)} pares)`),
    );
    for (const ic of group) {
      lines.push(rowFromPendiente(ic).map(escCsv).join(","));
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}
