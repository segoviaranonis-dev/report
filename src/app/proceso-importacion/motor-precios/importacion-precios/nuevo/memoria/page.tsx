import { Suspense } from "react";
import { Paso1MemoriaClient } from "../components/Paso1MemoriaClient";

export const dynamic = "force-dynamic";

export default function ImportacionMemoriaPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-slate-500">Cargando…</p>}>
      <Paso1MemoriaClient />
    </Suspense>
  );
}
