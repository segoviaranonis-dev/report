/**
 * Herramienta de reposición — fusión AM: PE + CP (disp/vend) + PROGRAMADO.
 * Clave molécula: L+R+material+color · cantidades agregadas (sin clientes).
 */
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";

export type ReposicionBucket = { label: string; pares: number };

export type ReposicionArticulo = {
  key: string;
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  descp_material: string | null;
  descp_color: string | null;
  imagen_nombre: string | null;
  /** Precio unitario si hay (>0); null → badge «Sin LPN» */
  lpn: number | null;
  /** STOCK's: PE disponible + CP disponible por quincena */
  stock: ReposicionBucket[];
  /** VENTAS · Compra previa ejecutada por quincena */
  ventasCp: ReposicionBucket[];
  /** VENTAS · PROGRAMADO (pares vendidos / cantidad programada) por quincena */
  ventasProgramado: ReposicionBucket[];
  totales: {
    peDisponible: number;
    cpDisponible: number;
    cpVendido: number;
    programado: number;
  };
};

const PE_LABEL = "Pronta entrega";

function molKey(r: DepositoRow): string {
  return moleculeKeyVentas(
    r.linea_codigo_proveedor,
    r.referencia_codigo_proveedor,
    r.material_code,
    r.color_code,
  );
}

function quincenaLabel(r: DepositoRow, fallback: string): string {
  const q = String(r.quincena_desc ?? "").trim();
  if (!q || q === "—" || /^sin quincena/i.test(q)) return fallback;
  return q;
}

function addBucket(map: Map<string, number>, label: string, n: number) {
  if (n <= 0) return;
  map.set(label, (map.get(label) ?? 0) + n);
}

function bucketsFromMap(map: Map<string, number>): ReposicionBucket[] {
  return [...map.entries()]
    .map(([label, pares]) => ({ label, pares }))
    .filter((b) => b.pares > 0)
    .sort((a, b) => {
      if (a.label === PE_LABEL) return -1;
      if (b.label === PE_LABEL) return 1;
      return a.label.localeCompare(b.label, "es");
    });
}

type Acc = {
  marca: string;
  linea: string;
  referencia: string;
  material: string;
  color: string;
  descp_material: string | null;
  descp_color: string | null;
  imagen_nombre: string | null;
  lpn: number | null;
  stock: Map<string, number>;
  ventasCp: Map<string, number>;
  ventasProgramado: Map<string, number>;
};

function ensure(acc: Map<string, Acc>, row: DepositoRow): Acc {
  const key = molKey(row);
  let a = acc.get(key);
  if (!a) {
    const precio = row.precio_unitario != null ? Number(row.precio_unitario) : null;
    a = {
      marca: row.marca || "RIMEC",
      linea: row.linea_codigo_proveedor,
      referencia: row.referencia_codigo_proveedor,
      material: row.material_code,
      color: row.color_code,
      descp_material: row.descp_material,
      descp_color: row.descp_color,
      imagen_nombre: row.imagen_nombre,
      lpn: precio != null && precio > 0 ? precio : null,
      stock: new Map(),
      ventasCp: new Map(),
      ventasProgramado: new Map(),
    };
    acc.set(key, a);
  } else if (!a.lpn && row.precio_unitario != null && Number(row.precio_unitario) > 0) {
    a.lpn = Number(row.precio_unitario);
  } else if (!a.imagen_nombre && row.imagen_nombre) {
    a.imagen_nombre = row.imagen_nombre;
  }
  return a;
}

export function mergeReposicionArticulos(input: {
  pe: DepositoRow[];
  compraPrevia: DepositoRow[];
  programado: DepositoRow[];
}): ReposicionArticulo[] {
  const acc = new Map<string, Acc>();

  for (const r of input.pe) {
    const a = ensure(acc, r);
    addBucket(a.stock, PE_LABEL, Number(r.cantidad) || 0);
  }

  for (const r of input.compraPrevia) {
    const a = ensure(acc, r);
    const label = quincenaLabel(r, "Sin llegada");
    addBucket(a.stock, label, Number(r.cantidad) || 0);
    addBucket(a.ventasCp, label, Number(r.pares_vendidos) || 0);
  }

  for (const r of input.programado) {
    const a = ensure(acc, r);
    const label = quincenaLabel(r, "Programado");
    const vend = Number(r.pares_vendidos) || 0;
    const saldo = Number(r.cantidad) || 0;
    const inicial = Number(r.cantidad_inicial) || saldo + vend;
    // PROGRAMADO: cantidad dura de venta (vendido si hay; si no, inicial programado)
    addBucket(a.ventasProgramado, label, vend > 0 ? vend : inicial);
  }

  const out: ReposicionArticulo[] = [];
  for (const [key, a] of acc) {
    const stock = bucketsFromMap(a.stock);
    const ventasCp = bucketsFromMap(a.ventasCp);
    const ventasProgramado = bucketsFromMap(a.ventasProgramado);
    const peDisponible = stock.find((b) => b.label === PE_LABEL)?.pares ?? 0;
    const cpDisponible = stock
      .filter((b) => b.label !== PE_LABEL)
      .reduce((s, b) => s + b.pares, 0);
    const cpVendido = ventasCp.reduce((s, b) => s + b.pares, 0);
    const programado = ventasProgramado.reduce((s, b) => s + b.pares, 0);
    if (peDisponible + cpDisponible + cpVendido + programado <= 0) continue;
    out.push({
      key,
      marca: a.marca,
      linea: a.linea,
      referencia: a.referencia,
      material: a.material,
      color: a.color,
      descp_material: a.descp_material,
      descp_color: a.descp_color,
      imagen_nombre: a.imagen_nombre,
      lpn: a.lpn,
      stock,
      ventasCp,
      ventasProgramado,
      totales: { peDisponible, cpDisponible, cpVendido, programado },
    });
  }

  out.sort((x, y) => {
    const tx =
      x.totales.peDisponible +
      x.totales.cpDisponible +
      x.totales.cpVendido +
      x.totales.programado;
    const ty =
      y.totales.peDisponible +
      y.totales.cpDisponible +
      y.totales.cpVendido +
      y.totales.programado;
    if (ty !== tx) return ty - tx;
    return `${x.linea}.${x.referencia}`.localeCompare(`${y.linea}.${y.referencia}`, "es");
  });
  return out;
}
