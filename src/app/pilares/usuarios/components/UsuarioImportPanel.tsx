"use client";

import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { FuncionarioExcelRow } from "@/lib/usuarios-admin/import-funcionarios";
import type { EnteRow, RolAccesoRow, UsuarioCategoriaRow } from "@/lib/usuarios-admin/queries";
import { categoriasPermitidasParaRol, validarTriada } from "@/lib/usuarios-admin/leyes";

type ImportPreviewRow = {
  descp_usuario: string;
  ci: string;
  ente: string;
  rol_id: number;
  categoria_id: number;
  funcionario_id: number | null;
  accion: string;
  detalle?: string;
};

type ImportResult = {
  insertados: number;
  omitidos: number;
  errores: number;
  items: Array<{
    id_usuario: number;
    descp_usuario: string;
    password_plain: string;
    ci: string;
    accion: string;
    detalle?: string;
  }>;
};

type Props = {
  roles: RolAccesoRow[];
  entes: EnteRow[];
  categorias: UsuarioCategoriaRow[];
  onDone: () => void;
};

const EXCEL_COLS = [
  "ENTE",
  "LOCAL",
  "NOMBRES",
  "APELLIDOS",
  "N.º CEDULA",
  "ENTRADA IPS",
  "FCHA. DE NACIMIENTO",
  "SEXO",
  "CODIG.DE VENDEDOR",
  "ROL",
  "CATEGORIA",
] as const;

