import type { AdministradorIcPayload } from "./administrador-ic-query";
import type { PpDetalleHeader, PpIcVinculada } from "./detail-query";

const IC_PP_HEADERS = [
  "Proveedor",
  "PP",
  "Nro IC",
  "Cód cliente",
  "Cliente",
  "Marca",
  "Vendedor",
  "Categoría",
  "Pares IC",
  "Monto bruto",
  "Monto neto",
  "D1",
  "D2",
  "D3",
  "D4",
  "Plazo",
  "Evento precio",
  "Listado LP",
  "Listado label",
  "Nro pedido fábrica",
  "Monto IC",
  "Monto proforma",
] as const;

const PF_HEADERS = [
  "Proveedor PP",
  "PP",
  "PF key",
  "Cód cliente",
  "Marca PF",
  "Caso",
  "Listado",
  "Pares PF",
  "Monto PF",
  "Línea",
  "Referencia",
  "Material",
  "Color",
  "Grada",
  "Pares artículo",
  "LPN",
  "Subtotal",
] as const;

function escCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function icPpCsvFilename(ppNro: string): string {
  const safe = ppNro.replace(/[^\w-]+/g, "_");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .slice(0, 15);
  return `ic_pp_${safe}_${stamp}.csv`;
}

/** IC vinculadas al PP + detalle PF — agrupado por proveedor de cada IC. */
export function buildIcPpCsvExport(
  pp: Pick<PpDetalleHeader, "numero_registro" | "proveedor">,
  data: AdministradorIcPayload,
  opts?: { clienteId?: number | null },
): string {
  const clienteFilter = opts?.clienteId != null && opts.clienteId > 0 ? opts.clienteId : null;
  let ics = data.ics;
  let pfs = data.prefacturas;
  if (clienteFilter != null) {
    ics = ics.filter((i) => i.id_cliente === clienteFilter);
    pfs = pfs.filter((p) => p.id_cliente === clienteFilter);
  }

  const byProveedor = new Map<string, typeof ics>();
  for (const ic of ics) {
    const key = ic.proveedor.trim() || pp.proveedor.trim() || "—";
    const list = byProveedor.get(key) ?? [];
    list.push(ic);
    byProveedor.set(key, list);
  }

  const proveedores = [...byProveedor.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const lines: string[] = [];

  lines.push(escCsv(`# PP ${pp.numero_registro} · proveedor PP: ${pp.proveedor}`));
  lines.push(escCsv(`# IC cabeceras · ${ics.length} filas · agrupado por proveedor IC`));
  lines.push(IC_PP_HEADERS.join(","));

  for (const prov of proveedores) {
    const group = byProveedor.get(prov) ?? [];
    group.sort((a, b) => a.nro_ic.localeCompare(b.nro_ic));
    lines.push(
      escCsv(`# PROVEEDOR: ${prov} (${group.length} IC · ${group.reduce((s, x) => s + x.pares, 0)} pares)`),
    );
    for (const ic of group) {
      lines.push(
        [
          ic.proveedor,
          pp.numero_registro,
          ic.nro_ic,
          String(ic.id_cliente),
          ic.cliente,
          ic.marca,
          ic.vendedor,
          ic.categoria,
          String(ic.pares),
          String(ic.monto_bruto),
          String(ic.monto_neto),
          String(ic.descuento_1),
          String(ic.descuento_2),
          String(ic.descuento_3),
          String(ic.descuento_4),
          ic.plazo_nombre ?? "",
          ic.evento_nombre ?? "",
          ic.listado_precio_id != null ? String(ic.listado_precio_id) : "",
          ic.listado_label,
          ic.nro_pedido_fabrica ?? "",
          String(ic.monto_ic),
          String(ic.monto_proforma),
        ]
          .map(escCsv)
          .join(","),
      );
    }
  }

  lines.push("");
  lines.push(escCsv(`# Detalle prefacturas (PF) · ${pfs.length} grupos · proveedor PP: ${pp.proveedor}`));
  lines.push(PF_HEADERS.join(","));

  const pfsOrd = [...pfs].sort((a, b) => {
    const c = a.id_cliente - b.id_cliente;
    if (c !== 0) return c;
    return a.marca.localeCompare(b.marca, "es");
  });

  for (const pf of pfsOrd) {
    lines.push(
      escCsv(`# PF ${pf.pf_key} · cliente ${pf.id_cliente} · ${pf.marca} · ${pf.total_pares} pares`),
    );
    for (const art of pf.articulos) {
      lines.push(
        [
          pp.proveedor,
          pp.numero_registro,
          pf.pf_key,
          String(pf.id_cliente),
          pf.marca,
          pf.caso,
          pf.listado_label,
          String(pf.total_pares),
          String(pf.total_monto),
          art.linea,
          art.referencia,
          art.material_code || art.material,
          art.color_code || art.color,
          art.grada ?? "",
          String(art.pares),
          String(art.lpn),
          String(art.subtotal),
        ]
          .map(escCsv)
          .join(","),
      );
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}

const IC_VINCULADAS_HEADERS = [
  "Proveedor",
  "PP",
  "Nro IC",
  "Cód cliente",
  "Cliente",
  "Marca",
  "Vendedor",
  "Categoría",
  "Pares",
  "Monto bruto",
  "Monto neto",
  "D1",
  "D2",
  "D3",
  "D4",
  "Plazo",
  "Evento precio",
  "Listado LP",
  "Nro pedido fábrica",
] as const;

/** Todas las IC vinculadas al PP — agrupado por proveedor de cada IC. */
export function buildIcVinculadasPpCsv(
  pp: Pick<PpDetalleHeader, "numero_registro" | "proveedor">,
  ics: PpIcVinculada[],
): string {
  const byProveedor = new Map<string, PpIcVinculada[]>();
  for (const ic of ics) {
    const key = ic.proveedor.trim() || pp.proveedor.trim() || "—";
    const list = byProveedor.get(key) ?? [];
    list.push(ic);
    byProveedor.set(key, list);
  }

  const proveedores = [...byProveedor.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const lines: string[] = [];

  lines.push(escCsv(`# PP ${pp.numero_registro} · ${ics.length} IC vinculadas · agrupado por proveedor`));
  lines.push(IC_VINCULADAS_HEADERS.join(","));

  for (const prov of proveedores) {
    const group = byProveedor.get(prov) ?? [];
    group.sort((a, b) => a.nro_ic.localeCompare(b.nro_ic));
    const totalPares = group.reduce((s, x) => s + x.pares, 0);
    lines.push(escCsv(`# PROVEEDOR: ${prov} (${group.length} IC · ${totalPares} pares)`));
    for (const ic of group) {
      lines.push(
        [
          ic.proveedor,
          pp.numero_registro,
          ic.nro_ic,
          String(ic.id_cliente),
          ic.cliente,
          ic.marca,
          ic.vendedor,
          ic.categoria,
          String(ic.pares),
          String(ic.monto_bruto),
          String(ic.monto_neto),
          String(ic.descuento_1),
          String(ic.descuento_2),
          String(ic.descuento_3),
          String(ic.descuento_4),
          ic.plazo_nombre ?? "",
          ic.evento_nombre ?? "",
          ic.listado_precio_id != null ? String(ic.listado_precio_id) : "",
          ic.nro_pedido_fabrica ?? "",
        ]
          .map(escCsv)
          .join(","),
      );
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}
