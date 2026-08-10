"use client";

import { useEffect, useState } from "react";
import type { MolNode } from "@/lib/situacion-financiera/types";

function fmtGs(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  );
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function MolTree({
  node,
  depth = 0,
}: {
  node: MolNode;
  depth?: number;
}) {
  const kids = node.children || [];
  const [open, setOpen] = useState(depth < 1);
  const hasKids = kids.length > 0;
  const pad = 8 + depth * 14;

  return (
    <div className="border-t border-slate-200/80">
      <button
        type="button"
        disabled={!hasKids}
        onClick={() => hasKids && setOpen((v) => !v)}
        className={`flex w-full items-start gap-2 px-2 py-1.5 text-left text-[11px] ${
          hasKids ? "cursor-pointer hover:bg-sky-50" : "cursor-default"
        }`}
        style={{ paddingLeft: pad }}
      >
        <span className="w-4 shrink-0 font-mono text-slate-500">
          {hasKids ? (open ? "▾" : "▸") : "·"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium text-slate-900">{node.label}</span>
          {node.meta ? (
            <span className="mt-0.5 block text-[10px] text-slate-500">
              {node.meta}
            </span>
          ) : null}
          {node.fuente ? (
            <span className="mt-0.5 block text-[10px] text-sky-800">
              Doc: {node.fuente}
            </span>
          ) : null}
          {node.doc ? (
            <code className="mt-1 block whitespace-pre-wrap break-all rounded bg-slate-900/90 px-1.5 py-1 font-mono text-[9px] leading-snug text-emerald-200">
              {node.doc}
            </code>
          ) : null}
        </span>
        <span
          className={`w-28 shrink-0 text-right tabular-nums ${
            (node.gs ?? 0) < 0 ? "text-red-700" : "text-slate-800"
          }`}
        >
          {fmtGs(node.gs)}
        </span>
        <span className="w-24 shrink-0 text-right tabular-nums text-slate-600">
          {fmtUsd(node.usd)}
        </span>
      </button>
      {open && hasKids
        ? kids.map((c) => <MolTree key={c.id} node={c} depth={depth + 1} />)
        : null}
    </div>
  );
}

export function MolAccordionPanel({
  molKey,
  fallback,
  colSpan = 4,
}: {
  molKey: string;
  fallback?: MolNode | null;
  colSpan?: number;
}) {
  const [node, setNode] = useState<MolNode | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/situacion-financiera/molecular?key=${encodeURIComponent(molKey)}`,
          { cache: "force-cache" }
        );
        const json = await res.json();
        if (!alive) return;
        if (json.ok && json.node) {
          setNode(json.node);
          return;
        }
        if (fallback) {
          setNode(fallback);
          return;
        }
        throw new Error(json.error || "Sin detalle");
      } catch (e) {
        if (!alive) return;
        if (fallback) setNode(fallback);
        else setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [molKey, fallback]);

  if (loading) {
    return (
      <td
        colSpan={colSpan}
        className="border border-slate-300 bg-sky-50/60 px-3 py-2 text-[11px] text-slate-600"
      >
        Cargando detalle molecular…
      </td>
    );
  }
  if (err || !node) {
    return (
      <td
        colSpan={colSpan}
        className="border border-slate-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900"
      >
        Sin composición rastreable: {err || molKey}
      </td>
    );
  }
  return (
    <td colSpan={colSpan} className="border border-slate-400 bg-[#F0F7FC] p-0">
      <div className="flex items-center justify-between border-b border-sky-200 bg-sky-100/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900">
        <span>Detalle molecular · {molKey}</span>
        <span className="font-normal normal-case">
          ▸ día/banco/cheque · línea verde = TXT limpio
        </span>
      </div>
      <MolTree node={node} depth={0} />
    </td>
  );
}
