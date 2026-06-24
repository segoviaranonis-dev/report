import { Suspense } from "react";
import { PedidoProveedorHubClient } from "./components/PedidoProveedorHubClient";

export const dynamic = "force-dynamic";

export default function PedidoProveedorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-app-bg p-10 text-center text-slate-500">Cargando…</div>}>
      <PedidoProveedorHubClient />
    </Suspense>
  );
}
