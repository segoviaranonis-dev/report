import { Suspense } from "react";
import { Paso0CargaClient } from "./components/Paso0CargaClient";

export const dynamic = "force-dynamic";

export default function ImportacionPreciosNuevoPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Paso0CargaClient />
    </Suspense>
  );
}
