"use client";



import { useEffect, useMemo, useRef, useState } from "react";

import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

import {

  auditImagenesFaltantes,

  depRowToMoleculaInput,

  moleculeKeyImagen,

  type AuditImagenesRamoStats,

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



type CacheBlob = AuditImagenesRamoStats & {

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



type RamoCounterProps = {

  ramo: "654" | "638";

  label: string;

  sinImagen: number | null;

  total: number;

  loading: boolean;

  active: boolean;

  onToggle: () => void;

};



function RamoCounter({

  ramo,

  label,

  sinImagen,

  total,

  loading,

  active,

  onToggle,

}: RamoCounterProps) {

  const n = sinImagen ?? 0;

  const ok = total > 0 && n === 0;



  return (

    <button

      type="button"

      onClick={(e) => {

        e.preventDefault();

        e.stopPropagation();

        if (n <= 0 && !active) return;

        onToggle();

      }}

      disabled={loading && sinImagen == null}

      title={

        ramo === "654"

          ? "Calzado · stem L-R-M-C · Excel con guiones"

          : "Confecciones Kyly · stem L_C · imagen_color_excel / K0001"

      }

      className={`min-w-[7.5rem] rounded-lg border-2 px-3 py-1.5 text-left transition ${

        active

          ? "border-rose-600 bg-rose-600 text-white shadow-sm"

          : n > 0

            ? "border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100"

            : ok

              ? "border-emerald-300 bg-emerald-50 text-emerald-900"

              : "border-slate-200 bg-white text-slate-600"

      } ${loading ? "opacity-80" : ""}`}

    >

      <span className="block text-[9px] font-bold uppercase tracking-wider opacity-80">

        {loading && sinImagen == null ? "📷 …" : label}

      </span>

      <span className="block font-black tabular-nums">

        {sinImagen == null && loading ? "…" : n.toLocaleString("es-PY")}

        <span className="text-[10px] font-bold opacity-70">

          {" "}

          / {total.toLocaleString("es-PY")}

        </span>

      </span>

    </button>

  );

}



/**

 * Chip cabecera AM — dos contadores 654 calzado · 638 confecciones.

 * Auditoría = mismas URLs que la grilla (`productImageCandidatesForRow`).

 */

export function SinImagenCabeceraChip({

  productos,

  soloSinImagen,

  onSoloSinImagenChange,

  onFaltantesChange,

}: Props) {

  const [stats, setStats] = useState<AuditImagenesRamoStats & { total: number; sinImagen: number }>({

    total: 0,

    sinImagen: 0,

    total654: 0,

    sinImagen654: 0,

    total638: 0,

    sinImagen638: 0,

  });

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

      const input = depRowToMoleculaInput(p);

      const key = moleculeKeyImagen(input);

      if (seen.has(key)) continue;

      seen.add(key);

      keys.push(key);

      items.push(input);

    }

    return { items, keys, fp: fingerprintKeys(keys) };

  }, [productos]);



  useEffect(() => {

    if (payload.items.length === 0) {

      setStats({

        total: 0,

        sinImagen: 0,

        total654: 0,

        sinImagen654: 0,

        total638: 0,

        sinImagen638: 0,

      });

      setMs(0);

      setErr(null);

      onFaltantesRef.current?.(new Set());

      return;

    }



    const cached = readSs(payload.fp);

    if (cached) {

      setStats({

        total: cached.total,

        sinImagen: cached.sinImagen,

        total654: cached.total654,

        sinImagen654: cached.sinImagen654,

        total638: cached.total638,

        sinImagen638: cached.sinImagen638,

      });

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

            setStats({

              total: prog.total,

              sinImagen: prog.sinImagen,

              total654: prog.total654,

              sinImagen654: prog.sinImagen654,

              total638: prog.total638,

              sinImagen638: prog.sinImagen638,

            });

            setMs(prog.ms);

            onFaltantesRef.current?.(new Set(prog.faltantesMolKeys));

          });

          if (genRef.current !== gen) return;

          setStats({

            total: audit.total,

            sinImagen: audit.sinImagen,

            total654: audit.total654,

            sinImagen654: audit.sinImagen654,

            total638: audit.total638,

            sinImagen638: audit.sinImagen638,

          });

          setMs(audit.ms);

          onFaltantesRef.current?.(new Set(audit.faltantesMolKeys));

          writeSs(payload.fp, {

            total: audit.total,

            sinImagen: audit.sinImagen,

            total654: audit.total654,

            sinImagen654: audit.sinImagen654,

            total638: audit.total638,

            sinImagen638: audit.sinImagen638,

            faltantes: audit.faltantesMolKeys,

          });

        } catch {

          if (genRef.current !== gen) return;

          setErr("Falló auditoría");

          if (!cached) {

            setStats((s) => ({ ...s, sinImagen: 0, sinImagen654: 0, sinImagen638: 0 }));

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



  const okLatencia = ms != null && ms < 1000;



  return (

    <div

      className="flex flex-wrap items-end gap-2"

      title={

        err

          ? err

          : ms != null

            ? `Protocolo imagen · ${stats.sinImagen.toLocaleString("es-PY")} sin foto / ${stats.total.toLocaleString("es-PY")} fichas · ${ms} ms${okLatencia ? "" : " (>1s)"}`

            : "Auditoría de imágenes…"

      }

    >

      <RamoCounter

        ramo="654"

        label={soloSinImagen ? "👟 Solo sin foto" : "👟 Calzado 654"}

        sinImagen={stats.sinImagen654}

        total={stats.total654}

        loading={loading}

        active={soloSinImagen && stats.sinImagen654 > 0}

        onToggle={() => onSoloSinImagenChange(!soloSinImagen)}

      />

      <RamoCounter

        ramo="638"

        label={soloSinImagen ? "👕 Solo sin foto" : "👕 Kyly 638"}

        sinImagen={stats.sinImagen638}

        total={stats.total638}

        loading={loading}

        active={soloSinImagen && stats.sinImagen638 > 0}

        onToggle={() => onSoloSinImagenChange(!soloSinImagen)}

      />

      {ms != null && !loading ? (

        <span

          className={`pb-1 text-[10px] font-semibold tabular-nums ${

            okLatencia ? "text-slate-500" : "text-amber-700"

          }`}

        >

          {ms} ms

        </span>

      ) : loading ? (

        <span className="pb-1 text-[10px] font-semibold text-slate-500">revalidando…</span>

      ) : null}

    </div>

  );

}

