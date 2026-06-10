"use client";

import { NexusHeaderZen } from "./NexusHeaderZen";

export type ReportNavKey = "home" | "rimec" | "retail" | "ventas-fotos" | "aprobaciones" | "informes";

type Props = {
  active: ReportNavKey;
  title?: string;
  maxWidthClass?: string;
};

export function ReportAppNav({ active, maxWidthClass = "max-w-6xl" }: Props) {
  return <NexusHeaderZen active={active} maxWidthClass={maxWidthClass} />;
}
