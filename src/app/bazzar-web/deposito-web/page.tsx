import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";

import { ReportFooter } from "@/components/report/ReportFooter";

import { DepositoWebClient } from "./components/DepositoWebClient";



export const dynamic = "force-dynamic";



const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());



export default function DepositoWebPage() {

  return (

    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">

      <NexusHeaderZen active="bazzar-web-deposito" />



      <section className="border-b-2 border-neutral-300 bg-card-bg py-8">

        <div className="mx-auto max-w-6xl px-6">

          <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">Depósito Web</h1>

          <p className="mt-2 text-sm text-neutral-700">

            Stock ALM_WEB_01 · 5 pilares + talla · motor galería tienda · {today}

          </p>

        </div>

      </section>



      <DepositoWebClient />



      <ReportFooter note="Depósito Web · Ingreso ALM ↔ v_stock_web vendible · hermano bazzar-web" />

    </div>

  );

}

