/**
 * Parser — Informe genérico de ventas Carlos (TXT fijo).
 * Fuente típica: csv's/Logistica/*.txt · CLASIFIC FACTURA + ARTICULO
 * Etapa: LOGISTICA-RIMEC-TXT-20260728 · 2.3.1.28.10
 */

export type InformeVentasArticulo = {
  articulo: string;
  descripcion: string;
  cantVend: number;
  pVentaGs: number;
  tVentaGs: number;
};

export type InformeVentasCabecera = {
  facturaCarlos: string;
  fecha: string; // YYYY-MM-DD
  codigoCliente: number;
  codigoVendedor: number;
  listaPrecio: string;
  pedPv: string;
  pedCli: string;
  cantTotal: number;
  montoNeto: number;
  articulos: InformeVentasArticulo[];
};

export type InformeVentasParseResult = {
  periodoLabel: string | null;
  cabeceras: InformeVentasCabecera[];
  stats: {
    facturas: number;
    articulos: number;
    montoTotal: number;
    paresTotal: number;
  };
};

const RE_FACTURA =
  /FACTURA\s*:\s*([\d\-]+)\s+(\d{2}\/\d{2}\/\d{4})\s+CLI:\s*(\d+)\s+VEND:\s*(\d+)\s+LIST\.PRECIO:\s*(\S+)\s+PED\.PV\/PED\.CLI:\s*(\d+)\/(\d+)/i;

const RE_TOTAL =
  /TOTAL\s+FACTURA\s*:\s*([\d\-]+)\s+(\d[\d,]*)\s+(\d[\d,]*)\s*$/i;

const RE_ART =
  /^\s+(\d{3}\.\d+)\s+(\S.*)$/;

const RE_PERIODO = /PERIODO:\s*\[([^\]]+)\]/i;

function parseGs(raw: string): number {
  return Number(String(raw).replace(/,/g, ""));
}

function dmyToIso(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m}-${d}`;
}

function parseArticuloLine(line: string): InformeVentasArticulo | null {
  const m = line.match(RE_ART);
  if (!m) return null;
  const articulo = m[1];
  const rest = m[2].trimEnd();
  const nums = [...rest.matchAll(/(\d[\d,]*)/g)].map((x) => x[1]);
  if (nums.length < 3) return null;
  const tVentaGs = parseGs(nums[nums.length - 1]!);
  const pVentaGs = parseGs(nums[nums.length - 2]!);
  const cantVend = parseGs(nums[nums.length - 3]!);
  if (!Number.isFinite(cantVend) || !Number.isFinite(tVentaGs)) return null;
  const lastNum = nums[nums.length - 3]!;
  const idx = rest.lastIndexOf(lastNum);
  const descripcion = rest.slice(0, idx).trim().replace(/\s+/g, " ");
  return { articulo, descripcion, cantVend, pVentaGs, tVentaGs };
}

/**
 * Parsea el TXT completo (latin1 / windows-1252 típico Carlos).
 */
export function parseInformeVentasTxt(text: string): InformeVentasParseResult {
  const lines = text.split(/\r?\n/);
  let periodoLabel: string | null = null;
  const cabeceras: InformeVentasCabecera[] = [];
  let current: InformeVentasCabecera | null = null;

  for (const line of lines) {
    if (!periodoLabel) {
      const pm = line.match(RE_PERIODO);
      if (pm) periodoLabel = pm[1].trim();
    }

    const fm = line.match(RE_FACTURA);
    if (fm) {
      current = {
        facturaCarlos: fm[1],
        fecha: dmyToIso(fm[2]),
        codigoCliente: Number(fm[3]),
        codigoVendedor: Number(fm[4]),
        listaPrecio: fm[5],
        pedPv: fm[6],
        pedCli: fm[7],
        cantTotal: 0,
        montoNeto: 0,
        articulos: [],
      };
      cabeceras.push(current);
      continue;
    }

    if (!current) continue;

    const tm = line.match(RE_TOTAL);
    if (tm && tm[1] === current.facturaCarlos) {
      current.cantTotal = parseGs(tm[2]);
      current.montoNeto = parseGs(tm[3]);
      current = null;
      continue;
    }

    const art = parseArticuloLine(line);
    if (art) current.articulos.push(art);
  }

  // Si alguna cabecera quedó sin TOTAL, sumar ítems
  for (const c of cabeceras) {
    if (!c.montoNeto && c.articulos.length) {
      c.montoNeto = c.articulos.reduce((s, a) => s + a.tVentaGs, 0);
      c.cantTotal = c.articulos.reduce((s, a) => s + a.cantVend, 0);
    }
  }

  const montoTotal = cabeceras.reduce((s, c) => s + c.montoNeto, 0);
  const paresTotal = cabeceras.reduce((s, c) => s + c.cantTotal, 0);
  const articulos = cabeceras.reduce((s, c) => s + c.articulos.length, 0);

  return {
    periodoLabel,
    cabeceras,
    stats: {
      facturas: cabeceras.length,
      articulos,
      montoTotal,
      paresTotal,
    },
  };
}
