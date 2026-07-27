/**
 * Control recibidas (FI) vs distribuidas (traspaso_detalle por talla).
 */
import { parseLineaSnapshotForDisplay } from "@/app/aprobaciones/lib/linea-snapshot-display";
import type {
  FacturaLineaLegacy,
  FiDetalleCanonico,
  FiRegistroRow,
  TraspasoDetalleLine,
} from "./types";

export type ControlSkuRow = {
  linea: string;
  referencia: string;
  material: string;
  color: string;
  recibidas: number;
  distribuidas: number;
  delta: number;
  ok: boolean;
};

export type ControlCantidades = {
  recibidas: number;
  distribuidas: number;
  delta: number;
  ok: boolean;
  skus: ControlSkuRow[];
};

function normSkuPart(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function skuKey(linea: string, referencia: string, material: string, color: string): string {
  return [normSkuPart(linea), normSkuPart(referencia), normSkuPart(material), normSkuPart(color)].join("|");
}

function addDistribuidas(map: Map<string, ControlSkuRow>, ln: TraspasoDetalleLine) {
  const key = skuKey(ln.linea, ln.referencia, ln.material, ln.color);
  const prev = map.get(key);
  const qty = Number(ln.cantidad) || 0;
  if (prev) {
    prev.distribuidas += qty;
    prev.delta = prev.recibidas - prev.distribuidas;
    prev.ok = prev.delta === 0;
    return;
  }
  map.set(key, {
    linea: ln.linea,
    referencia: ln.referencia,
    material: ln.material,
    color: ln.color,
    recibidas: 0,
    distribuidas: qty,
    delta: -qty,
    ok: false,
  });
}

export function buildControlCantidades(input: {
  fi: FiRegistroRow | null;
  fiDetalles: FiDetalleCanonico[];
  lineas: TraspasoDetalleLine[];
  legacyLineas?: FacturaLineaLegacy[];
}): ControlCantidades {
  const map = new Map<string, ControlSkuRow>();

  if (input.fiDetalles.length) {
    for (const d of input.fiDetalles) {
      const snap = parseLineaSnapshotForDisplay(d.linea_snapshot);
      const key = skuKey(
        snap.linea_codigo,
        snap.ref_codigo,
        snap.material_nombre || snap.material_code,
        snap.color_nombre || snap.color_code,
      );
      const pares = Number(d.pares) || 0;
      const prev = map.get(key);
      if (prev) {
        prev.recibidas += pares;
      } else {
        map.set(key, {
          linea: snap.linea_codigo,
          referencia: snap.ref_codigo,
          material: snap.material_nombre || snap.material_code || "—",
          color: snap.color_nombre || snap.color_code || "—",
          recibidas: pares,
          distribuidas: 0,
          delta: pares,
          ok: pares === 0,
        });
      }
    }
  } else if (input.legacyLineas?.length) {
    for (const l of input.legacyLineas) {
      const key = skuKey(l.linea, l.referencia, l.material, l.color);
      const pares = Number(l.pares) || 0;
      map.set(key, {
        linea: String(l.linea),
        referencia: String(l.referencia),
        material: String(l.material ?? "—"),
        color: String(l.color ?? "—"),
        recibidas: pares,
        distribuidas: 0,
        delta: pares,
        ok: pares === 0,
      });
    }
  }

  for (const ln of input.lineas) addDistribuidas(map, ln);

  const skus = [...map.values()]
    .map((r) => {
      r.delta = r.recibidas - r.distribuidas;
      r.ok = r.recibidas === r.distribuidas;
      return r;
    })
    .sort((a, b) => a.linea.localeCompare(b.linea) || a.referencia.localeCompare(b.referencia));

  let recibidas = skus.reduce((s, r) => s + r.recibidas, 0);
  let distribuidas = skus.reduce((s, r) => s + r.distribuidas, 0);

  if (input.fi && recibidas === 0 && input.fi.total_pares > 0) {
    recibidas = input.fi.total_pares;
  }
  if (distribuidas === 0 && input.lineas.length) {
    distribuidas = input.lineas.reduce((s, ln) => s + (Number(ln.cantidad) || 0), 0);
  }
  if (recibidas === 0 && input.fi?.total_pares) {
    recibidas = input.fi.total_pares;
  }

  const delta = recibidas - distribuidas;
  const ok = recibidas > 0 ? delta === 0 : distribuidas === 0;

  return { recibidas, distribuidas, delta, ok, skus };
}
