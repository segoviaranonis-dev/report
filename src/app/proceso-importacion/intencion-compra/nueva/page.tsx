import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadIcCatalogos } from "@/lib/intencion-compra/catalogos-query";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { IntencionCompraNuevaClient } from "../components/IntencionCompraNuevaClient";

export const dynamic = "force-dynamic";

export default async function IntencionCompraNuevaPage() {
  const session = await getSession();
  if (!session || session.rol_id !== 1) redirect("/login");
  if (!isRimecDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-red-800">
        DATABASE_URL no configurada — no se pueden cargar marcas.
      </div>
    );
  }

  const catalogos = await loadIcCatalogos(getRimecPool());
  return <IntencionCompraNuevaClient initialCatalogos={catalogos} />;
}
