"use client";

import { ProcesoImportacionWaitOverlay } from "@/components/report/ProcesoImportacionWaitOverlay";

type Props = {
  open: boolean;
  archivo?: string;
};

export function Paso0ProcessingOverlay({ open, archivo }: Props) {
  return (
    <ProcesoImportacionWaitOverlay
      open={open}
      title="Procesando Excel…"
      detail={archivo}
      hint="Ley género · SKUs · sesión de trabajo (sin listado oficial hasta Cierre)"
    />
  );
}
