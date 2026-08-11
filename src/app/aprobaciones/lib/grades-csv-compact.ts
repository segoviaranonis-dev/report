/** Grada compacta para CSV legacy — ley Carlos ceros min→max (2.3.1.7.5.3.16) */

import { gradasFmtCarlosFromRaw } from "@/lib/pedido-proveedor/grada-carlos-format";

export function gradesJsonToCompacto(raw: unknown): string {
  const fmt = gradasFmtCarlosFromRaw(raw);
  return fmt || "N/A";
}
