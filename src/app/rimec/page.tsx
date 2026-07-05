import { Suspense } from "react";
import { ImmersiveClient } from "./ImmersiveClient";
import { RimecEntryShell } from "./components/RimecEntryShell";

/** Vista principal: Sales Report v1 — dashboard inmersivo (KPIs, mundos Clientes / Marcas / Vendedores, snapshot único). */
export default function RimecPage() {
  return (
    <Suspense fallback={<RimecEntryShell variant="full" message="Abriendo Sales Report…" />}>
      <ImmersiveClient />
    </Suspense>
  );
}
