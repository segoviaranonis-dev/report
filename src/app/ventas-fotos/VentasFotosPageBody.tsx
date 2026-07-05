"use client";

import dynamic from "next/dynamic";
import { VentasFotosEntryShell } from "./VentasFotosEntryShell";

const VentasFotosClient = dynamic(
  () => import("./VentasFotosClient").then((m) => ({ default: m.VentasFotosClient })),
  { loading: () => <VentasFotosEntryShell /> },
);

const VentasFotosDocs = dynamic(
  () => import("./VentasFotosDocs").then((m) => ({ default: m.VentasFotosDocs })),
  { loading: () => null },
);

export function VentasFotosPageBody() {
  return (
    <>
      <VentasFotosClient />
      <VentasFotosDocs />
    </>
  );
}
