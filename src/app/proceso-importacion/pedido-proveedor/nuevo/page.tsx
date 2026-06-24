import { redirect } from "next/navigation";
import { DIGITACION } from "@/lib/report/routes";

/** PP no se crea manualmente — solo vía Digitación (IC → PP). */
export default function PedidoProveedorNuevoPage() {
  redirect(DIGITACION);
}
