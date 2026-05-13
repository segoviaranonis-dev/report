import Link from "next/link";
import { ReportCover } from "@/components/report/ReportCover";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReportSection } from "@/components/report/ReportSection";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

export default function InformesPage() {
  return (
    <div className="min-h-screen pb-16">
      <div className="bg-report-navy text-report-paper">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs font-sans">
          <span className="opacity-90">Informe principal</span>
          <Link href="/" className="underline decoration-report-paper/40 underline-offset-4 hover:opacity-90">
            ← Portada
          </Link>
        </div>
      </div>

      <ReportCover
        title="Informe operativo de stock y ventas"
        subtitle="Análisis consolidado para la toma de decisiones. Los indicadores siguientes son de demostración y serán sustituidos por agregaciones sobre pilares y grada."
        meta={
          <p>
            <span className="font-semibold text-report-navy">Fecha de referencia:</span> {today}
          </p>
        }
      />

      <article className="mx-auto max-w-3xl space-y-14 px-6 py-12">
        <ReportSection number="1." title="Resumen ejecutivo">
          <p>
            La operación muestra una estructura de ventas y de inventario alineada a los cinco pilares (línea,
            referencia, material, color y grada). En esta demostración, el resumen cuantitativo aparece como
            valores ilustrativos hasta finalizar la conexión a las vistas analíticas en Supabase.
          </p>
          <p>
            Dirección debe poder responder, con este mismo lienzo: qué categorías concentran demanda, dónde hay
            saldo excedente y dónde hay faltantes que afectan continuidad comercial.
          </p>
        </ReportSection>

        <ReportSection number="2." title="Indicadores clave (demostración)">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { k: "Ventas (pares)", v: "12.480", n: "Periodo de referencia — placeholder" },
              { k: "Stock disponible", v: "8.920", n: "Incluye tiendas e importadora — placeholder" },
              { k: "Cobertura (días)", v: "46", n: "Metodología sujeta a validación — placeholder" },
              { k: "Ítems en riesgo de quiebre", v: "37", n: "Umbral configurable — placeholder" },
            ].map((x) => (
              <div
                key={x.k}
                className="border border-report-rule bg-white px-4 py-4 shadow-sm"
              >
                <p className="font-sans text-xs font-semibold uppercase tracking-wide text-report-muted">{x.k}</p>
                <p className="mt-2 font-serif text-3xl font-bold text-report-navy">{x.v}</p>
                <p className="mt-2 font-sans text-xs text-report-muted">{x.n}</p>
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection number="3." title="Cuadro resumen por categoría (demostración)">
          <p className="text-sm text-report-muted">
            Estructura tipo anexo estadístico. Las filas se reemplazarán por consultas agrupadas (por ejemplo,
            grupo de estilo o marca) respetando los filtros de la barra lateral que compartirá vocabulario con
            ventas web y Bazzar.
          </p>
          <div className="overflow-x-auto border border-report-rule bg-white shadow-sm">
            <table className="report-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Calzado urbano — dama", "4.210", "2.890", "0,69"],
                  ["Calzado vestir — caballero", "2.980", "2.100", "0,70"],
                  ["Temporada — niños", "1.560", "1.420", "0,91"],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td className="text-right tabular-nums">{row[1]}</td>
                    <td className="text-right tabular-nums">{row[2]}</td>
                    <td className="text-right tabular-nums">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection number="4." title="Nota metodológica">
          <p>
            Los datos operativos provienen del mismo repositorio que alimenta la web y los procesos internos. Las
            imágenes se obtienen de almacenamiento de objetos público; las series numéricas de esta copia son
            ficticias y no deben usarse para decisiones contractuales o financieras hasta la versión firmada.
          </p>
          <p>
            Próxima iteración: filtros persistentes (marca, línea, referencia, material, color, rango de fechas,
            canal) y gráficos de distribución y evolución temporal sobre la grada en formato Bazzar.
          </p>
        </ReportSection>
      </article>

      <ReportFooter />
    </div>
  );
}