function parseExcelFile(file: File): Promise<FuncionarioExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
        if (!sheet) {
          reject(new Error("Hoja vacía"));
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const rows: FuncionarioExcelRow[] = json.map((r) => ({
          ENTE: String(r.ENTE ?? ""),
          LOCAL: Number(r.LOCAL),
          NOMBRES: String(r.NOMBRES ?? ""),
          APELLIDOS: String(r.APELLIDOS ?? ""),
          "N.º CEDULA": r["N.º CEDULA"] as number | string,
          ROL: Number(r.ROL),
          CATEGORIA: Number(r.CATEGORIA),
          "CODIG.DE VENDEDOR": r["CODIG.DE VENDEDOR"] != null ? Number(r["CODIG.DE VENDEDOR"]) : undefined,
        }));
        resolve(rows);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

export function UsuarioImportPanel({ roles, entes, categorias, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [excelRows, setExcelRows] = useState<FuncionarioExcelRow[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [passwordMode, setPasswordMode] = useState<"ci" | "random">("ci");

  const [newUser, setNewUser] = useState({
    descp_usuario: "",
    password: "",
    autoPassword: true,
    rol_id: roles[0]?.id ?? 3,
    categoria_id: null as number | null,
    ente_id: entes.find((e) => e.es_principal && e.codigo === 1)?.id_ente ?? null,
    es_externo: false,
  });

  const entesPrincipales = entes.filter((e) => e.es_principal);
  const rol = roles.find((r) => r.id === newUser.rol_id);
  const cats = categoriasPermitidasParaRol(rol?.nivel ?? newUser.rol_id, categorias);
  const ente = entes.find((e) => e.id_ente === newUser.ente_id);
  const cat = categorias.find((c) => c.id_categoria === newUser.categoria_id);
  const leyErr = validarTriada({
    enteCodigo: ente?.codigo ?? null,
    rolNivel: rol?.nivel ?? newUser.rol_id,
    categoriaNivel: cat?.nivel ?? 99,
  });

  const postJson = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/pilares/usuarios-admin", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en API");
    return json;
  }, []);

  async function handleCreateUser() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const json = await postJson({
        target: "create",
        descp_usuario: newUser.descp_usuario,
        password: newUser.autoPassword ? undefined : newUser.password,
        rol_id: newUser.rol_id,
        categoria_id: newUser.categoria_id,
        ente_id: newUser.ente_id,
        es_externo: newUser.es_externo,
      });
      setMsg(
        `Usuario ${json.usuario.descp_usuario} (id ${json.usuario.id_usuario}) creado. Contraseña inicial: ${json.usuario.password_plain}`,
      );
      setNewUser((p) => ({ ...p, descp_usuario: "", password: "" }));
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelect(file: File) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setImportResult(null);
    try {
      const rows = await parseExcelFile(file);
      setExcelRows(rows);
      const json = await postJson({ target: "import-preview", rows });
      setPreview(json.preview as ImportPreviewRow[]);
      const ins = (json.preview as ImportPreviewRow[]).filter((p) => p.accion === "insert").length;
      setMsg(`${rows.length} filas · ${ins} listas para insertar`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error leyendo Excel");
      setPreview(null);
      setExcelRows(null);
    } finally {
      setBusy(false);
    }
  }

  async function runImport(dryRun: boolean) {
    if (!excelRows?.length) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const json = await postJson({
        target: "import-usuarios-excel",
        rows: excelRows,
        password_mode: passwordMode,
        dry_run: dryRun,
      });
      setImportResult(json as ImportResult);
      setMsg(
        dryRun
          ? `Simulación: ${json.insertados} insertarían · ${json.omitidos} omitidos · ${json.errores} errores`
          : `Importados ${json.insertados} · omitidos ${json.omitidos} · errores ${json.errores}`,
      );
      if (!dryRun && json.insertados > 0) onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error importando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-emerald-950"
      >
        <span>+ Alta usuario · Importar cuentas desde Excel</span>
        <span className="text-sm">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-emerald-200 bg-white p-4">
          <p className="text-xs text-slate-600">
            Crea cuentas en <strong>usuario_v2</strong> (login + bcrypt). Jerarquía: ente + rol + categoría.
            Sin dependencia de funcionario RRHH.
          </p>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Alta manual</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Usuario (descp_usuario)</span>
                <input
                  value={newUser.descp_usuario}
                  onChange={(e) => setNewUser((p) => ({ ...p, descp_usuario: e.target.value.toUpperCase() }))}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs uppercase"
                  placeholder="IVO"
                />
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Contraseña</span>
                <input
                  type="text"
                  value={newUser.password}
                  disabled={newUser.autoPassword}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100"
                  placeholder="mín. 4 caracteres"
                />
                <label className="mt-1 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={newUser.autoPassword}
                    onChange={(e) => setNewUser((p) => ({ ...p, autoPassword: e.target.checked }))}
                  />
                  Generar automática
                </label>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Ente</span>
                <select
                  value={newUser.ente_id ?? ""}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, ente_id: Number(e.target.value) || null }))
                  }
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option value="">—</option>
                  {entesPrincipales.map((e) => (
                    <option key={e.id_ente} value={e.id_ente}>
                      {e.codigo} · {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Rol</span>
                <select
                  value={newUser.rol_id}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, rol_id: Number(e.target.value), categoria_id: null }))
                  }
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      n{r.nivel} · {r.nombre_rol}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="font-semibold text-slate-600">Categoría</span>
                <select
                  value={newUser.categoria_id ?? ""}
                  onChange={(e) =>
                    setNewUser((p) => ({ ...p, categoria_id: Number(e.target.value) || null }))
                  }
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
            </div>
            {leyErr && <p className="text-xs text-amber-800">{leyErr}</p>}
            <button
              type="button"
              disabled={busy || !!leyErr || !newUser.descp_usuario || !newUser.categoria_id || !newUser.ente_id}
              onClick={handleCreateUser}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Crear usuario
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Importar cuentas de usuario (Excel tiendas)</h3>
            <p className="text-xs text-slate-500">
              Genera <code>usuario_v2</code> con ROL/CATEGORIA del Excel. No modifica tabla funcionarios RRHH.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelect(f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                Contraseña inicial:
                <select
                  value={passwordMode}
                  onChange={(e) => setPasswordMode(e.target.value as "ci" | "random")}
                  className="rounded border border-slate-200 px-2 py-1"
                >
                  <option value="ci">CI (cédula)</option>
                  <option value="random">Aleatoria (10 chars)</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void runImport(true)}
                className="rounded border border-slate-300 px-2 py-1 font-semibold"
              >
                Simular
              </button>
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void runImport(false)}
                className="rounded bg-rimec-azul px-2 py-1 font-bold text-white disabled:opacity-50"
              >
                Importar
              </button>
            </div>

            {preview && preview.length > 0 && (
              <div className="max-h-48 overflow-auto rounded border border-slate-100 text-[10px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="p-1 text-left">Usuario</th>
                      <th className="p-1 text-left">CI</th>
                      <th className="p-1 text-left">Ente</th>
                      <th className="p-1 text-left">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 30).map((p, i) => (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="p-1">{p.descp_usuario}</td>
                        <td className="p-1">{p.ci}</td>
                        <td className="p-1">{p.ente}</td>
                        <td className="p-1">{p.accion}{p.detalle ? ` · ${p.detalle}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 30 && (
                  <p className="p-1 text-slate-400">… y {preview.length - 30} más</p>
                )}
              </div>
            )}

            {importResult && importResult.items.some((i) => i.password_plain && i.accion === "insert") && (
              <div className="max-h-40 overflow-auto rounded border border-amber-200 bg-amber-50 p-2 text-[10px]">
                <p className="font-bold text-amber-900 mb-1">Contraseñas generadas (copiar ahora):</p>
                {importResult.items
                  .filter((i) => i.accion === "insert" && i.password_plain)
                  .map((i) => (
                    <div key={i.id_usuario + i.descp_usuario}>
                      {i.descp_usuario}: <code>{i.password_plain}</code>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {msg && <p className="text-xs text-emerald-800">{msg}</p>}
          {err && <p className="text-xs text-red-700">{err}</p>}
        </div>
      )}
    </div>
  );
}
