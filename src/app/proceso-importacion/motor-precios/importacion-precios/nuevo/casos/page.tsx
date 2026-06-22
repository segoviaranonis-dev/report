import { redirect } from "next/navigation";
import { importacionPasoPath } from "@/lib/motor-precios/importacion-pasos";

type Props = { searchParams: Promise<{ evento_id?: string }> };

/** Paso Casos eliminado en Report — redirige a Preview (audit automático). */
export default async function CasosRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const eventoId = sp.evento_id ? Number(sp.evento_id) : null;
  redirect(importacionPasoPath(2, eventoId && eventoId > 0 ? eventoId : null));
}
