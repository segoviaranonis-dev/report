"use client";

import registros from "@/lib/situacion-financiera/registros-txt-erp.json";
import {
  PADRON_LEY,
  PROGRAMA_CHEQUES_VENCER,
  programasIntegrados,
} from "@/lib/situacion-financiera/padron-programa-erp";

type Registro = {
  archivo: string;
  programa_erp: string | null;
  tipo_codigo: string;
  titulo_informe?: string | null;
  fecha_emision?: string | null;
  hora_emision?: string | null;
  pagina?: number | null;
  filtros?: Record<string, string>;
  rol_sf: string;
  objetivo_sf: string;
  requerido_para_sf: boolean;
  estado_consumo: string;
  color_ui?: string;
};

type Data = {
  corte: string;
  actualizado: string;
  ley: string;
  resumen: {
    n_txt: number;
    n_requeridos_sf: number;
    n_control_o_candidato: number;
    n_programas: number;
    programas: string[];
  };
  por_programa: Record<string, { n: number; archivos: string[] }>;
  registros: Registro[];
};

const ROL_CLS: Record<string, string> = {
  requerido_sf: "bg-emerald-100 text-emerald-900 border-emerald-300",
  apoyo_sf: "bg-sky-100 text-sky-900 border-sky-300",
  candidato_manual: "bg-orange-100 text-orange-900 border-orange-300",
  control: "bg-slate-100 text-slate-700 border-slate-300",
  detectado: "bg-amber-50 text-amber-900 border-amber-200",
};

export function SitFinRegistrosTxtTab() {
  const data = registros as unknown as Data;
  const integros = programasIntegrados();

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded border border-[#1F4E79]/30 bg-[#F0F7FC] p-3 text-[12px] text-slate-800">
        <h3 className="font-serif text-sm font-semibold text-[#1F4E79]">
          Registros de TXT · programa Carlos (Hiedra)
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-slate-700">
          {data.ley}
        </p>
        <p className="mt-1 font-mono text-[10px] text-slate-600">{PADRON_LEY}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border bg-white px-2 py-1">
            Corte <strong>{data.corte}</strong>
          </span>
          <span className="rounded border border-emerald-400 bg-emerald-50 px-2 py-1">
            Requeridos SF: <strong>{data.resumen.n_requeridos_sf}</strong>
          </span>
          <span className="rounded border bg-white px-2 py-1">
            Control / candidato:{" "}
            <strong>{data.resumen.n_control_o_candidato}</strong>
          </span>
          <span className="rounded border bg-white px-2 py-1">
            Total TXT: <strong>{data.resumen.n_txt}</strong>
          </span>
          <span className="rounded border bg-white px-2 py-1">
            Programas if*: <strong>{data.resumen.n_programas}</strong>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Ejemplo íntegro:{" "}
          <code className="rounded bg-white px-1">{PROGRAMA_CHEQUES_VENCER}</code>{" "}
          · programas íntegros en padrón:{" "}
          <strong>{integros.map((p) => p.programa_erp).join(", ") || "—"}</strong>
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-slate-400 bg-white shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#0f3d3e] text-white">
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Programa
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Archivo
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Emisión
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Filtros / parámetros
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Rol SF
              </th>
              <th className="border border-slate-500 px-2 py-1.5 text-left">
                Objetivo
              </th>
            </tr>
          </thead>
          <tbody>
            {data.registros.map((r) => {
              const filtros = Object.entries(r.filtros || {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ");
              return (
                <tr
                  key={r.archivo}
                  className={
                    r.requerido_para_sf
                      ? "bg-emerald-50/40"
                      : "odd:bg-white even:bg-slate-50"
                  }
                >
                  <td className="border border-slate-300 px-2 py-1 align-top font-mono text-[11px] font-semibold text-[#1F4E79]">
                    {r.programa_erp || "—"}
                    <span className="mt-0.5 block font-sans text-[9px] font-normal text-slate-500">
                      {r.tipo_codigo} · {r.estado_consumo}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-2 py-1 align-top">
                    <span className="font-medium">{r.archivo}</span>
                    {r.titulo_informe ? (
                      <span className="mt-0.5 block text-[9px] text-slate-500">
                        {r.titulo_informe}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 align-top tabular-nums whitespace-nowrap">
                    {r.fecha_emision || "—"}
                    {r.hora_emision ? (
                      <span className="block text-[9px] text-slate-500">
                        {r.hora_emision}
                        {r.pagina != null ? ` · pág ${r.pagina}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 align-top font-mono text-[9px] text-slate-700">
                    {filtros || "—"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 align-top">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                        ROL_CLS[r.rol_sf] || ROL_CLS.detectado
                      }`}
                    >
                      {r.rol_sf}
                    </span>
                  </td>
                  <td className="border border-slate-300 px-2 py-1 align-top text-slate-800">
                    {r.objetivo_sf}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-500">
        Actualizado {data.actualizado} · regenerar:{" "}
        <code>python scripts/situacion-financiera/_build_registros_txt_erp.py</code>
      </p>
    </div>
  );
}
