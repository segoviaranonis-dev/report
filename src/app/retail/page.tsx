import Link from "next/link";
import { ReportAppNav } from "@/components/report/ReportAppNav";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReportSection } from "@/components/report/ReportSection";
import { RetailArbolSnapshot } from "./components/RetailArbolSnapshot";
import { RetailStockClient } from "./RetailStockClient";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

/** Demostración agregada (distinta a la rejilla por referencia). */
const demoStockPorTienda = [
  { linea: "RUN-PRO", ref: "88421", color: "NEGRO", t1: 42, t2: 28, t3: 15, total: 85 },
  { linea: "RUN-PRO", ref: "88421", color: "BLANCO", t1: 18, t2: 22, t3: 31, total: 71 },
  { linea: "URBAN", ref: "77204", color: "HUESO", t1: 8, t2: 0, t3: 12, total: 20 },
  { linea: "URBAN", ref: "77204", color: "AZUL", t1: 24, t2: 19, t3: 7, total: 50 },
  { linea: "KIDS", ref: "55102", color: "ROSA", t1: 36, t2: 44, t3: 9, total: 89 },
];

const demoGradaCurvaAbierta = [
  { talla: "34", pares: 1 },
  { talla: "35", pares: 2 },
  { talla: "36", pares: 3 },
  { talla: "37", pares: 3 },
  { talla: "38", pares: 2 },
  { talla: "39", pares: 1 },
];

export default function RetailStockPage() {
  return (
    <div className="min-h-screen bg-report-paper pb-16 text-report-ink">
      <ReportAppNav active="retail" title="Stock / Retail multi-tienda" maxWidthClass="max-w-6xl" />

      <RetailStockClient todayLabel={today} />

      <article id="documentacion" className="mx-auto max-w-4xl space-y-14 px-6 py-12 scroll-mt-20">
        <ReportSection number="1." title="Resumen operativo">
          <RetailArbolSnapshot />
        </ReportSection>

        <ReportSection number="2." title="Pilares (columnas amarillas del Excel)">
          <p>
            El Excel trae <strong>cinco identificadores de producto</strong> (no trae marca ni género en columnas):
          </p>
          <ul className="list-inside list-disc space-y-1 text-report-muted">
            <li>
              <strong>Linea</strong> → tabla <code className="text-xs">linea</code> (FK <code className="text-xs">linea_id</code>)
            </li>
            <li>
              <strong>Referencia</strong> → tabla <code className="text-xs">referencia</code> (con la línea)
            </li>
            <li>
              <strong>Material / Color</strong> → códigos proveedor en Excel; en staging se guardan{" "}
              <code className="text-xs">material.id</code> y <code className="text-xs">color.id</code>
            </li>
            <li>
              <strong>Grada</strong> → talla o curva en la fila (34, 38, o{" "}
              <code className="text-xs">34(1 2 3 3 2 1)39</code> en Importadora)
            </li>
          </ul>
          <p className="pt-2">
            <strong>Derivados por FK</strong> (desde <code className="text-xs">linea</code> +{" "}
            <code className="text-xs">linea_referencia</code>): marca, género, estilo, tipo_1. La web valida con{" "}
            <code className="text-xs">pilares_ok</code> que línea, referencia, material y color existan en maestros.
          </p>
        </ReportSection>

        <ReportSection number="3." title="Grada: caja cerrada vs curva abierta">
          <p>
            <strong>Caja cerrada</strong> (notación compacta), p. ej.{" "}
            <code className="rounded bg-report-paper2 px-1.5 py-0.5 text-sm">34(1 2 3 3 2 1)39</code> en la fila
            Importadora de la rejilla superior.
          </p>
          <div className="overflow-x-auto border border-report-rule bg-white shadow-sm">
            <table className="report-table max-w-md">
              <thead>
                <tr>
                  <th>Talla</th>
                  {demoGradaCurvaAbierta.map((r) => (
                    <th key={r.talla} className="text-center">
                      {r.talla}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold text-report-navy">Pares</td>
                  {demoGradaCurvaAbierta.map((r) => (
                    <td key={r.talla} className="text-center tabular-nums">
                      {r.pares}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection number="4." title="Cuadro agregado por línea (referencia cruzada)">
          <p className="text-sm text-report-muted">
            Vista tabular complementaria; la lectura por SKU sigue siendo la rejilla oscura de arriba.
          </p>
          <div className="overflow-x-auto border border-report-rule bg-white shadow-sm">
            <table className="report-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Ref.</th>
                  <th>Color</th>
                  <th className="text-right">Tienda_1</th>
                  <th className="text-right">Tienda_2</th>
                  <th className="text-right">Tienda_3</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {demoStockPorTienda.map((row) => (
                  <tr key={`${row.linea}-${row.ref}-${row.color}`}>
                    <td>{row.linea}</td>
                    <td className="tabular-nums">{row.ref}</td>
                    <td>{row.color}</td>
                    <td className="text-right tabular-nums">{row.t1}</td>
                    <td className="text-right tabular-nums">{row.t2}</td>
                    <td className="text-right tabular-nums">{row.t3}</td>
                    <td className="text-right font-semibold text-report-navy tabular-nums">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection number="5." title="Próximos pasos técnicos">
          <ul className="list-inside list-disc space-y-2 text-report-muted">
            <li>
              <code className="rounded bg-report-paper2 px-1 text-xs">GET /api/retail/meta</code> (lotes) y{" "}
              <code className="rounded bg-report-paper2 px-1 text-xs">GET /api/retail/stock-board?batch_id=…</code> (rejilla).
            </li>
            <li>Filtros por temporada, depósito y marca compartiendo vocabulario con RIMEC donde aplique.</li>
            <li>Exportación PDF / CSV alineada al estándar de impresión ya definido en globals.</li>
          </ul>
          <p className="pt-4">
            <Link
              href="/rimec"
              className="font-semibold text-report-navy2 underline decoration-report-rule underline-offset-4 hover:decoration-report-navy"
            >
              Volver al informe RIMEC (ventas)
            </Link>
            <span className="text-report-muted"> · </span>
            <Link
              href="/"
              className="font-semibold text-report-navy2 underline decoration-report-rule underline-offset-4 hover:decoration-report-navy"
            >
              Portada
            </Link>
          </p>
        </ReportSection>
      </article>

      <ReportFooter note="Retail: rejilla superior por referencia (stock/venta por talla). Resumen operativo = snapshot Excel completo (Ente → Género → Marca → SKU, sin acumular lotes)." />
    </div>
  );
}
