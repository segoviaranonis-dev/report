import { Suspense } from "react";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { DepositoDetalleClient } from "./DepositoDetalleClient";

type Props = {
  params: Promise<{ cliente_id: string }>;
};

export default async function DepositoDetallePage({ params }: Props) {
  const { cliente_id } = await params;
  const clienteId = parseInt(cliente_id, 10);

  return (
    <div className="min-h-screen bg-report-paper pb-16">
      <NexusHeaderZen active="depositos-bazzar" maxWidthClass="max-w-6xl" />
      <Suspense fallback={<p className="p-8 text-center text-report-muted">Cargando…</p>}>
        <DepositoDetalleClient clienteId={clienteId} />
      </Suspense>
      <ReportFooter note="Operativa depósito · pilares FK · dual ramo 654/638" />
    </div>
  );
}
