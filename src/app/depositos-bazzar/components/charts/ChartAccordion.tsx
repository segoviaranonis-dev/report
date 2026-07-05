"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  index?: number;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: string;
  children: ReactNode;
};

export function ChartAccordion({
  index,
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="overflow-hidden rounded-xl border border-report-rule bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-start gap-3">
          {index != null ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bazzar-naranja/15 font-mono text-sm font-black tabular-nums text-bazzar-naranja-dark">
              {String(index).padStart(2, "0")}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-bazzar-naranja-dark">
              {title}
            </p>
            {subtitle ? <p className="text-xs text-report-muted">{subtitle}</p> : null}
            {badge ? (
              <p className="mt-0.5 text-xs font-bold tabular-nums text-bazzar-naranja">{badge}</p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-lg text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div className="border-t border-report-rule px-4 pb-4 pt-3">{children}</div> : null}
    </article>
  );
}
