"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  PE_TIPO_DICCIONARIO_OPCIONES,
  type PeTipoDiccionarioId,
  togglePeTipoDiccionario,
} from "@/lib/stock-pronta-entrega/filtro-tipo-pe-diccionario";
import { DIAS_LABEL } from "@/lib/automatizacion-informes/reloj";

type Origen = "COMPRA_PREVIA" | "PRONTA_ENTREGA";
type Ramo = "CALZADO" | "CONFECCIONES";
type Deposito = "D1" | "DEP2" | "D3";

type Meta = {
  marcas: { label: string; n: number }[];
  abcr: { id: number; label: string }[];
};

type UsuarioOpt = {
  id: number;
  nombre: string;
  email: string;
  categoria: string | null;
};

const DEPOSITOS: Deposito[] = ["D1", "DEP2", "D3"];

function sortHoras(hs: string[]) {
  return [...hs].sort();
}

function Chip({
  active,
  onClick,
  children,
  tone = "default",
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "oro" | "fucsia" | "verde" | "oscuro";
  disabled?: boolean;
}) {
  const base =
    "rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition disabled:opacity-40";
  if (!active) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`${base} border-slate-200 bg-white text-slate-500 hover:border-slate-300`}
      >
        {children}
      </button>
    );
  }
  const toneCls =
    tone === "oro"
      ? "border-amber-600 bg-amber-500 text-amber-950"
      : tone === "fucsia"
        ? "border-fuchsia-600 bg-fuchsia-600 text-white"
        : tone === "verde"
          ? "border-emerald-700 bg-emerald-600 text-white"
          : tone === "oscuro"
            ? "border-slate-700 bg-slate-800 text-white"
            : "border-rimec-azul bg-rimec-azul text-white";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${toneCls}`}>
      {children}
    </button>
  );
}

function tipoTone(id: PeTipoDiccionarioId) {
  if (id === "promo") return "fucsia" as const;
  if (id === "liquidacion") return "oro" as const;
  if (id === "comun") return "verde" as const;
  return "oscuro" as const;
}

export function ControlProntaEntregaPanel({
  onCreada,
}: {
  onCreada?: () => void;
} = {}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [nombre, setNombre] = useState("Automatización PE");
  const [origen, setOrigen] = useState<Origen>("PRONTA_ENTREGA");
  const [depositos, setDepositos] = useState<Deposito[]>(["D1", "DEP2", "D3"]);
  const [ramo, setRamo] = useState<Ramo>("CALZADO");
  const [marcas, setMarcas] = useState<string[]>([]);
  const [abcr, setAbcr] = useState<string[]>([]);
  const [tipos, setTipos] = useState<PeTipoDiccionarioId[]>([
    "normal",
    "promo",
    "liquidacion",
    "comun",
  ]);
  const [marcaQ, setMarcaQ] = useState("");
  const [abcrQ, setAbcrQ] = useState("");

  /** Multi-usuarios + multi-horarios (misma automatización = mismo paquete PDF). */
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [usuariosErr, setUsuariosErr] = useState<string | null>(null);
  const [usuarioIds, setUsuarioIds] = useState<number[]>([]);
  const [usuarioQ, setUsuarioQ] = useState("");
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [horaNueva, setHoraNueva] = useState("12:00");
  /** ISO 1=lun … 7=dom · default todos los días */
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastAutoId, setLastAutoId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadMeta = useCallback(async (ramoActivo: Ramo) => {
    setLoadingMeta(true);
    setMetaErr(null);
    try {
      const q = new URLSearchParams({ ramo: ramoActivo });
      const res = await fetch(`/api/automatizacion-informes/meta-filtros?${q}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as Meta & { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "No se pudieron cargar filtros");
      const marcasOk = new Set((j.marcas ?? []).map((m) => m.label));
      const abcrOk = new Set((j.abcr ?? []).map((a) => a.label));
      setMeta({
        marcas: j.marcas ?? [],
        abcr: j.abcr ?? [],
      });
      // Cascada siamesa: podar selecciones que ya no pertenecen al ramo.
      setMarcas((prev) => prev.filter((m) => marcasOk.has(m)));
      setAbcr((prev) => prev.filter((a) => abcrOk.has(a)));
    } catch (e) {
      setMetaErr(e instanceof Error ? e.message : "Error meta");
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta(ramo);
  }, [ramo, loadMeta]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/automatizacion-informes/usuarios", {
          cache: "no-store",
        });
        const j = (await res.json()) as {
          ok?: boolean;
          error?: string;
          usuarios?: UsuarioOpt[];
        };
        if (!res.ok || !j.ok) throw new Error(j.error ?? "No se cargaron usuarios");
        if (!cancelled) setUsuarios(j.usuarios ?? []);
      } catch (e) {
        if (!cancelled) {
          setUsuariosErr(e instanceof Error ? e.message : "Error usuarios");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const marcasOpts = useMemo(() => {
    const q = marcaQ.trim().toUpperCase();
    const rows = meta?.marcas ?? [];
    return q ? rows.filter((m) => m.label.includes(q)) : rows;
  }, [meta, marcaQ]);

  const abcrOpts = useMemo(() => {
    const q = abcrQ.trim().toUpperCase();
    const rows = meta?.abcr ?? [];
    return q ? rows.filter((a) => a.label.includes(q)) : rows;
  }, [meta, abcrQ]);

  const usuariosOpts = useMemo(() => {
    const q = usuarioQ.trim().toUpperCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre.toUpperCase().includes(q) ||
        u.email.toUpperCase().includes(q) ||
        (u.categoria ?? "").toUpperCase().includes(q),
    );
  }, [usuarios, usuarioQ]);

  function toggleDep(d: Deposito) {
    setDepositos((prev) => {
      const has = prev.includes(d);
      const next = has ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length ? next : [d];
    });
  }

  function toggleStr(list: string[], val: string, set: (v: string[]) => void) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  function toggleUsuario(id: number) {
    setUsuarioIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function agregarHorario() {
    const m = horaNueva.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return;
    const key = `${m[1]!.padStart(2, "0")}:${m[2]}`;
    setHorarios((prev) => (prev.includes(key) ? prev : sortHoras([...prev, key])));
  }

  function quitarHorario(h: string) {
    setHorarios((prev) => {
      const next = prev.filter((x) => x !== h);
      return next.length ? next : prev;
    });
  }

  async function crearAutomatizacion() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    if (!usuarioIds.length) {
      setErr("Seleccioná al menos un usuario");
      setSaving(false);
      return;
    }
    if (!horarios.length) {
      setErr("Agregá al menos un horario");
      setSaving(false);
      return;
    }
    if (!diasSemana.length) {
      setErr("Elegí al menos un día de la semana");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/automatizacion-informes/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          origen_stock: origen,
          depositos,
          ramo,
          marcas,
          abcr_labels: abcr,
          tipos,
          biblioteca_precio_ids: [],
          horarios,
          dias_semana: diasSemana,
          destinatarios: usuarioIds.map((id) => ({ usuario_id: id })),
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        id?: number;
        codigo?: string;
        horarios?: string[];
        dias_semana?: number[];
        destinatarios?: number;
        error?: string;
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Error al crear");
      if (j.id) setLastAutoId(Number(j.id));
      const diasTxt = (j.dias_semana ?? diasSemana)
        .map((d) => DIAS_LABEL.find((x) => x.id === d)?.corto ?? d)
        .join(",");
      setMsg(
        `Listo: quedó programado (#${j.id}) · ${diasTxt} a las ${(j.horarios ?? horarios).join(" · ")}. Mirá el menú de abajo.`,
      );
      onCreada?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function ejecutarAhora() {
    if (!lastAutoId) {
      setErr("Creá una automatización primero");
      return;
    }
    setRunning(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/automatizacion-informes/ejecutar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lastAutoId, max_pdfs: 8 }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        pdfs?: { filename: string; totalPares: number }[];
        mensaje_id?: number;
        mail?: { canal: string; to: string; path?: string }[];
      };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Error al ejecutar");
      const n = j.pdfs?.length ?? 0;
      const canal = j.mail?.[0]?.canal ?? "—";
      setMsg(
        `Listo: ${n} informe(s) en Mensajes internos · aviso por ${canal}. Revisá la bandeja Stock pronta entrega.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  const resumenTipos = tipos
    .map((id) => PE_TIPO_DICCIONARIO_OPCIONES.find((o) => o.id === id)?.label ?? id)
    .join(" · ");

  return (
    <section className="mt-12 space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Cocina · armar un envío nuevo
        </h2>
        <h3 className="mt-1 font-serif text-2xl font-semibold text-slate-900">
          Control de Pronta Entrega
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Elegí marca, a quién le llega y a qué hora. El sistema prepara los PDF solos (con
          fotos) y avisa por correo. Abajo ves el menú de lo que ya está programado todos los
          días.
        </p>
      </div>

      {loadingMeta && (
        <p className="text-xs text-slate-500">Cargando marcas · AB-CR desde stock PE…</p>
      )}
      {metaErr && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {metaErr}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-3 rounded-2xl border-2 border-rimec-azul/20 bg-white p-4 shadow-sm">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Nombre automatización
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
            />
          </label>

          {/* 1 · Origen */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              1 · Origen stock
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip
                active={origen === "COMPRA_PREVIA"}
                onClick={() => setOrigen("COMPRA_PREVIA")}
              >
                Compra previa
              </Chip>
              <Chip
                active={origen === "PRONTA_ENTREGA"}
                onClick={() => setOrigen("PRONTA_ENTREGA")}
              >
                Stock pronta entrega
              </Chip>
            </div>
          </div>

          {/* 2 · Depósitos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              2 · Depósito · multi
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DEPOSITOS.map((d) => (
                <Chip key={d} active={depositos.includes(d)} onClick={() => toggleDep(d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>

          {/* 3 · Categoría */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              3 · Categoría
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip active={ramo === "CALZADO"} onClick={() => setRamo("CALZADO")}>
                Calzado
              </Chip>
              <Chip active={ramo === "CONFECCIONES"} onClick={() => setRamo("CONFECCIONES")}>
                Confecciones
              </Chip>
            </div>
          </div>

          {/* 4 · Marca — desde v_stock_pe_rimec */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              4 · Marca · multi · {marcas.length || "todas"}
            </p>
            <input
              value={marcaQ}
              onChange={(e) => setMarcaQ(e.target.value)}
              placeholder="Filtrar lista…"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            />
            <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
              {marcasOpts.map((m) => (
                <li key={m.label}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      checked={marcas.includes(m.label)}
                      onChange={() => toggleStr(marcas, m.label, setMarcas)}
                      className="accent-[#002B4E]"
                    />
                    <span className="font-medium text-slate-800">{m.label}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{m.n}</span>
                  </label>
                </li>
              ))}
              {!marcasOpts.length && (
                <li className="px-2 py-2 text-xs text-slate-400">Sin marcas (¿stock PE vacío?)</li>
              )}
            </ul>
          </div>

          {/* 5 · AB-CR hermanos siameses */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              5 · AB-CR · multi · {abcr.length || "todos"}
            </p>
            <p className="text-[11px] text-slate-500">
              Protocolo hermanos siameses · Tipo1 (ABIERTO / CERRADO / MEDIAS / …)
            </p>
            <input
              value={abcrQ}
              onChange={(e) => setAbcrQ(e.target.value)}
              placeholder="Filtrar lista…"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            />
            <ul className="mt-2 max-h-36 space-y-0.5 overflow-y-auto">
              {abcrOpts.map((a) => (
                <li key={`${a.id}-${a.label}`}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      checked={abcr.includes(a.label)}
                      onChange={() => toggleStr(abcr, a.label, setAbcr)}
                      className="accent-[#002B4E]"
                    />
                    <span>{a.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* 6 · Tipo DPE / siameses LIQ > Promo > Normal */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              6 · Tipo · multi · DPE COD.GRUPO
            </p>
            <p className="text-[11px] text-slate-500">
              Prioridad siamesa: LIQUIDACION → PROMOCIONAL → NORMAL/COMUN (badge = filtro)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PE_TIPO_DICCIONARIO_OPCIONES.map((o) => (
                <Chip
                  key={o.id}
                  active={tipos.includes(o.id)}
                  tone={tipoTone(o.id)}
                  onClick={() => setTipos(togglePeTipoDiccionario([...tipos], o.id))}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-rimec-azul/30 bg-blue-50/50 px-3 py-2 text-xs text-slate-700">
            <strong className="text-rimec-azul">Qué va a salir:</strong>{" "}
            {origen === "PRONTA_ENTREGA" ? "Pronta entrega" : "Compra previa"} ·{" "}
            {ramo === "CONFECCIONES" ? "Confecciones" : "Calzado"} · depósitos{" "}
            {depositos.join(", ") || "—"} · {resumenTipos || "todos los tipos"} · marcas{" "}
            {marcas.length ? marcas.join(", ") : "todas"}. Precio del listado Alejandro Magno.
            Un archivo por marca y caso; listas distintas no se mezclan.
          </div>
        </div>

        {/* Destinatarios · multi-usuario + multi-horario */}
        <div className="flex flex-col rounded-2xl border-2 border-emerald-600/40 bg-white p-4 shadow-sm ring-1 ring-emerald-500/10">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            A quién y a qué hora
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Elegí las personas, los días y la hora. Si querés otra marca a otra hora, armá
            otro envío aparte (aparece abajo en el menú).
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Usuarios · multi · {usuarioIds.length || "ninguno"}
            </p>
            <input
              value={usuarioQ}
              onChange={(e) => setUsuarioQ(e.target.value)}
              placeholder="Buscar nombre · email · categoría…"
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            />
            {usuariosErr && (
              <p className="mt-1 text-[11px] text-amber-800">{usuariosErr}</p>
            )}
            <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto">
              {usuariosOpts.map((u) => (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      checked={usuarioIds.includes(u.id)}
                      onChange={() => toggleUsuario(u.id)}
                      className="accent-emerald-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-800">{u.nombre}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {u.email}
                        {u.categoria ? ` · ${u.categoria}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
              {!usuariosOpts.length && (
                <li className="px-2 py-2 text-xs text-slate-400">
                  {usuarios.length ? "Sin coincidencias" : "Cargando usuarios…"}
                </li>
              )}
            </ul>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Días de la semana · {diasSemana.length}
            </p>
            <p className="text-[11px] text-slate-500">
              Ej. solo lunes — ese día sale solo, sin que nadie pulse nada.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIAS_LABEL.map((d) => (
                <Chip
                  key={d.id}
                  active={diasSemana.includes(d.id)}
                  tone="verde"
                  onClick={() =>
                    setDiasSemana((prev) => {
                      const has = prev.includes(d.id);
                      const next = has ? prev.filter((x) => x !== d.id) : [...prev, d.id];
                      return next.length ? next.sort((a, b) => a - b) : prev;
                    })
                  }
                >
                  {d.corto}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Horarios del día · {horarios.length}
            </p>
            <p className="text-[11px] text-slate-500">
              Ej. 08:00 · 12:00 · 15:00 — a esa hora llega el aviso de este envío.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => quitarHorario(h)}
                  title="Quitar horario"
                  className="rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {h} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <label className="block flex-1 text-[10px] font-bold uppercase text-slate-500">
                Agregar hora
                <input
                  type="time"
                  value={horaNueva}
                  onChange={(e) => setHoraNueva(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={agregarHorario}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50"
              >
                + Hora
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-emerald-600/30 bg-emerald-50/40 px-3 py-2 text-[11px] text-slate-700">
            <strong>Resumen:</strong>{" "}
            {diasSemana.map((d) => DIAS_LABEL.find((x) => x.id === d)?.corto).join("·")} a las{" "}
            <strong>{horarios.join(" · ") || "—"}</strong> · {usuarioIds.length} persona
            {usuarioIds.length === 1 ? "" : "s"}
            {marcas.length === 1 ? (
              <>
                {" "}
                · <strong>{marcas[0]}</strong>
              </>
            ) : null}
            . Los archivos se empiezan a armar unos 10 minutos antes; a la hora exacta llega
            el aviso por correo.
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void crearAutomatizacion()}
            className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar en el menú"}
          </button>
          <button
            type="button"
            disabled={running || !lastAutoId}
            onClick={() => void ejecutarAhora()}
            className="mt-2 w-full rounded-xl border-2 border-emerald-700 bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
          >
            {running
              ? "Preparando informe…"
              : lastAutoId
                ? "Enviar una vez ahora (prueba)"
                : "Enviar ahora (primero guardá)"}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            «Enviar ahora» arma el informe al instante y lo deja en Mensajes internos para
            revisar. El horario guardado sigue valiendo todos los días elegidos.
          </p>
          {msg && (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {msg}
            </p>
          )}
          {err && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {err}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
