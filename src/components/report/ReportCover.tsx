import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children?: ReactNode;
};

/**
 * Portada / cabezal de informe estilo documento de desarrollo institucional.
 */
export function ReportCover({ title, subtitle, meta, children }: Props) {
  return (
    <header className="border-b-2 border-report-navy bg-report-paper pb-10 pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <p className="font-serif text-xs font-semibold uppercase tracking-[0.25em] text-report-accent">
          Documento de trabajo — demostración
        </p>
        <h1 className="mt-4 font-serif text-3xl font-bold leading-tight text-report-navy sm:text-[2.15rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl font-sans text-base leading-relaxed text-report-muted">{subtitle}</p>
        ) : null}
        {meta ? <div className="mt-6 font-sans text-sm text-report-ink/80">{meta}</div> : null}
        {children}
      </div>
    </header>
  );
}
