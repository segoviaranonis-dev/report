"use client";

import { NexusHeaderZen } from "./NexusHeaderZen";

export type NexusNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "depositos-bazzar" | "tablet-bazzar" | "informes";

type Props = {
  active?: NexusNavKey;
  title?: string;
  maxWidthClass?: string;
};

export function NexusGlobalHeader({ active = "home", title, maxWidthClass = "max-w-5xl" }: Props) {
  return <NexusHeaderZen active={active} maxWidthClass={maxWidthClass} />;
}
