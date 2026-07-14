/**
 * Protocolo automático — presencia de imagen por molécula (FK / códigos proveedor).
 * Stem canónico 654|638 · probe sm/ + flat · caché proceso (latencia cabecera &lt;1s).
 */

import { publicStorageObjectUrl } from "@/lib/storage-public-url";
import {
  productImagePrimaryStem,
  resolveProductImageProtocol,
} from "@/lib/retail/product-image-protocol";

export type MoleculaImagenInput = {
  linea: string;
  referencia: string;
  material: string | number;
  color: string | number;
  tipo_v2_id?: number | null;
  imagen_nombre?: string | null;
};

export type PresenceResult = {
  molKey: string;
  stem: string | null;
  hasImage: boolean;
};

function stripTier(path: string): string {
  return String(path ?? "")
    .trim()
    .replace(/^productos\//i, "")
    .replace(/^(sm|md|lg|thumbs)\//i, "")
    .replace(/^\/+/, "");
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 350;
/** GET Range paralelo sobre sm/ canónico — presupuesto cabecera &lt;1s (caché caliente ≈0 ms). */
const CONCURRENCY = 200;

type CacheEntry = { ok: boolean; at: number };

const presenceCache = new Map<string, CacheEntry>();

export function moleculeKeyImagen(input: MoleculaImagenInput): string {
  return [
    String(input.linea ?? "").trim(),
    String(input.referencia ?? "").trim(),
    String(input.material ?? "").trim(),
    String(input.color ?? "").trim(),
    String(input.tipo_v2_id ?? ""),
  ].join("|");
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

/** Keys de URL a probar (canónico sm + flat; excel si aplica). */
export function probeUrlsForMolecule(input: MoleculaImagenInput): string[] {
  const urls: string[] = [];
  const push = (u: string) => {
    if (u && !urls.includes(u)) urls.push(u);
  };

  const excel = String(input.imagen_nombre ?? "").trim();
  if (excel) {
    const base = stripTier(excel);
    const file = /\.(jpe?g|png|webp)$/i.test(base) ? base : `${base}.jpg`;
    push(publicStorageObjectUrl("productos", `sm/${file}`));
    push(publicStorageObjectUrl("productos", file));
  }

  const stem = productImagePrimaryStem({
    linea: input.linea,
    referencia: input.referencia,
    material: input.material,
    color: input.color,
    tipoV2Id: input.tipo_v2_id,
    imagenNombre: input.imagen_nombre,
  });
  if (stem) {
    push(publicStorageObjectUrl("productos", `sm/${stem}.jpg`));
    push(publicStorageObjectUrl("productos", `${stem}.jpg`));
  }

  return urls.filter(Boolean);
}

export function primaryStemForMolecule(input: MoleculaImagenInput): string | null {
  return productImagePrimaryStem({
    linea: input.linea,
    referencia: input.referencia,
    material: input.material,
    color: input.color,
    tipoV2Id: input.tipo_v2_id,
    imagenNombre: input.imagen_nombre,
    protocol: resolveProductImageProtocol({
      tipoV2Id: input.tipo_v2_id,
      imagenNombre: input.imagen_nombre,
    }),
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

  // Solo sm/ (LEY 2.01.04.021 — grilla = tier sm). Evita 2º RTT por ficha.
  const url = probeUrlsForMolecule(input)[0];
  if (!url) {
    cacheSet(`mol:${molKey}`, false);
    return false;
  }

  const ok = await urlExists(url);
  cacheSet(`mol:${molKey}`, ok);
  return ok;
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

export type AuditImagenesProgress = {
  total: number;
  sinImagen: number;
  done: number;
  parcial: boolean;
  ms: number;
  faltantesMolKeys: string[];
};

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
}> {
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
    const known = results.filter(Boolean) as PresenceResult[];
    const faltantesMolKeys = known.filter((r) => !r.hasImage).map((r) => r.molKey);
    onProgress({
      total: list.length,
      sinImagen: faltantesMolKeys.length,
      done: known.length,
      parcial,
      ms: Date.now() - t0,
      faltantesMolKeys,
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

  const faltantesMolKeys = results.filter((r) => !r.hasImage).map((r) => r.molKey);
  return {
    total: results.length,
    sinImagen: faltantesMolKeys.length,
    ms: Date.now() - t0,
    results,
    faltantesMolKeys,
  };
}
