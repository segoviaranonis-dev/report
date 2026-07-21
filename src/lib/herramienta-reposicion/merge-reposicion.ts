/**
 * Herramienta de reposición — fusión AM: PE + CP (disp/vend) + PROGRAMADO.
 * Clave molécula: L+R+material+color · cantidades agregadas (sin clientes).
 */
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import { moleculeKeyVentas } from "@/lib/clientes/etiqueta-comprador";
import { calcularTotalesDesdeBuckets } from "@/lib/herramienta-reposicion/totales-reposicion";
import { PP_ABIERTO_LABEL } from "@/lib/herramienta-reposicion/queries-pp-abierto";
import { esLiquidacionRow } from "@/lib/filtros/filtro-tipo-canonico";
import { etiquetaDatoDuroCp, partesDatoDuroCp } from "@/lib/pedido-proveedor/dato-duro-cabecera";

export type ReposicionBucket = {
  label: string;
  pares: number;
  /** CP siamese — fila 1 UI */
  preventa?: string | null;
  /** CP siamese — fila 2 UI */
  quincena?: string | null;
};

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
  /** Kyly 638 — color Excel stem L_C (MIG-149). */
  imagen_color_excel: string | null;
  /** Precio unitario si hay (>0); null → badge «Sin LPN» */
  lpn: number | null;
  /** Dimensiones FK — cabecera filtros AM */
  genero: string;
  estilo: string;
  tipo_v2: string;
  tipo_1: string | null;
  tono_etiqueta: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number;
  color_id: number;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  tipo_v2_id: number | null;
  /** Caso biblioteca / motor precios */
  caso_precio: string | null;
  caso_id: number | null;
  cadena_comercial: string | null;
  es_liquidacion: boolean | null;
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
    ppAbierto: number;
  };
};

const PE_LABEL = "Pronta entrega";

/** RIMEC = holding, no marca comercial. */
function marcaDisplay(raw: string | null | undefined): string {
  const m = String(raw ?? "").trim();
  if (!m || /^rimec$/i.test(m) || m === "—" || m === "-") return "—";
  return m;
}

function molKey(r: DepositoRow): string {
  return moleculeKeyVentas(
    r.linea_codigo_proveedor,
    r.referencia_codigo_proveedor,
    r.material_code,
    r.color_code,
  );
}

/** Paridad siamese RIMEC Web — PP-4099 · 1ra Oct. (key) + partes UI. */
function cpBucketFromRow(r: DepositoRow, fallback: string) {
  const partes = partesDatoDuroCp(r.numero_preventa, r.quincena_desc);
  const label = etiquetaDatoDuroCp(r.numero_preventa, r.quincena_desc);
  return {
    label: label && label !== "Compra previa" ? label : fallback,
    preventa: partes.preventa || null,
    quincena: partes.quincena || null,
  };
}

