"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormField, TextInput } from "@/components/ui";
import { prefetchSalesReportSnapshot } from "@/lib/rimec/sales-report-prefetch";
import { safeNextPath } from "@/lib/auth/safeNextPath";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });

      const data = await res.json();

      if (data.success) {
        if (nextPath.startsWith("/herramienta-reposicion")) {
          void fetch("/api/herramienta-reposicion", { credentials: "include" });
        } else {
          void prefetchSalesReportSnapshot();
        }
        router.prefetch(nextPath);
        router.push(nextPath);
        router.refresh();
      } else {
        setError(data.error || "Credenciales inválidas");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-app-bg via-card-bg to-app-bg-alt flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card-bg rounded-3xl shadow-2xl border-4 border-rimec-azul-dark overflow-hidden">
          <div className="bg-gradient-to-r from-rimec-azul to-rimec-azul-dark px-8 py-10 text-center">
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-card-bg shadow-lg">
              <svg className="w-12 h-12 text-rimec-azul" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <h1 className="font-serif text-3xl font-bold text-rimec-text-white mb-2">
              Report · RIMEC
            </h1>
            <p className="text-app-bg-alt text-sm">
              Centro Comercial y Analítica
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border-2 border-semantic-error-light bg-semantic-error/10 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <span className="text-semantic-error text-xl flex-shrink-0">⚠</span>
                <p className="text-sm font-medium text-semantic-error">{error}</p>
              </div>
            )}

            <FormField label="Usuario" required hint="Ingrese su nombre de usuario">
              <TextInput
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="DIRECTOR"
                disabled={loading}
                autoFocus
                className="text-base"
              />
            </FormField>

            <FormField label="Contraseña" required hint="Ingrese su contraseña">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="text-base"
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading || !usuario || !password}
              className="w-full text-base font-bold shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>

            <p className="text-center text-xs text-neutral-600 pt-4 border-t border-neutral-200">
              Acceso restringido a usuarios autorizados
            </p>
          </form>
        </div>

        <div className="text-center mt-6 text-sm text-neutral-600">
          Report · RIMEC {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-neutral-600">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
