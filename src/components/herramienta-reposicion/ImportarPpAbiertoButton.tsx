"use client";

import { useRef, useState } from "react";

type Props = {
  onImported?: () => void;
  className?: string;
};

export function ImportarPpAbiertoButton({ onImported, className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/herramienta-reposicion/pp-abierto/import", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Import falló");
      setMsg(
        `PP abierto ${data.facturaNro}: ${data.filas} filas · ${Number(data.totalPares).toLocaleString("es-PY")} p`,
      );
      onImported?.();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col items-stretch gap-1 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(ev) => void onFile(ev)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        title="Importar factura proforma · PP abierto (STYLE · MATERIAL CODE · COLOR CODE)"
        className="rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-indigo-900 hover:bg-indigo-100 disabled:opacity-60"
      >
        {busy ? "Importando PP abierto…" : "Importar PP abierto"}
      </button>
      {msg ? <p className="text-[10px] font-semibold text-emerald-800">{msg}</p> : null}
      {err ? <p className="text-[10px] font-semibold text-red-700">{err}</p> : null}
    </div>
  );
}
