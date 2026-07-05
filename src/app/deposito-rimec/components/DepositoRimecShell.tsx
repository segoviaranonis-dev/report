import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";

type Props = {
  children: React.ReactNode;
  footer: string;
};

export function DepositoRimecShell({ children, footer }: Props) {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="deposito-rimec" maxWidthClass="max-w-none" />
      {children}
      <ReportFooter note={footer} />
    </div>
  );
}
