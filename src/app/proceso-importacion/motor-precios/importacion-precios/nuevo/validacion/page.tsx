import { Suspense } from "react";
import { Paso4ValidacionClient } from "../components/Paso4ValidacionClient";

export const dynamic = "force-dynamic";

export default function ImportacionValidacionPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Paso4ValidacionClient />
    </Suspense>
  );
}
