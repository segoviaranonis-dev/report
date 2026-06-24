import { Suspense } from "react";
import { PedidoProveedorDetalleClient } from "./components/PedidoProveedorDetalleClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ppId: string }> };

export default async function PedidoProveedorDetallePage({ params }: Props) {
  const { ppId } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-app-bg p-10 text-center text-slate-500">Cargando PP…</div>}>
      <PedidoProveedorDetalleClient ppId={ppId} />
    </Suspense>
  );
}
