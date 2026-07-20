import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { LogisticaOkClient } from "./LogisticaOkClient";

export default function LogisticaOkPage() {
  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader active="logistica-ok" />
      <LogisticaOkClient />
    </div>
  );
}
