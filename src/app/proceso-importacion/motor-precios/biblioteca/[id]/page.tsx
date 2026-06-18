import { BibliotecaEditorClient } from "./components/BibliotecaEditorClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function BibliotecaEditorPage({ params }: Props) {
  const { id } = await params;
  return <BibliotecaEditorClient bibliotecaId={Number(id)} />;
}
