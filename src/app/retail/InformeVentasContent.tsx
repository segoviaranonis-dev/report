"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  COLOR_OBJETIVO,
  COLOR_REAL_ACTUAL,
  COLOR_REAL_ANTERIOR,
  chartColorAt,
  RIMEC_RECHARTS_TOOLTIP,
} from "@/app/rimec/chart-theme";

// Estilos CSS para impresión - reducir tamaño de gráficos en PDF
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      .grafico-container {
        max-height: 150px !important;
        height: 150px !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
      }
      .grafico-container .recharts-wrapper {
        max-height: 150px !important;
        height: 150px !important;
      }
      .grafico-container .recharts-surface {
        max-height: 150px !important;
      }
      .grafico-torta {
        max-height: 150px !important;
        height: 150px !important;
      }
      .grafico-barras {
        max-height: 150px !important;
        height: 150px !important;
      }
      /* Reducir padding para ahorrar espacio */
      .grafico-container {
        padding: 0.5rem !important;
      }
    }
  `;
  if (!document.querySelector('#graficos-print-styles')) {
    style.id = 'graficos-print-styles';
    document.head.appendChild(style);
  }
}

const fmtInt = (n: number) => n.toLocaleString("es-PY", { maximumFractionDigits: 0 });
const MARCAS_ADULTOS = ['BEIRA RIO', 'VIZZANO', 'MOLECA', 'MODARE', 'BR SPORT', 'ACTVITTA', 'CHINELO'];
const MARCAS_NINOS = ['MOLEKINHA', 'MOLEKINHO'];

type Props = {
  arbol: any[];
};

export function InformeVentasContent({ arbol }: Props) {
  const [expandedEnte, setExpandedEnte] = useState<string | null>(null);
  const [expandedInformeMarcas, setExpandedInformeMarcas] = useState(false);
  const [expandedRendimientoCantidad, setExpandedRendimientoCantidad] = useState(false);
  const [expandedRendimientoMonto, setExpandedRendimientoMonto] = useState(false);
  const [expandedRendimientoGeneral, setExpandedRendimientoGeneral] = useState(false);

  // Filtrar RIMEC
  const tiendas = arbol.filter(ente => ente.nombre !== "RIMEC");

  // Calcular total general
  const totalGeneral = tiendas.reduce((sum, ente) => sum + (ente.venta || 0), 0);

  return (
    <div className="border-t border-report-rule bg-report-paper">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <h2 className="text-2xl font-bold text-report-navy">Informe de Ventas</h2>

        {/* INFORME POR MARCAS */}
        <div className="border border-report-rule rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="w-full px-6 py-4 flex items-center justify-between bg-report-navy text-white">
            <button
              type="button"
              onClick={() => setExpandedInformeMarcas(!expandedInformeMarcas)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg">{expandedInformeMarcas ? '▼' : '▶'}</span>
              <h3 className="text-lg font-bold">INFORME POR MARCAS</h3>
            </button>
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold">
                Total General: {fmtInt(totalGeneral)} pares
              </div>
              {expandedInformeMarcas && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-white text-report-navy rounded text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  📄 Exportar PDF
                </button>
              )}
            </div>
          </div>

          {expandedInformeMarcas && (
            <div id="informe-marcas-content" className="p-4 space-y-4">
              {tiendas.map((ente) => (
                <TiendaCard
                  key={ente.nombre}
                  ente={ente}
                  isExpanded={expandedEnte === ente.nombre}
                  onToggle={() => setExpandedEnte(expandedEnte === ente.nombre ? null : ente.nombre)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RENDIMIENTO CANTIDAD */}
        <div className="border border-report-rule rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="w-full px-6 py-4 flex items-center justify-between bg-report-navy text-white">
            <button
              type="button"
              onClick={() => setExpandedRendimientoCantidad(!expandedRendimientoCantidad)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg">{expandedRendimientoCantidad ? '▼' : '▶'}</span>
              <h3 className="text-lg font-bold">RENDIMIENTO CANTIDAD</h3>
            </button>
            {expandedRendimientoCantidad && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white text-report-navy rounded text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                📄 Exportar PDF
              </button>
            )}
          </div>

          {expandedRendimientoCantidad && (
            <div id="rendimiento-cantidad-content" className="p-6">
              <RendimientoContent tiendas={tiendas} tipo="cantidad" />
            </div>
          )}
        </div>

        {/* RENDIMIENTO MONTO */}
        <div className="border border-report-rule rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="w-full px-6 py-4 flex items-center justify-between bg-report-navy text-white">
            <button
              type="button"
              onClick={() => setExpandedRendimientoMonto(!expandedRendimientoMonto)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg">{expandedRendimientoMonto ? '▼' : '▶'}</span>
              <h3 className="text-lg font-bold">RENDIMIENTO MONTO</h3>
            </button>
            {expandedRendimientoMonto && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white text-report-navy rounded text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                📄 Exportar PDF
              </button>
            )}
          </div>

          {expandedRendimientoMonto && (
            <div id="rendimiento-monto-content" className="p-6">
              <RendimientoContent tiendas={tiendas} tipo="monto" />
            </div>
          )}
        </div>

        {/* RENDIMIENTO GENERAL */}
        <div className="border border-report-rule rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="w-full px-6 py-4 flex items-center justify-between bg-report-navy text-white">
            <button
              type="button"
              onClick={() => setExpandedRendimientoGeneral(!expandedRendimientoGeneral)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg">{expandedRendimientoGeneral ? '▼' : '▶'}</span>
              <h3 className="text-lg font-bold">RENDIMIENTO GENERAL</h3>
            </button>
            {expandedRendimientoGeneral && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-white text-report-navy rounded text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                📄 Exportar PDF
              </button>
            )}
          </div>

          {expandedRendimientoGeneral && (
            <div id="rendimiento-general-content" className="p-6">
              <RendimientoGeneralContent tiendas={tiendas} />
            </div>
          )}
        </div>

        {/* INFORME TEMPORALES */}
        <div>
          <h3 className="text-xl font-bold text-report-navy mb-4">INFORME TEMPORALES</h3>
          <p className="text-sm text-report-muted mb-4">
            Selecciona las semanas para analizar las ventas por marca y segmento
          </p>
          <div className="border border-report-rule rounded-lg p-6 bg-white">
            <p className="text-report-muted">En desarrollo...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RendimientoGeneralContent({ tiendas }: { tiendas: any[] }) {
  // Consolidar montos de todas las tiendas por marca
  const marcasMontoGeneral = new Map<string, number>();
  const todasLasMarcas = [...MARCAS_ADULTOS, ...MARCAS_NINOS];

  tiendas.forEach(tienda => {
    if (tienda.hijos?.length > 0) {
      tienda.hijos.forEach((genero: any) => {
        if (genero.hijos?.length > 0) {
          genero.hijos.forEach((marca: any) => {
            const marcaNombre = marca.nombre.toUpperCase();
            if (todasLasMarcas.includes(marcaNombre)) {
              // Calcular monto (cantidad × precio estimado)
              let monto = 0;
              if (marca.hijos?.length > 0) {
                marca.hijos.forEach((sku: any) => {
                  const cantidad = sku.venta || 0;
                  monto += cantidad * 100000; // Precio promedio estimado
                });
              } else {
                monto = (marca.venta || 0) * 100000;
              }

              marcasMontoGeneral.set(marcaNombre, (marcasMontoGeneral.get(marcaNombre) || 0) + monto);
            }
          });
        }
      });
    }
  });

  return (
    <div className="space-y-12">
      {/* ADULTOS */}
      <div>
        <h4 className="text-lg font-bold text-report-navy mb-4">👨 ADULTOS</h4>
        <SegmentoRendimientoGeneral marcas={MARCAS_ADULTOS} marcasMontoGeneral={marcasMontoGeneral} />
      </div>

      {/* NIÑOS */}
      <div>
        <h4 className="text-lg font-bold text-report-navy mb-4">👶 NIÑOS</h4>
        <SegmentoRendimientoGeneral marcas={MARCAS_NINOS} marcasMontoGeneral={marcasMontoGeneral} />
      </div>
    </div>
  );
}

function SegmentoRendimientoGeneral({
  marcas,
  marcasMontoGeneral
}: {
  marcas: string[];
  marcasMontoGeneral: Map<string, number>;
}) {
  const marcasOrdenadas = marcas
    .filter(m => marcasMontoGeneral.has(m))
    .sort((a, b) => (marcasMontoGeneral.get(b) || 0) - (marcasMontoGeneral.get(a) || 0));

  // Preparar datos para el gráfico
  const chartData = marcasOrdenadas.map(marca => ({
    marca,
    monto: marcasMontoGeneral.get(marca) || 0
  }));

  return (
    <div className="space-y-6">
      {/* Tabla */}
      <div className="border border-report-rule rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-report-navy text-white">
              <th className="py-3 px-4 text-left font-semibold">MARCA</th>
              <th className="py-3 px-4 text-right font-semibold">MONTO TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {marcasOrdenadas.map((marca, idx) => (
              <tr key={marca} className={idx % 2 === 0 ? 'bg-white' : 'bg-report-paper2/30'}>
                <td className="py-2.5 px-4 font-medium text-report-navy">{marca}</td>
                <td className="py-2.5 px-4 text-right tabular-nums text-report-ink font-semibold">
                  ₲{fmtInt(marcasMontoGeneral.get(marca) || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-report-paper2 border-t-2 border-report-navy/30">
              <td className="py-3 px-4 font-semibold text-report-navy">TOTAL</td>
              <td className="py-3 px-4 text-right tabular-nums font-bold text-report-navy">
                ₲{fmtInt(marcasOrdenadas.reduce((sum, m) => sum + (marcasMontoGeneral.get(m) || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Gráfico de Barras */}
      <div className="grafico-container grafico-barras border border-report-rule rounded-lg p-6 bg-white">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="marca" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip
              {...RIMEC_RECHARTS_TOOLTIP}
              formatter={(value) => `₲${fmtInt(Number(value))}`}
            />
            <Bar dataKey="monto" fill={COLOR_REAL_ACTUAL} name="Monto" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RendimientoContent({ tiendas, tipo }: { tiendas: any[]; tipo: 'cantidad' | 'monto' }) {
  // Procesar datos: crear mapa de marca -> { tienda1: valor, tienda2: valor, ... }
  const marcasRendimiento = new Map<string, { [tienda: string]: number }>();
  const todasLasMarcas = [...MARCAS_ADULTOS, ...MARCAS_NINOS];

  tiendas.forEach(tienda => {
    if (tienda.hijos?.length > 0) {
      tienda.hijos.forEach((genero: any) => {
        if (genero.hijos?.length > 0) {
          genero.hijos.forEach((marca: any) => {
            const marcaNombre = marca.nombre.toUpperCase();
            if (todasLasMarcas.includes(marcaNombre)) {
              if (!marcasRendimiento.has(marcaNombre)) {
                marcasRendimiento.set(marcaNombre, {});
              }
              const current = marcasRendimiento.get(marcaNombre)!;

              // Calcular cantidad o monto según el tipo
              let valor = 0;
              if (marca.hijos?.length > 0) {
                // Si hay hijos (SKUs), sumar desde ahí
                marca.hijos.forEach((sku: any) => {
                  if (tipo === 'cantidad') {
                    valor += sku.venta || 0;
                  } else {
                    // Monto = cantidad × precio (si no hay precio, calcular promedio del total)
                    const cantidad = sku.venta || 0;
                    // Asumiendo que no tenemos precio_unitario en el árbol, usamos el total de la marca
                    valor += cantidad * 100000; // Valor promedio estimado por ahora
                  }
                });
              } else {
                // Si no hay hijos, usar el total de la marca directamente
                if (tipo === 'cantidad') {
                  valor = marca.venta || 0;
                } else {
                  // Para monto, multiplicar por un precio estimado
                  valor = (marca.venta || 0) * 100000; // Precio promedio estimado
                }
              }

              current[tienda.nombre] = (current[tienda.nombre] || 0) + valor;
            }
          });
        }
      });
    }
  });

  const nombresTiendas = tiendas.map(t => t.nombre);

  return (
    <div className="space-y-12">
      {/* ADULTOS */}
      <div>
        <h4 className="text-lg font-bold text-report-navy mb-4">👨 ADULTOS</h4>
        <SegmentoRendimiento
          marcas={MARCAS_ADULTOS}
          marcasRendimiento={marcasRendimiento}
          nombresTiendas={nombresTiendas}
          tipo={tipo}
        />
      </div>

      {/* NIÑOS */}
      <div>
        <h4 className="text-lg font-bold text-report-navy mb-4">👶 NIÑOS</h4>
        <SegmentoRendimiento
          marcas={MARCAS_NINOS}
          marcasRendimiento={marcasRendimiento}
          nombresTiendas={nombresTiendas}
          tipo={tipo}
        />
      </div>
    </div>
  );
}

function SegmentoRendimiento({
  marcas,
  marcasRendimiento,
  nombresTiendas,
  tipo
}: {
  marcas: string[];
  marcasRendimiento: Map<string, { [tienda: string]: number }>;
  nombresTiendas: string[];
  tipo: 'cantidad' | 'monto';
}) {
  const marcasOrdenadas = marcas.filter(m => marcasRendimiento.has(m));

  // Preparar datos para el gráfico de barras
  const chartData = marcasOrdenadas.map(marca => {
    const datos: any = { marca };
    const marcaData = marcasRendimiento.get(marca) || {};
    nombresTiendas.forEach(tienda => {
      datos[tienda] = marcaData[tienda] || 0;
    });
    return datos;
  });

  const COLORES_TIENDAS: { [key: string]: string } = {
    Fernando: COLOR_REAL_ACTUAL,
    Palma: COLOR_REAL_ANTERIOR,
    "San Martin": COLOR_OBJETIVO,
  };

  const formatValor = (valor: number) => {
    if (tipo === 'monto') {
      return `₲${fmtInt(valor)}`;
    }
    return fmtInt(valor);
  };

  return (
    <div className="space-y-6">
      {/* Tabla */}
      <div className="border border-report-rule rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-report-navy text-white">
              <th className="py-3 px-4 text-left font-semibold">MARCA</th>
              {nombresTiendas.map(tienda => (
                <th key={tienda} className="py-3 px-4 text-right font-semibold">{tienda.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marcasOrdenadas.map((marca, idx) => {
              const marcaData = marcasRendimiento.get(marca) || {};
              return (
                <tr key={marca} className={idx % 2 === 0 ? 'bg-white' : 'bg-report-paper2/30'}>
                  <td className="py-2.5 px-4 font-medium text-report-navy">{marca}</td>
                  {nombresTiendas.map(tienda => (
                    <td key={tienda} className="py-2.5 px-4 text-right tabular-nums text-report-ink">
                      {formatValor(marcaData[tienda] || 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gráfico de Barras Agrupadas */}
      <div className="grafico-container grafico-barras border border-report-rule rounded-lg p-6 bg-white">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="marca" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip
              {...RIMEC_RECHARTS_TOOLTIP}
              formatter={(value) => formatValor(Number(value))}
            />
            <Legend />
            {nombresTiendas.map((tienda, idx) => (
              <Bar
                key={tienda}
                dataKey={tienda}
                fill={COLORES_TIENDAS[tienda] || chartColorAt(idx)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TiendaCard({ ente, isExpanded, onToggle }: { ente: any; isExpanded: boolean; onToggle: () => void }) {
  const marcasMap = new Map<string, number>();

  if (ente.hijos?.length > 0) {
    ente.hijos.forEach((genero: any) => {
      if (genero.hijos?.length > 0) {
        genero.hijos.forEach((marca: any) => {
          const current = marcasMap.get(marca.nombre) || 0;
          marcasMap.set(marca.nombre, current + (marca.venta || 0));
        });
      }
    });
  }

  const marcasData: { marca: string; cantidad: number }[] = [];
  marcasMap.forEach((cantidad, marca) => {
    marcasData.push({ marca, cantidad });
  });

  const marcasAdultos = marcasData.filter(m => MARCAS_ADULTOS.includes(m.marca.toUpperCase())).sort((a, b) => b.cantidad - a.cantidad);
  const marcasNinos = marcasData.filter(m => MARCAS_NINOS.includes(m.marca.toUpperCase())).sort((a, b) => b.cantidad - a.cantidad);

  return (
    <div className="border border-report-rule rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-report-paper2 hover:bg-report-paper transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg text-report-navy2">{isExpanded ? '▼' : '▶'}</span>
          <h3 className="text-lg font-bold text-report-navy">{ente.nombre}</h3>
          <span className="text-sm text-report-muted">({fmtInt(ente.venta || 0)} pares vendidos)</span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 space-y-8">
          <SegmentoMarcas titulo="ADULTOS" marcas={marcasAdultos} icono="👨" />
          <SegmentoMarcas titulo="NIÑOS" marcas={marcasNinos} icono="👶" />
        </div>
      )}
    </div>
  );
}

function SegmentoMarcas({ titulo, marcas, icono }: { titulo: string; marcas: { marca: string; cantidad: number }[]; icono: string }) {
  const chartData = marcas.map(m => ({ name: m.marca, value: m.cantidad }));

  return (
    <div>
      <h5 className="text-sm font-bold text-report-navy mb-3">{icono} {titulo}</h5>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-report-rule rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-report-paper2 border-b border-report-rule">
                <th className="py-3 px-4 text-left font-semibold text-report-navy">Marca</th>
                <th className="py-3 px-4 text-right font-semibold text-report-navy">Cantidad (pares)</th>
              </tr>
            </thead>
            <tbody>
              {marcas.map((item) => (
                <tr key={item.marca} className="border-b border-report-rule/50 hover:bg-report-paper2/50">
                  <td className="py-2.5 px-4 text-report-ink">{item.marca}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-report-ink font-semibold">
                    {fmtInt(item.cantidad)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-report-paper2 border-t-2 border-report-navy/30">
                <td className="py-3 px-4 font-semibold text-report-navy">Total</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-report-navy">
                  {fmtInt(marcas.reduce((sum, m) => sum + m.cantidad, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grafico-container grafico-torta border border-report-rule rounded-lg p-4 bg-white">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill={COLOR_REAL_ANTERIOR}
                dataKey="value"
                label={({ percent }) => percent ? `${(percent * 100).toFixed(1)}%` : ''}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColorAt(index)} />
                ))}
              </Pie>
              <Tooltip
                {...RIMEC_RECHARTS_TOOLTIP}
                formatter={(value) => fmtInt(Number(value))}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
