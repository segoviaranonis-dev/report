"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: number;
  nombre: string;
  marcas: string[];
  depositos: string[];
  ramo: string;
  origen: string;
  horas: string[];
  prep_horas: string[];
  dias_texto: string;
  para_quien: string;
  n_personas: number;
};

/**
 * Menú del día — lo que ya está programado (lenguaje claro, no técnico).
 */
export function MenuDiarioAutomatizaciones({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [prepMin, setPrepMin] = useState(10);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/automatizacion-informes/listar", { cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: Item[];
        prep_minutos?: number;
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "No se pudo cargar el menú");
      setItems(j.items ?? []);
      setPrepMin(j.prep_minutos ?? 10);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="mt-14 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            Menú del día
          </h2>
          <h3 className="mt-1 font-serif text-2xl font-semibold text-slate-900">
            Envíos ya programados
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Acá ves qué informes salen solos, a qué hora y a quién. El sistema empieza a armar
            los PDF unos <strong>{prepMin} minutos antes</strong> para que lleguen con fotos
            completas; a la hora exacta avisa por correo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50"
        >
          Actualizar lista
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Cargando menú…</p>
      )}
      {err && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {err}
        </p>
      )}

      {!loading && !items.length && !err && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="font-serif text-lg text-slate-700">Todavía no hay envíos armados</p>
          <p className="mt-2 text-sm text-slate-500">
            Completá el panel de arriba (marca, personas y hora) y tocá{" "}
            <strong>Guardar en el menú</strong>. Después aparece acá.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-2xl border-2 border-emerald-700/20 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  {it.dias_texto}
                </p>
                <h4 className="mt-0.5 font-serif text-xl font-semibold text-slate-900">
                  {it.nombre}
                </h4>
              </div>
              <div className="text-right">
                {it.horas.map((h, i) => (
                  <p key={h} className="text-lg font-bold text-rimec-azul">
                    {h}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      (se cocina desde {it.prep_horas[i] ?? "—"})
                    </span>
                  </p>
                ))}
              </div>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Marca / foco</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {it.marcas.join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Para quién</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                  {it.para_quien}
                  {it.n_personas > 1 ? (
                    <span className="font-normal text-slate-500"> ({it.n_personas} personas)</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Tipo de stock</dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {it.origen} · {it.ramo}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-400">Depósitos</dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {it.depositos.length ? it.depositos.join(", ") : "Todos"}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] leading-snug text-slate-400">
              Cada persona recibe el informe en Mensajes internos (bandeja Stock pronta entrega) y
              un aviso corto por correo a la hora indicada.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
