"use client";

import type { ComponentProps } from "react";
import { TrianguloHeaderDeposito } from "@/app/depositos-bazzar/components/operativa/TrianguloHeaderDeposito";
import { PANEL_CONTROL_GRILLA_HEADER } from "@/lib/panel-control/panel-control-grilla-header";

type Props = Omit<
  ComponentProps<typeof TrianguloHeaderDeposito>,
  keyof typeof PANEL_CONTROL_GRILLA_HEADER
> &
  Partial<typeof PANEL_CONTROL_GRILLA_HEADER>;

/** CABECERA DE FILTROS sellada — Panel de Control · grilla moléculas. */
export function PanelControlTrianguloHeader(props: Props) {
  return <TrianguloHeaderDeposito {...PANEL_CONTROL_GRILLA_HEADER} {...props} />;
}
