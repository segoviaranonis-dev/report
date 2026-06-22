import { Suspense } from "react";
import { Paso5CierreClient } from "../components/Paso5CierreClient";

export const dynamic = "force-dynamic";

export default function ImportacionCierrePage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Paso5CierreClient />
    </Suspense>
  );
}
