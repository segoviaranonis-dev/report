"use client";

type Props = {
  shop: number;
  onShopChange: (n: number) => void;
  clienteNombre: string | null;
  clienteErr: boolean;
};

/** SHOP = id_cliente en proforma Beira Rio (columna J). No confundir con «papel/email» CP. */
export function CampoShopProgramado({ shop, onShopChange, clienteNombre, clienteErr }: Props) {
  return (
    <div className="rounded-xl border-2 border-rimec-azul/25 bg-sky-50/40 p-4">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-rimec-azul">
        SHOP · código cliente (proforma col. J)
      </label>
      <p className="mb-2 text-[11px] text-slate-600">
        Debe coincidir con la columna <strong>SHOP</strong> del Excel Beira Rio al importar. Es el mismo{" "}
        <code className="rounded bg-white px-1 text-[10px]">id_cliente</code> en BD — no es código de papel ni email.
      </p>
      <input
        type="number"
        min={1}
        value={shop || ""}
        onChange={(e) => onShopChange(Number(e.target.value))}
        placeholder="ej. 286 · 2894"
        className="w-full rounded-lg border border-rimec-azul/30 bg-white px-3 py-2 font-mono text-sm font-semibold"
      />
      {clienteNombre && (
        <p className="mt-2 text-sm text-emerald-800">
          ✔ SHOP <span className="font-mono font-bold">{shop}</span> — {clienteNombre}
        </p>
      )}
      {clienteErr && (
        <p className="mt-2 text-sm text-red-700">✗ SHOP no existe en cliente_v2 — revisá código proforma</p>
      )}
    </div>
  );
}
