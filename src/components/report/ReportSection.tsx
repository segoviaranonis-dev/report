import type { ReactNode } from "react";

type Props = {
  id?: string;
  number: string;
  title: string;
  children: ReactNode;
};

export function ReportSection({ id, number, title, children }: Props) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex flex-wrap items-baseline gap-x-3 border-b border-report-rule pb-2 font-serif text-xl font-bold text-report-navy">
        <span className="text-report-gold">{number}</span>
        {title}
      </h2>
      <div className="mt-5 space-y-4 font-sans text-[15px] leading-relaxed text-report-ink">{children}</div>
    </section>
  );
}
