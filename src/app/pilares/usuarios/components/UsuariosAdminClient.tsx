"use client";

import { UsuarioImportPanel } from "./UsuarioImportPanel";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  EnteRow,
  RolAccesoRow,
  UsuarioAdminRow,
  UsuarioCategoriaRow,
  UsuariosAdminSnapshot,
} from "@/lib/usuarios-admin/queries";
import { categoriasPermitidasParaRol, validarTriada } from "@/lib/usuarios-admin/leyes";

type Tab = "usuarios" | "entes" | "roles" | "categorias";

type UsuarioDraft = {
  descp_usuario: string;
  email: string;
  password: string;
  bloqueado: boolean;
  rol_id: number;
  categoria_id: number | null;
  ente_id: number | null;
  es_externo: boolean;
};

function rolLabel(r: RolAccesoRow): string {
  return `n${r.nivel} · ${r.nombre_rol}`;
}

function enteLabelPrincipal(e: EnteRow): string {
  return `${e.codigo} · ${e.nombre}`;
}

function UsuarioEditorForm({
  u,
  d,
  data,
  busy,
  onDraft,
  onSave,
  passwordMsg,
}: {
  u: UsuarioAdminRow;
  d: UsuarioDraft;
  data: UsuariosAdminSnapshot;
  busy: boolean;
  onDraft: (patch: Partial<UsuarioDraft>) => void;
  onSave: () => void;
  passwordMsg?: string | null;
}) {
  const rol = data.roles.find((r) => r.id === d.rol_id);
  const rolNivel = rol?.nivel ?? d.rol_id;
  const ente = data.entes.find((e) => e.id_ente === d.ente_id);
  const cats = categoriasPermitidasParaRol(rolNivel, data.categorias);
  const cat = data.categorias.find((c) => c.id_categoria === d.categoria_id);
  const leyErr = validarTriada({
    enteCodigo: ente?.codigo ?? null,
    rolNivel,
    categoriaNivel: cat?.nivel ?? 99,
  });
  const entesPrincipales = data.entes.filter((e) => e.es_principal);

  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>id {u.id_usuario}</span>
        {u.bloqueado ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-800">Bloqueado</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">Activo</span>
        )}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
        Cuenta de acceso · usuario_v2
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Login (descp_usuario)</span>
          <input
            value={d.descp_usuario}
            onChange={(e) => onDraft({ descp_usuario: e.target.value.toUpperCase() })}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs uppercase"
          />
        </label>
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Email</span>
          <input
            type="email"
            value={d.email}
            onChange={(e) => onDraft({ email: e.target.value })}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Nueva contraseña</span>
          <input
            type="text"
            value={d.password}
            onChange={(e) => onDraft({ password: e.target.value })}
            placeholder="vacío = no cambiar"
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-xs pt-5">
          <input
            type="checkbox"
            checked={d.bloqueado}
            onChange={(e) => onDraft({ bloqueado: e.target.checked })}
          />
          <span className="font-semibold text-slate-600">Bloqueado</span>
        </label>
      </div>
      {passwordMsg && (
        <p className="text-xs font-semibold text-amber-900">Contraseña actualizada: {passwordMsg}</p>
      )}

      <p className="text-[10px] font-bold uppercase tracking-wider text-rimec-azul">
        Jerarquía holding · ley triada
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Ente principal</span>
          <select
            value={d.ente_id ?? ""}
            onChange={(e) => onDraft({ ente_id: Number(e.target.value) || null })}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value="">— ente —</option>
            {entesPrincipales.map((e) => (
              <option key={e.id_ente} value={e.id_ente}>
                {enteLabelPrincipal(e)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Rol orgánico</span>
          <select
            value={d.rol_id}
            onChange={(e) =>
              onDraft({ rol_id: Number(e.target.value), categoria_id: null })
            }
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          >
            {data.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {rolLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="font-semibold text-slate-600">Categoría</span>
          <select
            value={d.categoria_id ?? ""}
            onChange={(e) => onDraft({ categoria_id: Number(e.target.value) || null })}
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value="">—</option>
            {cats.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                n{c.nivel} · {c.codigo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs sm:col-span-3">
          <input
            type="checkbox"
            checked={d.es_externo}
            onChange={(e) => onDraft({ es_externo: e.target.checked })}
          />
          <span className="font-semibold text-slate-600">Externo / rotativa</span>
        </label>
      </div>
      {leyErr && <p className="text-xs text-amber-800">{leyErr}</p>}
      <button
        type="button"
        disabled={busy || !!leyErr || !d.ente_id || !d.categoria_id}
        onClick={onSave}
        className="rounded-lg bg-rimec-azul px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        Guardar
      </button>
    </div>
  );
}

function UsuarioAccordionItem({
  u,
  d,
  data,
  busy,
  open,
  onToggle,
  onDraft,
  onSave,
  passwordMsg,
}: {
  u: UsuarioAdminRow;
  d: UsuarioDraft;
  data: UsuariosAdminSnapshot;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onDraft: (patch: Partial<UsuarioDraft>) => void;
  onSave: () => void;
  passwordMsg?: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
      >
        <span className="font-semibold text-slate-900">{u.descp_usuario}</span>
        <span className="text-xs text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <UsuarioEditorForm
          u={u}
          d={d}
          data={data}
          busy={busy}
          onDraft={onDraft}
          onSave={onSave}
          passwordMsg={passwordMsg}
        />
      )}
    </div>
  );
}

export function UsuariosAdminClient() {
  const [tab, setTab] = useState<Tab>("usuarios");
  const [data, setData] = useState<UsuariosAdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openEntes, setOpenEntes] = useState<Record<number, boolean>>({});
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openUsers, setOpenUsers] = useState<Record<number, boolean>>({});
  const [landscapeMsg, setLandscapeMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, UsuarioDraft>>({});
  const [passwordMsgs, setPasswordMsgs] = useState<Record<number, string>>({});

  function draftFromUsuario(u: UsuarioAdminRow, defaultEnte: number | null): UsuarioDraft {
    return {
      descp_usuario: u.descp_usuario,
      email: u.email ?? "",
      password: "",
      bloqueado: u.bloqueado,
      rol_id: u.rol_id,
      categoria_id: u.categoria_id,
      ente_id: u.ente_id ?? defaultEnte,
      es_externo: u.es_externo,
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pilares/usuarios-admin", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (res.status === 403) {
        setError("Acceso denegado — solo rol_id=1.");
        return;
      }
      if (!res.ok) {
        let msg = "No se pudo cargar el catálogo.";
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) msg = json.error;
        } catch {
          /* respuesta no JSON */
        }
        setError(msg);
        return;
      }
      const json = (await res.json()) as UsuariosAdminSnapshot;
      setData(json);
      const defaultEnte =
        json.entes.find((e) => e.es_principal && e.codigo === 1)?.id_ente ??
        json.entes.find((e) => e.es_principal)?.id_ente ??
        null;
      const next: Record<number, UsuarioDraft> = {};
      for (const u of json.usuarios) {
        next[u.id_usuario] = draftFromUsuario(u, defaultEnte);
      }
      setDrafts(next);
      setPasswordMsgs({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red";
      setError(
        msg === "Failed to fetch"
          ? "No se pudo conectar con Report (:3001). Reiniciá el dev con REINICIAR_DEV.bat."
          : msg,
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const accordionTree = useMemo(() => {
    if (!data) return [];
    const byEnte = new Map<number, UsuarioAdminRow[]>();
    for (const u of data.usuarios) {
      const eid = u.ente_id ?? 0;
      const list = byEnte.get(eid) ?? [];
      list.push(u);
      byEnte.set(eid, list);
    }

    const entesOrdenados = [...data.entes].sort((a, b) => a.codigo - b.codigo);

    return entesOrdenados
      .map((ente) => {
        const users = byEnte.get(ente.id_ente) ?? [];
        if (users.length === 0) return null;

        const byRol = new Map<number, UsuarioAdminRow[]>();
        for (const u of users) {
          const list = byRol.get(u.rol_id) ?? [];
          list.push(u);
          byRol.set(u.rol_id, list);
        }

        const roles = data.roles
          .filter((r) => byRol.has(r.id))
          .sort((a, b) => a.nivel - b.nivel)
          .map((rol) => {
            const rolUsers = byRol.get(rol.id) ?? [];
            const byCat = new Map<number | "sin", UsuarioAdminRow[]>();
            for (const u of rolUsers) {
              const key = u.categoria_id ?? ("sin" as const);
              const list = byCat.get(key) ?? [];
              list.push(u);
              byCat.set(key, list);
            }

            const categorias = [...data.categorias, { id_categoria: -1, nivel: 99, codigo: "SIN", descripcion: null, activo: true }]
              .filter((c) => byCat.has(c.id_categoria) || (c.id_categoria === -1 && byCat.has("sin")))
              .sort((a, b) => a.nivel - b.nivel)
              .map((cat) => ({
                cat,
                users:
                  cat.id_categoria === -1
                    ? byCat.get("sin") ?? []
                    : byCat.get(cat.id_categoria) ?? [],
              }))
              .filter((x) => x.users.length > 0);

            return { rol, categorias };
          });

        return { ente, roles, total: users.length };
      })
      .filter(Boolean) as {
      ente: EnteRow;
      roles: {
        rol: RolAccesoRow;
        categorias: { cat: UsuarioCategoriaRow | { id_categoria: number; nivel: number; codigo: string }; users: UsuarioAdminRow[] }[];
      }[];
      total: number;
    }[];
  }, [data]);

  async function requestLandscape() {
    setLandscapeMsg(null);
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (m: string) => Promise<void> };
      if (o?.lock) {
        await o.lock("landscape");
        setLandscapeMsg("Horizontal activo.");
      } else {
        setLandscapeMsg("Girá el tablet manualmente.");
      }
    } catch {
      setLandscapeMsg("Girá el tablet a horizontal.");
    }
  }

  async function saveUsuario(u: UsuarioAdminRow) {
    const d = drafts[u.id_usuario];
    if (!d?.ente_id || !d.categoria_id) {
      setError("Ente y categoría requeridos.");
      return;
    }
    setBusyId(u.id_usuario);
    setError(null);
    try {
      const res = await fetch("/api/pilares/usuarios-admin", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "usuario",
          id_usuario: u.id_usuario,
          descp_usuario: d.descp_usuario,
          email: d.email || null,
          password: d.password.trim() || undefined,
          bloqueado: d.bloqueado,
          rol_id: d.rol_id,
          categoria_id: d.categoria_id,
          ente_id: d.ente_id,
          es_externo: d.es_externo,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error guardando usuario");
        return;
      }
      if (json.password_plain) {
        setPasswordMsgs((p) => ({ ...p, [u.id_usuario]: json.password_plain }));
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCategoriaActiva(c: UsuarioCategoriaRow) {
    setBusyId(c.id_categoria);
    setError(null);
    try {
      const res = await fetch("/api/pilares/usuarios-admin", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "categoria",
          id_categoria: c.id_categoria,
          activo: !c.activo,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error actualizando categoría");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "usuarios", label: "Usuarios", count: data?.usuarios.length ?? 0 },
    { id: "entes", label: "Entes", count: data?.entes.length ?? 0 },
    { id: "roles", label: "Roles", count: data?.roles.length ?? 0 },
    { id: "categorias", label: "Categorías", count: data?.categorias.length ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <strong>Usuario (acceso)</strong> es pilar jerárquico — independiente de RRHH.{" "}
        Solo ente + rol + categoría + login. Funcionario nunca es requisito del usuario.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={requestLandscape}
          className="rounded-lg border-2 border-rimec-azul/30 bg-white px-3 py-2 text-xs font-semibold text-rimec-azul-dark"
        >
          ↔ Modo horizontal
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
        >
          {loading ? "Cargando…" : "↻ Actualizar"}
        </button>
      </div>

      {landscapeMsg && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{landscapeMsg}</p>
      )}

      {data?.triadaMigrationMissing && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Migración 130 pendiente — <code>python scripts/aplicar_migracion_130.py</code>
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold ${
              tab === t.id ? "bg-rimec-azul text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading && !data && <p className="text-sm text-neutral-600">Cargando…</p>}

      {data && (
        <UsuarioImportPanel
          roles={data.roles}
          entes={data.entes}
          categorias={data.categorias}
          onDone={load}
        />
      )}

      {data && tab === "usuarios" && (
        <div className="space-y-3">
          {accordionTree.length === 0 && (
            <p className="text-sm text-slate-600">Sin usuarios agrupados por ente.</p>
          )}
          {accordionTree.map(({ ente, roles, total }) => {
            const enteOpen = openEntes[ente.id_ente] ?? true;
            const cliTag = ente.cliente_id != null ? ` · cliente ${ente.cliente_id}` : "";
            return (
              <div key={ente.id_ente} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenEntes((p) => ({ ...p, [ente.id_ente]: !enteOpen }))}
                  className="flex w-full items-center justify-between px-4 py-3 text-left bg-slate-50 hover:bg-slate-100"
                >
                  <span className="font-bold text-rimec-azul-dark">
                    Ente {ente.codigo} · {ente.nombre}
                    {cliTag}
                  </span>
                  <span className="text-xs text-slate-500">{total} usuarios · {enteOpen ? "▾" : "▸"}</span>
                </button>
                {enteOpen &&
                  roles.map(({ rol, categorias }) => {
                    const rolKey = `${ente.id_ente}-${rol.id}`;
                    const rolOpen = openRoles[rolKey] ?? false;
                    return (
                      <div key={rolKey} className="border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setOpenRoles((p) => ({ ...p, [rolKey]: !rolOpen }))}
                          className="flex w-full items-center justify-between px-6 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="font-semibold text-slate-800">Rol {rolLabel(rol)}</span>
                          <span className="text-xs text-slate-500">{rolOpen ? "▾" : "▸"}</span>
                        </button>
                        {rolOpen &&
                          categorias.map(({ cat, users }) => {
                            const catKey = `${rolKey}-${cat.id_categoria}`;
                            const catOpen = openCats[catKey] ?? false;
                            const catLabel =
                              "descripcion" in cat && cat.codigo !== "SIN"
                                ? `n${cat.nivel} · ${cat.codigo}`
                                : String(cat.codigo);
                            return (
                              <div key={catKey} className="border-t border-slate-50 bg-white">
                                <button
                                  type="button"
                                  onClick={() => setOpenCats((p) => ({ ...p, [catKey]: !catOpen }))}
                                  className="flex w-full items-center justify-between px-8 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <span>Categoría {catLabel}</span>
                                  <span className="text-xs text-slate-400">
                                    {users.length} · {catOpen ? "▾" : "▸"}
                                  </span>
                                </button>
                                {catOpen && (
                                  <div className="space-y-1 px-4 pb-3 pl-10">
                                    {users.map((u) => (
                                      <UsuarioAccordionItem
                                        key={u.id_usuario}
                                        u={u}
                                        open={openUsers[u.id_usuario] ?? false}
                                        onToggle={() =>
                                          setOpenUsers((p) => ({
                                            ...p,
                                            [u.id_usuario]: !p[u.id_usuario],
                                          }))
                                        }
                                        d={
                                          drafts[u.id_usuario] ??
                                          draftFromUsuario(u, data.entes.find((e) => e.es_principal)?.id_ente ?? null)
                                        }
                                        data={data}
                                        busy={busyId === u.id_usuario}
                                        passwordMsg={passwordMsgs[u.id_usuario]}
                                        onDraft={(patch) =>
                                          setDrafts((prev) => ({
                                            ...prev,
                                            [u.id_usuario]: {
                                              ...(prev[u.id_usuario] ??
                                                draftFromUsuario(
                                                  u,
                                                  data.entes.find((e) => e.es_principal)?.id_ente ?? null,
                                                )),
                                              ...patch,
                                            },
                                          }))
                                        }
                                        onSave={() => saveUsuario(u)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      )}

      {data && tab === "entes" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
              Entes principales — FK <code>usuario_v2.ente_id</code>
            </p>
            <table className="min-w-[520px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cod</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Usuarios</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.entes.filter((e) => e.es_principal).map((e) => (
                  <tr key={e.id_ente}>
                    <td className="px-4 py-3 font-mono font-bold">{e.codigo}</td>
                    <td className="px-4 py-3 font-semibold">{e.nombre}</td>
                    <td className="px-4 py-3">{data.usuarios.filter((u) => u.ente_id === e.id_ente).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
              Puntos tablet (referencia entes hoja) — RRHH usa <code>cliente_v2.id_cliente</code>
            </p>
            <table className="min-w-[560px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cod</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Padre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.entes.filter((e) => !e.es_principal).map((e) => (
                  <tr key={e.id_ente}>
                    <td className="px-4 py-3 font-mono font-bold">{e.codigo}</td>
                    <td className="px-4 py-3 font-semibold">{e.nombre}</td>
                    <td className="px-4 py-3 font-mono">{e.cliente_id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{e.parent_id_ente ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === "roles" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[480px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">id</th>
                <th className="px-4 py-3">Rol orgánico</th>
                <th className="px-4 py-3">Usuarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.roles.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono font-bold">{r.nivel}</td>
                  <td className="px-4 py-3 font-mono">{r.id}</td>
                  <td className="px-4 py-3 font-semibold">{r.nombre_rol}</td>
                  <td className="px-4 py-3">{data.usuarios.filter((u) => u.rol_id === r.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === "categorias" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[560px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.categorias.map((c) => (
                <tr key={c.id_categoria}>
                  <td className="px-4 py-3 font-mono font-bold">{c.nivel}</td>
                  <td className="px-4 py-3 font-bold">{c.codigo}</td>
                  <td className="px-4 py-3 text-slate-600">{c.descripcion ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busyId === c.id_categoria}
                      onClick={() => toggleCategoriaActiva(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        c.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {c.activo ? "Sí" : "No"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link href="/pilares" className="inline-block text-sm font-semibold text-rimec-azul hover:underline">
        ← Administrador Pilares
      </Link>
    </div>
  );
}
