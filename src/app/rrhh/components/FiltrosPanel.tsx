import type { Ente, FiltrosRRHH } from "../lib/types";

interface FiltrosPanelProps {
  filtros: FiltrosRRHH;
  onFiltroChange: (filtros: Partial<FiltrosRRHH>) => void;
  onLimpiar: () => void;
  entes: Ente[];
  departamentos: string[];
  cargos: string[];
  filtrosActivos: number;
}

export function FiltrosPanel({
  filtros,
  onFiltroChange,
  onLimpiar,
  entes,
  departamentos,
  cargos,
  filtrosActivos,
}: FiltrosPanelProps) {
  return (
    <div className="mb-8 rounded-lg border border-neutral-200 bg-card-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-ink">Filtros</h2>
        {filtrosActivos > 0 && (
          <span className="rounded-full bg-rimec-azul px-3 py-1 text-xs font-bold text-white">
            {filtrosActivos} activo{filtrosActivos > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Filtro: Ente */}
        <div>
          <label
            htmlFor="filtro-ente"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600"
          >
            Ente
          </label>
          <select
            id="filtro-ente"
            value={filtros.ente_id ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              onFiltroChange({ ente_id: value ? Number(value) : undefined });
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-ink transition-colors hover:border-rimec-azul focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          >
            <option value="">Todos los entes</option>
            {entes.map((ente) => (
              <option key={ente.id_ente} value={ente.id_ente}>
                {ente.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro: Departamento */}
        <div>
          <label
            htmlFor="filtro-departamento"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600"
          >
            Departamento
          </label>
          <select
            id="filtro-departamento"
            value={filtros.departamento ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              onFiltroChange({ departamento: value || undefined });
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-ink transition-colors hover:border-rimec-azul focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((dpto) => (
              <option key={dpto} value={dpto}>
                {dpto}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro: Cargo */}
        <div>
          <label
            htmlFor="filtro-cargo"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600"
          >
            Cargo
          </label>
          <select
            id="filtro-cargo"
            value={filtros.cargo ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              onFiltroChange({ cargo: value || undefined });
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-ink transition-colors hover:border-rimec-azul focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          >
            <option value="">Todos los cargos</option>
            {cargos.map((cargo) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro: Búsqueda */}
        <div>
          <label
            htmlFor="filtro-buscar"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-600"
          >
            Buscar
          </label>
          <input
            id="filtro-buscar"
            type="text"
            placeholder="Nombre o CI..."
            value={filtros.buscar ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              onFiltroChange({ buscar: value || undefined });
            }}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-ink placeholder:text-neutral-400 transition-colors hover:border-rimec-azul focus:border-rimec-azul focus:outline-none focus:ring-2 focus:ring-rimec-azul/20"
          />
        </div>
      </div>

      {/* Botón limpiar (solo visible si hay filtros activos) */}
      {filtrosActivos > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onLimpiar}
            className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
