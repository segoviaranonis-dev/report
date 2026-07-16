/**
 * Protocolo automático — presencia de imagen por molécula (FK / códigos proveedor).
 * Stem canónico 654|638 · probe sm/ + flat · caché proceso (latencia cabecera &lt;1s).
 */

import { productImageCandidatesForRow } from "@/lib/retail/product-image";
import {
  inferProtocolFromProductCodes,
  productImagePrimaryStem,
  type ProductImageProtocol,
} from "@/lib/retail/product-image-protocol";

export type MoleculaImagenInput = {
  linea: string;
  referencia: string;
  material: string | number;
  color: string | number;
  tipo_v2_id?: number | null;
  imagen_nombre?: string | null;
  /** Kyly 638 — color Excel (K0001), no bigint pilar. */
  imagen_color_excel?: string | null;
};

export type PresenceResult = {
  molKey: string;
  stem: string | null;
  hasImage: boolean;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 350;
/** GET Range paralelo sobre sm/ canónico — presupuesto cabecera &lt;1s (caché caliente ≈0 ms). */
const CONCURRENCY = 200;

type CacheEntry = { ok: boolean; at: number };

const presenceCache = new Map<string, CacheEntry>();

export function moleculeKeyImagen(input: MoleculaImagenInput): string {
  const protocol = inferProtocolFromProductCodes({
    material: input.material,
    linea: input.linea,
    referencia: input.referencia,
    imagenNombre: input.imagen_nombre,
    tipoV2Id: input.tipo_v2_id,
  });
  if (protocol === "638") {
    return [
      "638",
      String(input.linea ?? "").trim(),
      String(input.imagen_color_excel ?? input.color ?? "").trim(),
      String(input.imagen_nombre ?? "").trim(),
    ].join("|");
  }
  return [
    "654",
    String(input.linea ?? "").trim(),
    String(input.referencia ?? "").trim(),
    String(input.material ?? "").trim(),
    String(input.color ?? "").trim(),
    String(input.imagen_nombre ?? "").trim(),
  ].join("|");
}

export function depRowToMoleculaInput(p: {
  linea_codigo_proveedor: string;
  referencia_codigo_proveedor: string;
  material_code: string;
  color_code: string;
  tipo_v2_id?: number | null;
  imagen_nombre?: string | null;
  imagen_color_excel?: string | null;
}): MoleculaImagenInput {
  return {
    linea: p.linea_codigo_proveedor,
    referencia: p.referencia_codigo_proveedor,
    material: p.material_code,
    color: p.color_code,
    tipo_v2_id: p.tipo_v2_id,
    imagen_nombre: p.imagen_nombre,
    imagen_color_excel: p.imagen_color_excel ?? null,
  };
}

export function moleculeKeyFromDepRow(
  p: Parameters<typeof depRowToMoleculaInput>[0],
): string {
  return moleculeKeyImagen(depRowToMoleculaInput(p));
}

export function moleculeProtocol(input: MoleculaImagenInput): ProductImageProtocol {
  return inferProtocolFromProductCodes({
    material: input.material,
    linea: input.linea,
    referencia: input.referencia,
    imagenNombre: input.imagen_nombre,
    tipoV2Id: input.tipo_v2_id,
  });
}

function cacheGet(key: string): boolean | null {
  const e = presenceCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    presenceCache.delete(key);
    return null;
  }
  return e.ok;
}

function cacheSet(key: string, ok: boolean) {
  presenceCache.set(key, { ok, at: Date.now() });
}

/** Mismas URLs que la grilla (`productImageCandidatesForRow`) — sm/md/lg/flat + Excel + stems 654|638. */
export function probeUrlsForMolecule(input: MoleculaImagenInput): string[] {
  const protocol = moleculeProtocol(input);
  return productImageCandidatesForRow(
    input.linea,
    input.referencia,
    input.material,
    input.color,
    input.imagen_nombre,
    "thumb",
    {
      tipoV2Id: input.tipo_v2_id,
      imagenColorExcel: input.imagen_color_excel,
      protocol,
    },
  );
}

export function primaryStemForMolecule(input: MoleculaImagenInput): string | null {
  return productImagePrimaryStem({
    linea: input.linea,
    referencia: input.referencia,
    material: input.material,
    color: input.color,
    tipoV2Id: input.tipo_v2_id,
    imagenNombre: input.imagen_nombre,
    imagenColorExcel: input.imagen_color_excel,
    protocol: moleculeProtocol(input),
  });
}

