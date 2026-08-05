"use client";

import { useMemo, useState, type ReactNode } from "react";

export type Adjunto = {
  id: number;
  nombre_archivo: string;
  storage_path: string | null;
  mime: string;
  bytes: number | null;
  total_pares?: number | null;
};

type FamiliaUi = "Abierto" | "Cerrado" | "Carteras" | "Otros";
type TipoV2Ui = "CALZADO" | "CONFECCIONES" | "ACCESORIOS" | "OTROS";

type Parsed = Adjunto & {
  tipoV2: TipoV2Ui;
  lp: string;
  marca: string;
  caso: string;
  orden: string;
  familia: FamiliaUi;
  pares: number | null;
};

const LP_RE = /^(LPN|LPC03|LPC04)$/i;
const TIPO_V2_RE = /^(CALZADO|CONFECCIONES|ACCESORIOS)$/i;
const FAMILIAS: FamiliaUi[] = ["Abierto", "Cerrado", "Carteras", "Otros"];
const TIPOS_V2: TipoV2Ui[] = ["CALZADO", "CONFECCIONES", "ACCESORIOS", "OTROS"];
const LPS_UI = ["LPN", "LPC03", "LPC04", "OTRA"] as const;

/** Fallback si el path aún no trae carpeta tipo_v2 (mensajes viejos). */
const MARCAS_CONFECCIONES = new Set([
  "AMORA",
  "KYLY",
  "LEMON",
  "MILON",
  "NANAI",
  "PIPA",
]);

function normalizeLp(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === "LPN" || u === "LPC03" || u === "LPC04") return u;
  return "OTRA";
}

function normalizeTipoV2(raw: string): TipoV2Ui {
  const u = raw.trim().toUpperCase();
  if (u === "CALZADO" || u === "CONFECCIONES" || u === "ACCESORIOS") return u;
  return "OTROS";
}

function tipoV2DesdeMarca(marca: string): TipoV2Ui {
  const u = marca.trim().toUpperCase();
  if (MARCAS_CONFECCIONES.has(u)) return "CONFECCIONES";
  if (u && u !== "—") return "CALZADO";
  return "OTROS";
}

function clasificarFamilia(caso: string): FamiliaUi {
  const u = (caso || "").toUpperCase();
  if (/CARTERA/.test(u)) return "Carteras";
  if (/ABIERTO/.test(u)) return "Abierto";
  if (/CERRADO/.test(u)) return "Cerrado";
  return "Otros";
}

