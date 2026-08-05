"use client";

import { useState } from "react";
import Link from "next/link";
import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ControlProntaEntregaPanel } from "./ControlProntaEntregaPanel";
import { MenuDiarioAutomatizaciones } from "./MenuDiarioAutomatizaciones";

/**
 * Automatización de informes · 2.3.1.35
 * Arriba: se cocina el envío · Abajo: menú diario (lenguaje claro).
 */
export default function AutomatizacionInformesPage() {
  const [menuKey, setMenuKey] = useState(0);

  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <NexusHeaderZen active="automatizacion-informes" maxWidthClass="max-w-5xl" />

      <main className="mx-auto max-w-5xl px-4 py-12">
        <Link href="/" className="text-sm text-rimec-azul hover:underline">
          ← Inicio Report
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
          Automatización de informes
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Programá el stock de pronta entrega: quién lo recibe y a qué hora. Sin depender de
          vaciar el correo a mano.
        </p>

        <ControlProntaEntregaPanel onCreada={() => setMenuKey((k) => k + 1)} />

        <MenuDiarioAutomatizaciones refreshKey={menuKey} />

        <p className="mt-10 text-sm text-slate-500">
          Para leer los PDF que ya llegaron:{" "}
          <Link href="/mensajes-internos" className="text-rimec-azul hover:underline">
            Mensajes internos
          </Link>
        </p>
      </main>

      <ReportFooter note="Automatización · menú diario · Control PE" />
    </div>
  );
}
