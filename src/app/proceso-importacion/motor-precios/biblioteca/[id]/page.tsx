import { Suspense } from "react";
import { BibliotecaEditorClient } from "./components/BibliotecaEditorClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function BibliotecaEditorPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-10 text-center text-slate-500">Cargando biblioteca…</p>}>
      <BibliotecaEditorClient bibliotecaId={Number(id)} />
    </Suspense>
  );
}