function leerPares(a: Adjunto): number | null {
  const raw =
    a.total_pares ??
    (a as { totalPares?: number | null }).totalPares ??
    null;
  if (raw == null || raw === ("" as unknown)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function fmtPares(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-PY");
}

function sumPares(items: Parsed[]): number {
  let t = 0;
  for (const it of items) {
    if (it.pares != null && Number.isFinite(it.pares)) t += it.pares;
  }
  return t;
}

/** Badge PDF count + subtotal pares — pastel NIIF RIMEC. */
function BadgesTotales({
  count,
  pares,
}: {
  count: number;
  pares: number;
  tone?: "slate" | "azul" | "soft";
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="rounded-full bg-rimec-azul/10 px-2 py-0.5 text-[10px] font-bold text-rimec-azul">
        {count} PDF
      </span>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100">
        {fmtPares(pares)} pares
      </span>
    </span>
  );
}

export function parseAdjunto(a: Adjunto): Parsed {
  const raw = a.nombre_archivo.replace(/\\/g, "/");
  const parts = raw.split("/").filter(Boolean);
  let tipoV2: TipoV2Ui = "OTROS";
  let lp = "OTRA";
  let file = parts[parts.length - 1] || raw;
  let orden = "";

  // CALZADO/LPN/archivo.pdf  ·  LPN/archivo.pdf (legacy)
  if (parts.length >= 3 && TIPO_V2_RE.test(parts[0]!) && LP_RE.test(parts[1]!)) {
    tipoV2 = normalizeTipoV2(parts[0]!);
    lp = normalizeLp(parts[1]!);
  } else if (parts.length >= 2 && LP_RE.test(parts[0]!)) {
    lp = normalizeLp(parts[0]!);
  } else if (parts.length >= 2 && TIPO_V2_RE.test(parts[0]!)) {
    tipoV2 = normalizeTipoV2(parts[0]!);
  }

  const suf = file.match(/^(.+?)_(LPN|LPC03|LPC04)\.pdf$/i);
  if (suf) {
    lp = normalizeLp(suf[2]!);
    file = `${suf[1]}.pdf`;
  }

  let marca = "—";
  let caso = file.replace(/\.pdf$/i, "");

  // Marcas multi-palabra canónicas + resto
  let m = file.match(/^(\d+)_(BEIRA_RIO|BR_SPORT|[A-Za-z0-9]+)_(.+)\.pdf$/i);
  if (m) {
    orden = m[1]!;
    marca = m[2]!.toUpperCase().replace(/_/g, " ");
    caso = m[3]!.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  } else {
    m = file.match(/^([A-Za-z0-9]+)_(.+)\.pdf$/i);
    if (m) {
      marca = m[1]!.toUpperCase();
      caso = m[2]!
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s+(LPN|LPC03|LPC04)$/i, "")
        .trim();
    }
  }

  if (tipoV2 === "OTROS") tipoV2 = tipoV2DesdeMarca(marca);

  const pares = leerPares(a);

  return {
    ...a,
    total_pares: pares,
    tipoV2,
    lp,
    marca,
    caso,
    orden,
    familia: clasificarFamilia(caso),
    pares,
  };
}

function sortItems(items: Parsed[]) {
  return [...items].sort((a, b) => {
    const oa = a.orden || "99";
    const ob = b.orden || "99";
    if (oa !== ob) return oa.localeCompare(ob, undefined, { numeric: true });
    return a.caso.localeCompare(b.caso);
  });
}

function PdfFileList({ items }: { items: Parsed[] }) {
  if (!items.length) {
    return (
      <p className="px-4 py-3 text-center text-xs text-slate-400">Sin PDF en este grupo</p>
    );
  }
  return (
    <ul className="bg-white">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 border-t border-slate-50 px-4 py-2.5 pl-10"
        >
          <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-800 sm:text-sm">
            {item.caso}
          </span>
          {item.storage_path ? (
            <a
              href={`/api/mensajes-internos/adjunto/${item.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg border border-rimec-azul/25 bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-rimec-azul shadow-sm hover:bg-[#e8f1f8]"
              title="Abrir PDF"
            >
              {fmtPares(item.pares)} pares
            </a>
          ) : (
            <span className="text-[10px] font-bold uppercase text-amber-700">
              {fmtPares(item.pares)} pares · pendiente
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FamiliaBlock({ items }: { items: Parsed[] }) {
  const tree = useMemo(() => {
    const map = new Map<FamiliaUi, Parsed[]>();
    for (const it of items) {
      const list = map.get(it.familia) ?? [];
      list.push(it);
      map.set(it.familia, list);
    }
    return FAMILIAS.filter((f) => map.has(f)).map((familia) => ({
      familia,
      items: sortItems(map.get(familia)!),
    }));
  }, [items]);

  const [openFam, setOpenFam] = useState<Record<string, boolean>>({});

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-50">
      {tree.map(({ familia, items: list }) => {
        const famOpen = openFam[familia] === true;
        return (
          <div key={familia}>
            <button
              type="button"
              onClick={() => setOpenFam((p) => ({ ...p, [familia]: !famOpen }))}
              className="flex w-full items-center gap-2 bg-slate-50 px-4 py-2.5 pl-8 text-left hover:bg-slate-100"
            >
              <span className={`text-xs text-slate-500 transition ${famOpen ? "rotate-90" : ""}`}>
                ▶
              </span>
              <span className="flex-1 text-sm font-bold uppercase tracking-wide text-slate-800">
                {familia}
              </span>
              <BadgesTotales count={list.length} pares={sumPares(list)} />
            </button>
            {famOpen ? <PdfFileList items={list} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** LPN → Marca (VIZZANO) → Abierto / Cerrado / Carteras → PDFs */
function MarcaFamiliaAccordion({ items }: { items: Parsed[] }) {
  const byMarca = useMemo(() => {
    const map = new Map<string, Parsed[]>();
    for (const it of items) {
      const key = it.marca || "—";
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([marca, list]) => ({ marca, items: sortItems(list) }));
  }, [items]);

  const [openMarca, setOpenMarca] = useState<Record<string, boolean>>({});

  if (!items.length) {
    return (
      <p className="px-4 py-4 text-center text-xs text-slate-400">Sin PDF en esta lista</p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      {byMarca.map(({ marca, items: list }) => {
        const open = openMarca[marca] === true;
        return (
          <div key={marca}>
            <button
              type="button"
              onClick={() => setOpenMarca((p) => ({ ...p, [marca]: !open }))}
              className="flex w-full items-center gap-2 bg-slate-100 px-4 py-3 text-left hover:bg-slate-200"
            >
              <span className={`text-xs text-slate-500 transition ${open ? "rotate-90" : ""}`}>
                ▶
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-slate-900">
                {marca}
              </span>
              <BadgesTotales count={list.length} pares={sumPares(list)} />
            </button>
            {open ? <FamiliaBlock items={list} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function AccordionLp({
  title,
  subtitle,
  count,
  pares,
  open,
  onToggle,
  children,
  tone = "slate",
}: {
  title: string;
  subtitle?: string;
  count: number;
  pares: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tone?: "slate" | "azul";
}) {
  // NIIF RIMEC pastel: celeste institucional + texto azul #002B4E (no navy sólido)
  const head =
    tone === "azul"
      ? "bg-[#e8f1f8] text-rimec-azul hover:bg-[#dceaf5] border-b border-rimec-azul/15"
      : "bg-slate-50 text-slate-800 hover:bg-slate-100 border-b border-slate-200";
  return (
    <div className="overflow-hidden rounded-xl border border-rimec-azul/20 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${head}`}
      >
        <span className={`text-xs text-rimec-azul/70 transition ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold uppercase tracking-wide">{title}</span>
          {subtitle ? (
            <span className="block text-[11px] text-slate-500">{subtitle}</span>
          ) : null}
        </span>
        <BadgesTotales count={count} pares={pares} />
      </button>
      {open ? children : null}
    </div>
  );
}

function LpBlock({ items }: { items: Parsed[] }) {
  const [openLp, setOpenLp] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-2">
      {LPS_UI.map((lp) => {
        const list = sortItems(items.filter((p) => p.lp === lp));
        if (!list.length) return null;
        const open = openLp[lp] === true;
        const subtitle =
          lp === "LPN"
            ? "Marca → Abierto · Cerrado · Carteras · botón = pares"
            : lp === "LPC03"
              ? "Espejo · precio LPC03"
              : lp === "LPC04"
                ? "Espejo · precio LPC04"
                : "Sin carpeta LP";
        return (
          <AccordionLp
            key={lp}
            title={`PDF · ${lp}`}
            subtitle={subtitle}
            count={list.length}
            pares={sumPares(list)}
            open={open}
            onToggle={() => setOpenLp((p) => ({ ...p, [lp]: !open }))}
            tone={lp === "LPN" || lp === "LPC03" ? "azul" : "slate"}
          >
            <MarcaFamiliaAccordion items={list} />
          </AccordionLp>
        );
      })}
    </div>
  );
}

export function PdfCandyAccordions({
  adjuntos,
}: {
  adjuntos: Adjunto[];
  asunto?: string;
}) {
  const parsed = useMemo(() => {
    const list = adjuntos.map(parseAdjunto);
    const seen = new Set<number>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [adjuntos]);

  const porTipo = useMemo(() => {
    return TIPOS_V2.map((tipo) => ({
      tipo,
      items: parsed.filter((p) => p.tipoV2 === tipo),
    })).filter((g) => g.items.length > 0);
  }, [parsed]);

  const [openTipo, setOpenTipo] = useState<Record<string, boolean>>({});

  if (!adjuntos.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Sin PDF en este envío. Cuando Automatización deposita, aparecen acá.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {porTipo.map(({ tipo, items }) => {
        const open = openTipo[tipo] === true;
        return (
          <AccordionLp
            key={tipo}
            title={`PDF · ${tipo}`}
            subtitle="tipo_v2 → LP → Marca → familia · botón = pares"
            count={items.length}
            pares={sumPares(items)}
            open={open}
            onToggle={() => setOpenTipo((p) => ({ ...p, [tipo]: !open }))}
            tone="azul"
          >
            <LpBlock items={items} />
          </AccordionLp>
        );
      })}
    </div>
  );
}