async function fetchTimed(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function urlExists(url: string): Promise<boolean> {
  const cached = cacheGet(`url:${url}`);
  if (cached != null) return cached;

  try {
    // GET Range — HEAD a Storage/CDN a veces cuelga sin abort fiable en Node
    const res = await fetchTimed(
      url,
      {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        cache: "no-store",
      },
      PROBE_TIMEOUT_MS,
    );
    const ok = res.ok || res.status === 206;
    // Consumir/cancelar body para no retener socket
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    cacheSet(`url:${url}`, ok);
    return ok;
  } catch {
    cacheSet(`url:${url}`, false);
    return false;
  }
}

async function moleculeHasImage(input: MoleculaImagenInput): Promise<boolean> {
  const molKey = moleculeKeyImagen(input);
  const cached = cacheGet(`mol:${molKey}`);
  if (cached != null) return cached;

  // Probar candidatos sm/flat (638: variantes color Excel; 654: stem L-R-M-C).
  const urls = probeUrlsForMolecule(input);
  if (urls.length === 0) {
    cacheSet(`mol:${molKey}`, false);
    return false;
  }

  for (const url of urls) {
    if (await urlExists(url)) {
      cacheSet(`mol:${molKey}`, true);
      return true;
    }
  }
  cacheSet(`mol:${molKey}`, false);
  return false;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export type AuditImagenesRamoStats = {
  total654: number;
  sinImagen654: number;
  total638: number;
  sinImagen638: number;
};

export type AuditImagenesProgress = AuditImagenesRamoStats & {
  total: number;
  sinImagen: number;
  done: number;
  parcial: boolean;
  ms: number;
  faltantesMolKeys: string[];
};

function statsFromPairs(
  pairs: { input: MoleculaImagenInput; result: PresenceResult }[],
): AuditImagenesRamoStats {
  let total654 = 0;
  let sinImagen654 = 0;
  let total638 = 0;
  let sinImagen638 = 0;
  for (const { input, result } of pairs) {
    const protocol = moleculeProtocol(input);
    if (protocol === "638") {
      total638 += 1;
      if (!result.hasImage) sinImagen638 += 1;
    } else {
      total654 += 1;
      if (!result.hasImage) sinImagen654 += 1;
    }
  }
  return { total654, sinImagen654, total638, sinImagen638 };
}

const PROGRESS_CHUNK = 180;

/** Deduplica moléculas y marca presencia Storage (protocolo imagen). */
export async function auditImagenesFaltantes(
  items: MoleculaImagenInput[],
  onProgress?: (p: AuditImagenesProgress) => void,
): Promise<{
  total: number;
  sinImagen: number;
  ms: number;
  results: PresenceResult[];
  faltantesMolKeys: string[];
} & AuditImagenesRamoStats> {
  const t0 = Date.now();
  const uniq = new Map<string, MoleculaImagenInput>();
  for (const it of items) {
    const k = moleculeKeyImagen(it);
    if (!uniq.has(k)) uniq.set(k, it);
  }
  const list = [...uniq.values()];
  const results: PresenceResult[] = new Array(list.length);
  const needIdx: number[] = [];
  const needItems: MoleculaImagenInput[] = [];

  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const molKey = moleculeKeyImagen(it);
    const hit = cacheGet(`mol:${molKey}`);
    if (hit != null) {
      results[i] = {
        molKey,
        stem: primaryStemForMolecule(it),
        hasImage: hit,
      };
    } else {
      needIdx.push(i);
      needItems.push(it);
    }
  }

  const emit = (parcial: boolean) => {
    if (!onProgress) return;
    const pairs = list.flatMap((input, i) => {
      const result = results[i];
      return result ? [{ input, result }] : [];
    });
    const faltantesMolKeys = pairs.filter((p) => !p.result.hasImage).map((p) => p.result.molKey);
    const ramo = statsFromPairs(pairs);
    onProgress({
      total: list.length,
      sinImagen: faltantesMolKeys.length,
      done: pairs.length,
      parcial,
      ms: Date.now() - t0,
      faltantesMolKeys,
      ...ramo,
    });
  };

  // Cabecera inmediata si hay caché proceso
  if (needItems.length < list.length) emit(needItems.length > 0);

  if (needItems.length > 0) {
    for (let offset = 0; offset < needItems.length; offset += PROGRESS_CHUNK) {
      const slice = needItems.slice(offset, offset + PROGRESS_CHUNK);
      const idxSlice = needIdx.slice(offset, offset + PROGRESS_CHUNK);
      const flags = await mapPool(slice, CONCURRENCY, (it) => moleculeHasImage(it));
      for (let j = 0; j < slice.length; j++) {
        const i = idxSlice[j];
        const it = slice[j];
        results[i] = {
          molKey: moleculeKeyImagen(it),
          stem: primaryStemForMolecule(it),
          hasImage: flags[j],
        };
      }
      emit(offset + slice.length < needItems.length);
    }
  }

  const faltantesMolKeys = (results as PresenceResult[]).filter((r) => !r.hasImage).map((r) => r.molKey);
  const pairs = list.map((input, i) => ({ input, result: results[i] as PresenceResult }));
  const ramo = statsFromPairs(pairs);
  return {
    total: results.length,
    sinImagen: faltantesMolKeys.length,
    ms: Date.now() - t0,
    results,
    faltantesMolKeys,
    ...ramo,
  };
}
