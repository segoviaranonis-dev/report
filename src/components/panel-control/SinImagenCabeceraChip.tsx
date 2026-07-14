"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";
import {
  auditImagenesFaltantes,
  moleculeKeyImagen,
  type MoleculaImagenInput,
} from "@/lib/retail/product-image-presence";

type Props = {
  productos: DepositoRow[];
  /** Activo = grilla solo fichas sin foto */
  soloSinImagen: boolean;
  onSoloSinImagenChange: (v: boolean) => void;
  /** Claves molécula sin imagen (para filtrar grilla). */
  onFaltantesChange?: (keys: Set<string>) => void;
};

type CacheBlob = {
  total: number;
  sinImagen: number;
  faltantes: string[];
  at: number;
};

const SS_PREFIX = "am-sin-img:";
const SS_TTL_MS = 15 * 60 * 1000;

function fingerprintKeys(keys: string[]): string {
  let h = 2166136261;
  for (const k of keys) {
    for (let i = 0; i < k.length; i++) {
      h ^= k.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 124;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function readSs(fp: string): CacheBlob | null {
  try {
    const raw = sessionStorage.getItem(`${SS_PREFIX}${fp}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as CacheBlob;
    if (!j || Date.now() - j.at > SS_TTL_MS) return null;
    return j;
  } catch {
    return null;
  }
}

function writeSs(fp: string, blob: Omit<CacheBlob, "at">) {
  try {
    sessionStorage.setItem(
      `${SS_PREFIX}${fp}`,
      JSON.stringify({ ...blob, at: Date.now() }),
    );
  } catch {
    /* quota */
  }
}

/**
 * Chip cabecera estandarizada AM — conteo automático fichas sin imagen.
 * Auditoría en cliente → Storage CDN (sin proxy) · tap filtrar «solo sin foto».
 */
export function SinImagenCabeceraChip({
  productos,
  soloSinImagen,
  onSoloSinImagenChange,
  onFaltantesChange,
}: Props) {
  const [sinImagen, setSinImagen] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const genRef = useRef(0);
  const onFaltantesRef = useRef(onFaltantesChange);
  onFaltantesRef.current = onFaltantesChange;

  const payload = useMemo(() => {
    const seen = new Set<string>();
    const items: MoleculaImagenInput[] = [];
    const keys: string[] = [];
    for (const p of productos) {
      const key = moleculeKeyImagen({
        linea: p.linea_codigo_proveedor,
        referencia: p.referencia_codigo_proveedor,
        material: p.material_code,
        color: p.color_code,
        tipo_v2_id: p.tipo_v2_id,
      });
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
      items.push({
        linea: p.linea_codigo_proveedor,
        referencia: p.referencia_codigo_proveedor,
        material: p.material_code,
        color: p.color_code,
        tipo_v2_id: p.tipo_v2_id,
        imagen_nombre: p.imagen_nombre,
      });
    }
    return { items, keys, fp: fingerprintKeys(keys) };
  }, [productos]);

  useEffect(() => {
    if (payload.items.length === 0) {
      setSinImagen(0);
      setTotal(0);
      setMs(0);
      setErr(null);
      onFaltantesRef.current?.(new Set());
      return;
    }

    const cached = readSs(payload.fp);
    if (cached) {
      setSinImagen(cached.sinImagen);
      setTotal(cached.total);
      setMs(0);
      onFaltantesRef.current?.(new Set(cached.faltantes));
    }

    const gen = ++genRef.current;
    setLoading(true);
    setErr(null);

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const audit = await auditImagenesFaltantes(payload.items, (prog) => {
            if (genRef.current !== gen) return;
            setSinImagen(prog.sinImagen);
            setTotal(prog.total);
            setMs(prog.ms);
            onFaltantesRef.current?.(new Set(prog.faltantesMolKeys));
          });
          if (genRef.current !== gen) return;
          setSinImagen(audit.sinImagen);
          setTotal(audit.total);
          setMs(audit.ms);
          onFaltantesRef.current?.(new Set(audit.faltantesMolKeys));
          writeSs(payload.fp, {
            total: audit.total,
            sinImagen: audit.sinImagen,
            faltantes: audit.faltantesMolKeys,
          });
        } catch {
          if (genRef.current !== gen) return;
          setErr("Falló auditoría");
          if (!cached) {
            setSinImagen(null);
            onFaltantesRef.current?.(new Set());
          }
        } finally {
          if (genRef.current === gen) setLoading(false);
        }
      })();
    }, cached ? 30 : 80);

    return () => {
      window.clearTimeout(t);
      genRef.current += 1;
    };
  }, [payload]);

  const n = sinImagen ?? 0;
  const active = soloSinImagen;
  const okLatencia = ms != null && ms < 1000;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (n <= 0 && !active) return;
        onSoloSinImagenChange(!active);
      }}
      disabled={loading && sinImagen == null}
      title={
        err
          ? err
          : ms != null
            ? `Protocolo imagen · ${n.toLocaleString("es-PY")} sin foto / ${total.toLocaleString("es-PY")} fichas · ${ms} ms${okLatencia ? "" : " (aviso >1s)"} · tap filtrar`
            : "Auditoría de imágenes…"
      }
      className={`rounded-lg border-2 px-3 py-1.5 text-left transition ${
        active
          ? "border-rose-600 bg-rose-600 text-white shadow-sm"
          : n > 0
            ? "border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100"
            : "border-emerald-300 bg-emerald-50 text-emerald-900"
      } ${loading ? "opacity-80" : ""}`}
    >
      <span className="block text-[9px] font-bold uppercase tracking-wider opacity-80">
        {loading && sinImagen == null
          ? "📷 Auditando…"
          : active
            ? "📷 Solo sin foto"
            : "📷 Sin imagen"}
      </span>
      <span className="block font-black tabular-nums">
        {sinImagen == null && loading ? "…" : n.toLocaleString("es-PY")}
        <span className="text-[10px] font-bold opacity-70">
          {" "}
          / {total.toLocaleString("es-PY")} fichas
        </span>
      </span>
      {ms != null && !loading ? (
        <span
          className={`block text-[10px] font-semibold tabular-nums opacity-90 ${
            okLatencia ? "" : "text-amber-700"
          }`}
        >
          {ms} ms
        </span>
      ) : loading && sinImagen != null ? (
        <span className="block text-[10px] font-semibold opacity-70">revalidando…</span>
      ) : null}
    </button>
  );
}
