import { Suspense } from "react";
import { ImmersiveClient } from "./ImmersiveClient";

/** Vista principal: Sales Report v1 — dashboard inmersivo (KPIs, mundos Clientes / Marcas / Vendedores, snapshot único). */
export default function RimecPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-neutral-500">Cargando Sales Report…</div>}>
      <ImmersiveClient />
    </Suspense>
  );
}
