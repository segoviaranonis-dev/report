import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";

export default function TabletBazzarPage() {
  return (
    <div className="min-h-screen bg-report-bg">
      <NexusGlobalHeader active="tablet-bazzar" title="Tablet Bazzar" />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-12">
          <h1 className="mb-4 font-serif text-4xl font-light text-report-primary">
            📱 Tablet Bazzar
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-report-muted">
            Sistema punto de venta para vendedores en tienda física.
            Registro de clientes, generación de tickets, gestión de ventas retail con pilares y agrupaciones.
          </p>
        </header>

        {/* Placeholder - En construcción */}
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-6xl">🚧</div>
            <h2 className="mb-3 text-2xl font-semibold text-slate-700">
              Módulo en Construcción
            </h2>
            <p className="text-slate-500">
              La herramienta Tablet Bazzar está siendo desarrollada.
            </p>
            <div className="mt-8 space-y-2 text-left text-sm text-slate-600">
              <p className="font-semibold text-slate-700">Próximas funcionalidades:</p>
              <ul className="ml-4 space-y-1 list-disc">
                <li>Registro de vendedores de tienda</li>
                <li>Gestión de clientes (cliente_web)</li>
                <li>Creación de tickets de venta</li>
                <li>Integración con depósitos de tienda</li>
                <li>Pilares (Línea, Ref, Material, Color, Talla)</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
