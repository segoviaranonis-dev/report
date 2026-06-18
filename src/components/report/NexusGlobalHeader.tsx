"use client";

import { NexusHeaderZen, type NexusNavKey } from "./NexusHeaderZen";

export type { NexusNavKey };

type Props = {
  active?: NexusNavKey;
  title?: string;
  maxWidthClass?: string;
};

export function NexusGlobalHeader({ active = "home", title, maxWidthClass = "max-w-5xl" }: Props) {
  return <NexusHeaderZen active={active} maxWidthClass={maxWidthClass} />;
}
