import { ModuleRouteLoading } from "@/components/report/ModuleRouteLoading";

export default function Loading() {
  return (
    <ModuleRouteLoading
      pathname="/proceso-importacion"
      active="proceso-importacion"
      note="Proceso de importación"
    />
  );
}
