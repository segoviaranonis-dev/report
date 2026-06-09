import { NexusHeaderZen } from "@/components/report/NexusHeaderZen";
import { ReportFooter } from "@/components/report/ReportFooter";
import { ReportSection } from "@/components/report/ReportSection";
import { AprobacionesClient } from "./AprobacionesClient";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const today = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date());

function mapEstado(dbEstado: string | null): "PENDIENTE" | "APROBADO" | "RECHAZADO" {
  if (!dbEstado) return "PENDIENTE";
  const upper = dbEstado.toUpperCase();
  if (upper.includes("APROBADO") || upper.includes("CONFIRMADO")) return "APROBADO";
  if (upper.includes("RECHAZADO") || upper.includes("CANCELADO")) return "RECHAZADO";
  return "PENDIENTE";
}

export default async function AprobacionesPage() {
  const t0 = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { data, error } =
    supabaseUrl && supabaseKey
      ? await createClient(supabaseUrl, supabaseKey).from("v_aprobaciones_detalladas").select("*").limit(50)
      : { data: null, error: new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY") };

  if (error) {
    console.error("Error fetching pedidos:", error);
  }

  const pedidos =
    data?.map((p: any) => ({
      id: p.id,
      nro_pedido: p.nro_pedido || `PVR-${p.id}`,
      fecha: p.fecha_creacion
        ? new Date(p.fecha_creacion).toLocaleDateString("es-PY", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
      vendedor: p.vendedor_nombre || `Vendedor ${p.vendedor_id || "?"}`,
      cliente: p.cliente_nombre || `Cliente ${p.cliente_id || "?"}`,
      total: p.total_monto || 0,
      items_count: p.total_pares || 0,
      estado: mapEstado(p.estado),
      descuento_porcentaje: p.descuento_1 || 0,
      plazo: p.plazo_id ? `Plazo ${p.plazo_id}` : "EFECTIVO",
      lista_precio: p.lista_precio_id ? `LP${p.lista_precio_id}` : "LP1",
    })) || [];

  const t1 = Date.now();
  console.log(`[SSR] Pedidos cargados en ${t1 - t0}ms (servidor)`);

  return (
    <div className="min-h-screen bg-app-bg pb-16 text-neutral-ink">
      {/* Header Unificado con Tabs Empresariales */}
      <NexusHeaderZen active="aprobaciones" />

      {/* Título del Módulo - Serif Elegante */}
      <section className="bg-card-bg border-b-2 border-neutral-300 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="font-serif text-4xl font-light text-rimec-azul-dark">
            Aprobación de Pedidos RIMEC Web
          </h1>
          <p className="mt-2 text-sm text-neutral-700">Control centralizado de pedidos · {today}</p>
        </div>
      </section>

      {/* Client Component con interactividad */}
      <AprobacionesClient pedidosIniciales={pedidos} />

      <article className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        <ReportSection number="2." title="Notas de operación">
          <ul className="list-inside list-disc space-y-1.5 text-sm text-report-muted">
            <li>
              Los pedidos con estado <strong className="text-report-ink">PENDIENTE</strong> requieren aprobación manual
              del administrador.
            </li>
            <li>
              Al <strong>aprobar</strong> un pedido, el estado cambia a{" "}
              <strong className="text-emerald-700">APROBADO</strong> y queda registrado en el historial.
            </li>
            <li>
              Al <strong>rechazar</strong> un pedido, se puede agregar un motivo opcional que quedará registrado.
            </li>
            <li>
              Los datos se actualizan automáticamente después de cada acción. El historial completo está disponible con
              el filtro <strong>TODOS</strong>.
            </li>
          </ul>
        </ReportSection>
      </article>

      <ReportFooter note="Aprobación de Pedidos · Módulo de gestión para control centralizado de pedidos web generados desde RIMEC" />
    </div>
  );
}