function enteroBucket(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function addBucket(
  map: Map<string, number>,
  meta: Map<string, Pick<ReposicionBucket, "preventa" | "quincena">>,
  label: string,
  n: number,
  partes?: { preventa?: string | null; quincena?: string | null },
) {
  const p = enteroBucket(n);
  if (p <= 0) return;
  map.set(label, (map.get(label) ?? 0) + p);
  if (partes && !meta.has(label)) {
    meta.set(label, {
      preventa: partes.preventa ?? null,
      quincena: partes.quincena ?? null,
    });
  }
}

function bucketsFromMap(
  map: Map<string, number>,
  meta: Map<string, Pick<ReposicionBucket, "preventa" | "quincena">>,
): ReposicionBucket[] {
  return [...map.entries()]
    .map(([label, pares]) => ({
      label,
      pares,
      preventa: meta.get(label)?.preventa ?? null,
      quincena: meta.get(label)?.quincena ?? null,
    }))
    .filter((b) => b.pares > 0)
    .sort((a, b) => {
      if (a.label === PE_LABEL) return -1;
      if (b.label === PE_LABEL) return 1;
      if (a.label === PP_ABIERTO_LABEL) return -1;
      if (b.label === PP_ABIERTO_LABEL) return 1;
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
  imagen_color_excel: string | null;
  lpn: number | null;
  genero: string;
  estilo: string;
  tipo_v2: string;
  tipo_1: string | null;
  tono_etiqueta: string | null;
  linea_id: number | null;
  referencia_id: number | null;
  material_id: number;
  color_id: number;
  marca_id: number | null;
  genero_id: number | null;
  grupo_estilo_id: number | null;
  tipo_1_id: number | null;
  tipo_v2_id: number | null;
  caso_precio: string | null;
  caso_id: number | null;
  cadena_comercial: string | null;
  es_liquidacion: boolean | null;
  stock: Map<string, number>;
  stockMeta: Map<string, Pick<ReposicionBucket, "preventa" | "quincena">>;
  ventasCp: Map<string, number>;
  ventasCpMeta: Map<string, Pick<ReposicionBucket, "preventa" | "quincena">>;
  ventasProgramado: Map<string, number>;
  ventasProgramadoMeta: Map<string, Pick<ReposicionBucket, "preventa" | "quincena">>;
};

function ensure(acc: Map<string, Acc>, row: DepositoRow): Acc {
  const key = molKey(row);
  let a = acc.get(key);
  if (!a) {
    const precio = row.precio_unitario != null ? Number(row.precio_unitario) : null;
    a = {
      marca: marcaDisplay(row.marca),
      linea: row.linea_codigo_proveedor,
      referencia: row.referencia_codigo_proveedor,
      material: row.material_code,
      color: row.color_code,
      descp_material: row.descp_material,
      descp_color: row.descp_color,
      imagen_nombre: row.imagen_nombre,
      imagen_color_excel: row.imagen_color_excel ?? null,
      lpn: precio != null && precio > 0 ? precio : null,
      genero: row.genero || "",
      estilo: row.estilo || "",
      tipo_v2: row.tipo_v2 || "",
      tipo_1: row.tipo_1,
      tono_etiqueta: row.tono_etiqueta,
      linea_id: row.linea_id,
      referencia_id: row.referencia_id,
      material_id: row.material_id,
      color_id: row.color_id,
      marca_id: row.marca_id,
      genero_id: row.genero_id,
      grupo_estilo_id: row.grupo_estilo_id,
      tipo_1_id: row.tipo_1_id,
      tipo_v2_id: row.tipo_v2_id,
      caso_precio: row.caso_precio ?? null,
      caso_id: row.caso_id ?? null,
      cadena_comercial: row.cadena_comercial ?? null,
      es_liquidacion: esLiquidacionRow(row) ? true : (row.es_liquidacion ?? null),
      stock: new Map(),
      stockMeta: new Map(),
      ventasCp: new Map(),
      ventasCpMeta: new Map(),
      ventasProgramado: new Map(),
      ventasProgramadoMeta: new Map(),
    };
    acc.set(key, a);
  } else {
    if (!a.lpn && row.precio_unitario != null && Number(row.precio_unitario) > 0) {
      a.lpn = Number(row.precio_unitario);
    }
    if (!a.imagen_nombre && row.imagen_nombre) a.imagen_nombre = row.imagen_nombre;
    if (!a.imagen_color_excel && row.imagen_color_excel) {
      a.imagen_color_excel = row.imagen_color_excel;
    }
    if (!a.genero_id && row.genero_id) {
      a.genero_id = row.genero_id;
      a.genero = row.genero || a.genero;
    }
    if (!a.marca_id && row.marca_id) {
      a.marca_id = row.marca_id;
      const md = marcaDisplay(row.marca);
      if (md !== "—") a.marca = md;
    }
    if (!a.grupo_estilo_id && row.grupo_estilo_id) {
      a.grupo_estilo_id = row.grupo_estilo_id;
      a.estilo = row.estilo || a.estilo;
    }
    if (!a.tipo_1_id && row.tipo_1_id) {
      a.tipo_1_id = row.tipo_1_id;
      a.tipo_1 = row.tipo_1;
    }
    if (!a.tipo_v2_id && row.tipo_v2_id) {
      a.tipo_v2_id = row.tipo_v2_id;
      a.tipo_v2 = row.tipo_v2 || a.tipo_v2;
    }
    if (!a.tono_etiqueta && row.tono_etiqueta) a.tono_etiqueta = row.tono_etiqueta;
    if (!a.linea_id && row.linea_id) a.linea_id = row.linea_id;
    if (!a.caso_precio && row.caso_precio) a.caso_precio = row.caso_precio;
    if (!a.caso_id && row.caso_id != null) a.caso_id = row.caso_id;
    if (esLiquidacionRow(row)) a.es_liquidacion = true;
    if (row.cadena_comercial) a.cadena_comercial = row.cadena_comercial;
  }
  return a;
}

export function mergeReposicionArticulos(input: {
  pe: DepositoRow[];
  compraPrevia: DepositoRow[];
  programado: DepositoRow[];
  ppAbierto?: DepositoRow[];
}): ReposicionArticulo[] {
  const acc = new Map<string, Acc>();

  for (const r of input.pe) {
    const a = ensure(acc, r);
    addBucket(a.stock, a.stockMeta, PE_LABEL, Number(r.cantidad) || 0);
  }

  for (const r of input.compraPrevia) {
    const a = ensure(acc, r);
    const bucket = cpBucketFromRow(r, "Sin llegada");
    addBucket(a.stock, a.stockMeta, bucket.label, Number(r.cantidad) || 0, bucket);
    addBucket(a.ventasCp, a.ventasCpMeta, bucket.label, Number(r.pares_vendidos) || 0, bucket);
  }

  for (const r of input.programado) {
    const a = ensure(acc, r);
    const bucket = cpBucketFromRow(r, "Programado");
    const vend = Number(r.pares_vendidos) || 0;
    const saldo = Number(r.cantidad) || 0;
    const inicial = Number(r.cantidad_inicial) || saldo + vend;
    addBucket(
      a.ventasProgramado,
      a.ventasProgramadoMeta,
      bucket.label,
      vend > 0 ? vend : inicial,
      bucket,
    );
  }

  for (const r of input.ppAbierto ?? []) {
    const a = ensure(acc, r);
    addBucket(a.stock, a.stockMeta, PP_ABIERTO_LABEL, Number(r.cantidad) || 0);
  }

  const out: ReposicionArticulo[] = [];
  for (const [key, a] of acc) {
    const stock = bucketsFromMap(a.stock, a.stockMeta);
    const ventasCp = bucketsFromMap(a.ventasCp, a.ventasCpMeta);
    const ventasProgramado = bucketsFromMap(a.ventasProgramado, a.ventasProgramadoMeta);
    const totales = calcularTotalesDesdeBuckets(stock, ventasCp, ventasProgramado);
    const { peDisponible, cpDisponible, cpVendido, programado, ppAbierto } = totales;
    if (peDisponible + cpDisponible + cpVendido + programado + ppAbierto <= 0) continue;
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
      imagen_color_excel: a.imagen_color_excel,
      lpn: a.lpn,
      genero: a.genero,
      estilo: a.estilo,
      tipo_v2: a.tipo_v2,
      tipo_1: a.tipo_1,
      tono_etiqueta: a.tono_etiqueta,
      linea_id: a.linea_id,
      referencia_id: a.referencia_id,
      material_id: a.material_id,
      color_id: a.color_id,
      marca_id: a.marca_id,
      genero_id: a.genero_id,
      grupo_estilo_id: a.grupo_estilo_id,
      tipo_1_id: a.tipo_1_id,
      tipo_v2_id: a.tipo_v2_id,
      caso_precio: a.caso_precio,
      caso_id: a.caso_id,
      cadena_comercial: a.cadena_comercial,
      es_liquidacion: a.es_liquidacion,
      stock,
      ventasCp,
      ventasProgramado,
      totales,
    });
  }

  out.sort((x, y) => {
    const tx =
      x.totales.peDisponible +
      x.totales.cpDisponible +
      x.totales.cpVendido +
      x.totales.programado +
      x.totales.ppAbierto;
    const ty =
      y.totales.peDisponible +
      y.totales.cpDisponible +
      y.totales.cpVendido +
      y.totales.programado +
      y.totales.ppAbierto;
    if (ty !== tx) return ty - tx;
    return `${x.linea}.${x.referencia}`.localeCompare(`${y.linea}.${y.referencia}`, "es");
  });
  return out;
}
