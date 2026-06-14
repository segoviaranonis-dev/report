import Link from "next/link";
import { ReportAppNav } from "@/components/report/ReportAppNav";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReportSection } from "@/components/report/ReportSection";

const WEB_NAVY = "#1E3A5F";
const WEB_ORANGE = "#F97316";

const MODULES = [
  {
    id: "compra",
    title: "Compra",
    href: "/bazzar-web/compra",
    streamlit: "compra_web",
    summary: "Recepcionar traspasos ENVIADO → ALM_WEB_01 (INGRESO_COMPRA).",
  },
  {
    id: "deposito-web",
    title: "Depósito Web",
    href: "/bazzar-web/deposito-web",
    streamlit: "deposito_web",
    summary: "Consulta stock ALM_WEB_01 vía v_stock_web — 5 pilares + talla.",
  },
  {
    id: "motor-precio",
    title: "Motor de precio",
    href: "/bazzar-web/motor-precio",
    streamlit: "Nuevo (web_precio_caso + lista WEB)",
    summary: "Markup por caso y publicación precio_web para catálogo bazzar-web.",
  },
  {
    id: "stock-sano",
    title: "Stock Sano",
    href: "/bazzar-web/stock-sano",
    streamlit: "Nuevo (protocolo aduanero)",
    summary: "Precio canonico por depósito L+R+Material — ALM_WEB_01 activo.",
  },
] as const;

export default function InformesBazzarWebPage() {
  return (
    <div className="min-h-screen pb-16 bg-app-bg">
      <ReportAppNav active="informes" title="BAZZAR WEB — Anexo" maxWidthClass="max-w-3xl" />

      <header className="mx-auto max-w-3xl px-6 pt-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: WEB_ORANGE }}>
          Anexo documental · Ente BAZZAR WEB
        </p>
        <h1 className="font-serif text-3xl font-light" style={{ color: WEB_NAVY }}>
          Índice operativo e-commerce
        </h1>
        <p className="mt-3 text-sm text-neutral-ink-medium leading-relaxed">
          Documentación de migración Streamlit → Report y cadena ALM_WEB_01 → precio_web → tienda{" "}
          <span className="font-mono text-xs">www.bazzar.com.py</span>.
          Fuente repo: <span className="font-mono text-xs">report/docs/bazzar-web/</span>
        </p>
      </header>

      <article className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <ReportSection number="0." title="Cadena operativa">
          <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
{`Facturación RIMEC (traspaso ENVIADO)
        ↓
   COMPRA WEB — confirmar recepción → ALM_WEB_01
        ↓
   DEPÓSITO WEB — stock en v_stock_web
        ↓
   MOTOR DE PRECIO — precio_web (lista WEB)
        ↓
   Tienda bazzar-web — pedido + reserva stock`}
          </pre>
        </ReportSection>

        {MODULES.map((mod, i) => (
          <section key={mod.id} id={mod.id} className="scroll-mt-24">
            <ReportSection number={`${i + 1}.`} title={mod.title}>
              <p>{mod.summary}</p>
              <p className="text-sm text-report-muted mt-2">
                Streamlit: <span className="font-mono">{mod.streamlit}</span>
              </p>
              {mod.id === "deposito-web" && (
                <p className="mt-2 text-xs text-report-muted">
                  Clon Report: ETAPA_DEPOSITO_WEB_002 — movimientos INGRESO_COMPRA ALM_WEB_01
                </p>
              )}
              <Link
                href={mod.href}
                className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: WEB_NAVY }}
              >
                Abrir módulo en panel
              </Link>
            </ReportSection>
          </section>
        ))}

        <ReportSection number="4." title="Roles Report">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>rol_id=1 — Compra, Depósito Web, Motor precio</li>
            <li>rol_id=2 + ADMIN — Compra y Depósito Web (no Motor precio)</li>
            <li>Repo tienda: bazzar-web · plan: PLAN_ENTREGA_BAZZAR_WEB.md</li>
          </ul>
        </ReportSection>

        <ReportSection number="5." title="ETAPA COMPRA-WEB-003 — Cliente 5000">
          <p className="text-sm">
            Compra Web solo muestra traspasos del cliente <strong>5000</strong> (canal e-commerce).
            Traspasos a ALM_WEB_01 de otros clientes quedan fuera del panel.
          </p>
          <p className="mt-2 text-xs font-mono text-report-muted">
            report/docs/bazzar-web/ETAPA_COMPRA_WEB_003_CLIENTE_5000.md
          </p>
        </ReportSection>

        <ReportSection number="6." title="ETAPA COMPRA-WEB-001 — Mapeo tablas">
          <p className="text-sm">
            Paso 1 de migración Compra Web: inventario de tablas Supabase (escritura, lectura, upstream, vistas).
          </p>
          <p className="mt-2 text-xs font-mono text-report-muted">
            report/docs/bazzar-web/ETAPA_COMPRA_WEB_001_MAPEO_TABLAS.md
          </p>
        </ReportSection>
      </article>

      <ReportFooter />
    </div>
  );
}
