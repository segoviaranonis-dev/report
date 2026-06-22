import { Suspense } from "react";
import { Paso3PreviewClient } from "../components/Paso3PreviewClient";

export const dynamic = "force-dynamic";

export default function ImportacionPreviewPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Paso3PreviewClient />
    </Suspense>
  );
}
