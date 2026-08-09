"use client";

import audit from "@/lib/situacion-financiera/audit-mapa-al-0308.json";
import inventario from "@/lib/situacion-financiera/inventario-intake-al-0308.json";

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PY").format(Math.round(n));
}

const ESTILO: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  descuadre: "bg-red-100 text-red-900",
  excel_cero_txt_tiene: "bg-amber-100 text-amber-950",
  sin_txt: "bg-slate-100 text-slate-700",
  manual: "bg-orange-100 text-orange-900",
  pendiente: "bg-violet-100 text-violet-900",
  excel_prevision: "bg-sky-100 text-sky-900",
  calc: "bg-yellow-100 text-yellow-900",
  mapeado_auditado: "bg-emerald-100 text-emerald-900",
  inventariado: "bg-sky-50 text-sky-900",
  inventariado_control: "bg-slate-100 text-slate-800",
  pendiente_filtro: "bg-violet-100 text-violet-900",
};

export function SitFinAuditoriaTab() {
  const r = (audit.resumen || {}) as Record<string, number>;
  const inv = inventario as {
    n_archivos_intake: number;
    n_items_mapa: number;
    por_estado: Record<string, number>;
    completo_intake: boolean;
    items: Array<{
      archivo: string;
      familia: string;
      sit_fin: string;
      origen: string;
      estado: string;
      n: number | null;
      gs: number | null;
      nota: string;
      mol_key: string | null;
    }>;
  };
  const filas = (audit.filas || []) as Array<{
    r: number;
    label: string;
    origen: string;
    estado: string;
    mol_key: string | null;
    excel_gs: number | null;
    txt_gs: number | null;
    canon_gs: number | null;
    delta_excel_minus_txt: number | null;
    archivo: string | null;
  }>;
  const cheques = (audit.txt_cheques || {}) as Record<
    string,
    { archivo: string; n: number; gs: number }
  >;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-slate-700">
        <strong>Auditoría + inventario intake AL 03-08</strong> —{" "}
        {inv.n_archivos_intake} archivos en disco · {inv.n_items_mapa} ítems
        mapeados ·{" "}
        {inv.completo_intake ? (
          <span className="font-semibold text-emerald-800">
            cobertura intake CERRADA
          </span>
        ) : (
          <span className="font-semibold text-amber-800">cobertura parcial</span>
        )}
        . Canon: cheques/aging = TXT · previsiones mes + DIF.COBRO = Excel-Guido ·
        bancos/gastos/Bazzar = manual · ventas = control (fuera celda Sit Fin).
      </p>

      <section className="rounded border border-slate-300 bg-white p-3">
        <h3 className="font-serif text-sm font-semibold">
          1 · Inventario intake (todo el paquete)
        </h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(inv.por_estado || {}).map(([k, v]) => (
            <span
              key={k}
              className={`rounded border px-2 py-1 ${ESTILO[k] || "bg-white"}`}
            >
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[880px] text-[11px]">
            <thead>
              <tr className="bg-[#0f3d3e] text-white">
                <th className="px-2 py-1.5 text-left">Archivo</th>
                <th className="px-2 py-1.5 text-left">Familia</th>
                <th className="px-2 py-1.5 text-left">→ Sit Fin</th>
                <th className="px-2 py-1.5 text-left">Estado</th>
                <th className="px-2 py-1.5 text-right">N</th>
                <th className="px-2 py-1.5 text-right">Gs</th>
                <th className="px-2 py-1.5 text-left">Nota</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it) => (
                <tr
                  key={it.archivo + it.familia}
                  className={`border-t border-slate-200 ${ESTILO[it.estado] || ""}`}
                >
                  <td className="px-2 py-1 font-mono text-[10px]">
                    {it.archivo}
                  </td>
                  <td className="px-2 py-1">{it.familia}</td>
                  <td className="px-2 py-1">{it.sit_fin}</td>
                  <td className="px-2 py-1 font-semibold">{it.estado}</td>
                  <td className="px-2 py-1 text-right">{it.n ?? "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {fmt(it.gs)}
                  </td>
                  <td className="px-2 py-1 text-[10px] text-slate-700">
                    {it.nota}
                    {it.mol_key ? (
                      <div className="font-mono text-sky-800">{it.mol_key}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="font-semibold text-slate-600">Filas Sit Fin:</span>
        {Object.entries(r).map(([k, v]) => (
          <span
            key={k}
            className={`rounded border px-2 py-1 ${ESTILO[k] || "bg-white"}`}
          >
            {k}: <strong>{v}</strong>
          </span>
        ))}
      </div>

      <section className="rounded border border-slate-300 bg-white p-3">
        <h3 className="font-serif text-sm font-semibold">
          2 · Mapa TXT cheques (documentado)
        </h3>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="px-2 py-1">Mes</th>
              <th className="px-2 py-1">Archivo</th>
              <th className="px-2 py-1 text-right">N</th>
              <th className="px-2 py-1 text-right">Gs TXT</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(cheques).map(([ym, info]) => (
              <tr key={ym} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono">{ym}</td>
                <td className="px-2 py-1">{info.archivo}</td>
                <td className="px-2 py-1 text-right">{info.n}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {fmt(info.gs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded border border-slate-300 bg-white">
        <h3 className="border-b border-slate-200 px-3 py-2 font-serif text-sm font-semibold">
          3 · Cruce fila Excel ↔ TXT / canon
        </h3>
        <table className="w-full min-w-[960px] text-[11px]">
          <thead>
            <tr className="bg-[#0f3d3e] text-white">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Concepto Excel</th>
              <th className="px-2 py-1.5 text-left">Estado</th>
              <th className="px-2 py-1.5 text-right">Excel Gs</th>
              <th className="px-2 py-1.5 text-right">TXT Gs</th>
              <th className="px-2 py-1.5 text-right">Canon Gs</th>
              <th className="px-2 py-1.5 text-right">Δ Excel−TXT</th>
              <th className="px-2 py-1.5 text-left">Clave / doc</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.r}
                className={`border-t border-slate-200 ${ESTILO[f.estado] || ""}`}
              >
                <td className="px-2 py-1 font-mono">{f.r}</td>
                <td className="px-2 py-1 max-w-[220px]">{f.label}</td>
                <td className="px-2 py-1 font-semibold">{f.estado}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {fmt(f.excel_gs)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {fmt(f.txt_gs)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold">
                  {fmt(f.canon_gs)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {fmt(f.delta_excel_minus_txt)}
                </td>
                <td className="px-2 py-1">
                  <div className="font-mono text-[10px]">{f.mol_key || "—"}</div>
                  <div className="text-[10px] text-slate-600">
                    {f.archivo || ""}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
