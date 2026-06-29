import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { DepositosHubClient } from "./DepositosHubClient";

export default function DepositosBazzarPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16">
      <NexusHeaderZen active="depositos-bazzar" maxWidthClass="max-w-6xl" />
      <DepositosHubClient />
      <nav className="mx-auto max-w-6xl px-4 py-6 text-center text-sm">
        <Link href="/retail" className="font-semibold text-bazzar-naranja underline">
          Retail staging
        </Link>
        <span className="text-report-muted"> · </span>
        <Link href="/" className="font-semibold text-report-navy2 underline">
          Portada
        </Link>
      </nav>
      <ReportFooter note="Depósitos Bazzar · hub 3 entes · calzado cards · confecciones tabla L/R/Color" />
    </div>
  );
}
