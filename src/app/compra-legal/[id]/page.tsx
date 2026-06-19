import { CompraLegalDetalleClient } from "../components/CompraLegalDetalleClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CompraLegalDetallePage({ params }: Props) {
  const { id } = await params;
  return <CompraLegalDetalleClient idCl={parseInt(id, 10)} />;
}
