"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NexusGlobalHeader } from "@/components/report/NexusGlobalHeader";
import { ReportFooter } from "@/components/report/ReportFooter";
import { BIBLIOTECA_CANONICA_LABEL, MOTOR_PROVEEDOR_DEFAULT } from "@/lib/motor-precios/constants";
import { MOTOR_BIBLIOTECA, MOTOR_PRECIOS } from "@/lib/report/routes";

export function BibliotecaNuevaClient() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/motor-precios/biblioteca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          descripcion,
          proveedor_id: MOTOR_PROVEEDOR_DEFAULT,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo crear");
      setSuccess(`Biblioteca #${data.id} · ${data.nombre} creada.`);
      setTimeout(() => router.push(MOTOR_BIBLIOTECA), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg text-neutral-ink">
      <NexusGlobalHeader />
      <main className="mx-auto max-w-xl px-6 py-10">
        <Link href={MOTOR_PRECIOS} className="text-sm font-semibold text-rimec-azul hover:underline">
          ← Motor de precios
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-rimec-azul-dark">Crear biblioteca de precios</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Referencia válida del holding: <strong>{BIBLIOTECA_CANONICA_LABEL}</strong> (nombre sugerido:{" "}
          <button
            type="button"
            className="font-mono text-rimec-azul underline"
            onClick={() => setNombre("1905")}
          >
            1905
          </button>
          )
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre *</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="1905"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Biblioteca maestro importadora…"
            />
          </div>
          <p className="text-xs text-slate-500">Proveedor fijo: {MOTOR_PROVEEDOR_DEFAULT}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rimec-azul px-4 py-2 text-sm font-semibold text-white hover:bg-rimec-azul-light disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Crear biblioteca"}
            </button>
            <Link
              href={MOTOR_BIBLIOTECA}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver histórico
            </Link>
          </div>
        </form>
      </main>
      <ReportFooter note="Crear biblioteca · motor precios" />
    </div>
  );
}
