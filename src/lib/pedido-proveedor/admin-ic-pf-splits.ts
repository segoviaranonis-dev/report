import type { Pool } from "pg";
import { subtotalSinDescuento } from "@/lib/pedido-proveedor/administrador-ic-monto";
import type { ListadoPrecioTierId } from "@/lib/intencion-compra/listado-precio-tiers";
import { labelListadoPrecio } from "@/lib/intencion-compra/listado-precio-tiers";
import type { PfArticuloRow, PreFacturaInterna } from "@/lib/pedido-proveedor/administrador-ic-query";

export type PfSplitArticulo = { ppd_id: number; pares: number };

export type PfSplitRecord = {
  id: string;
  parent_pf_key: string;
  pf_key: string;
  id_cliente: number;
  id_marca: number;
  caso: string;
  pares: number;
  articulos: PfSplitArticulo[];
  created_at: string;
};

function splitId(): string {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Cache proceso — evita consultar information_schema en cada fila PP. */
let splitsColumnExists: boolean | null = null;

async function hasPfSplitsColumn(pool: Pool): Promise<boolean> {
  if (splitsColumnExists !== null) return splitsColumnExists;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'pedido_proveedor'
       AND column_name = 'admin_ic_pf_splits'`,
  );
  splitsColumnExists = (rowCount ?? 0) > 0;
  return splitsColumnExists;
}

export async function loadPfSplits(pool: Pool, ppId: number): Promise<PfSplitRecord[]> {
  if (!(await hasPfSplitsColumn(pool))) return [];
  const { rows } = await pool.query<{ admin_ic_pf_splits: unknown }>(
    `SELECT COALESCE(admin_ic_pf_splits, '[]'::jsonb) AS admin_ic_pf_splits
     FROM pedido_proveedor WHERE id = $1`,
    [ppId],
  );
  const raw = rows[0]?.admin_ic_pf_splits;
  if (!Array.isArray(raw)) return [];
  return raw as PfSplitRecord[];
}

export async function savePfSplits(pool: Pool, ppId: number, splits: PfSplitRecord[]): Promise<void> {
  if (!(await hasPfSplitsColumn(pool))) {
    throw new Error(
      "Columna admin_ic_pf_splits no existe — ejecutá report/migrations/169_admin_ic_pf_splits.sql",
    );
  }
  await pool.query(`UPDATE pedido_proveedor SET admin_ic_pf_splits = $2::jsonb WHERE id = $1`, [
    ppId,
    JSON.stringify(splits),
  ]);
}

/** Reparte `take` pares entre artículos del PF (proporcional, último absorbe resto). */
export function allocateParesFromArticulos(
  articulos: PfArticuloRow[],
  take: number,
): PfSplitArticulo[] {
  const total = articulos.reduce((s, a) => s + a.pares, 0);
  if (take <= 0 || total <= 0) return [];
  if (take >= total) {
    return articulos.map((a) => ({ ppd_id: a.ppd_id, pares: a.pares }));
  }
  const out: PfSplitArticulo[] = [];
  let assigned = 0;
  for (let i = 0; i < articulos.length; i++) {
    const art = articulos[i];
    let p: number;
    if (i === articulos.length - 1) {
      p = take - assigned;
    } else {
      p = Math.round((art.pares / total) * take);
      p = Math.min(p, art.pares, take - assigned);
    }
    if (p > 0) {
      out.push({ ppd_id: art.ppd_id, pares: p });
      assigned += p;
    }
  }
  return out;
}

function subtractAllocations(
  articulos: PfArticuloRow[],
  taken: PfSplitArticulo[],
): PfArticuloRow[] {
  const map = new Map(taken.map((t) => [t.ppd_id, t.pares]));
  return articulos
    .map((art) => {
      const sub = map.get(art.ppd_id) ?? 0;
      const pares = art.pares - sub;
      if (pares <= 0) return null;
      const { precio_unit, subtotal } = subtotalSinDescuento(
        { lpn: art.lpn, lpc02: art.lpc02, lpc03: art.lpc03, lpc04: art.lpc04 },
        1 as ListadoPrecioTierId,
        pares,
      );
      return { ...art, pares, precio_unit, subtotal };
    })
    .filter((a): a is PfArticuloRow => a != null);
}

function buildPfFromAllocations(
  base: PreFacturaInterna,
  pfKey: string,
  idCliente: number,
  allocations: PfSplitArticulo[],
  sourceArts: PfArticuloRow[],
  tier: ListadoPrecioTierId,
): PreFacturaInterna {
  const allocMap = new Map(allocations.map((a) => [a.ppd_id, a.pares]));
  const articulos: PfArticuloRow[] = [];
  let total_pares = 0;
  let total_monto = 0;
  for (const src of sourceArts) {
    const p = allocMap.get(src.ppd_id);
    if (!p || p <= 0) continue;
    const { precio_unit, subtotal } = subtotalSinDescuento(
      { lpn: src.lpn, lpc02: src.lpc02, lpc03: src.lpc03, lpc04: src.lpc04 },
      tier,
      p,
    );
    articulos.push({ ...src, pares: p, precio_unit, subtotal });
    total_pares += p;
    total_monto += subtotal;
  }
  return {
    pf_key: pfKey,
    id_cliente: idCliente,
    marca: base.marca,
    id_marca: base.id_marca,
    caso: base.caso,
    listado_tier: tier,
    listado_label: labelListadoPrecio(tier),
    total_pares,
    total_monto: Math.round(total_monto * 100) / 100,
    articulos,
  };
}

function totalsFromArts(arts: PfArticuloRow[]): { pares: number; monto: number } {
  return {
    pares: arts.reduce((s, a) => s + a.pares, 0),
    monto: Math.round(arts.reduce((s, a) => s + a.subtotal, 0) * 100) / 100,
  };
}

/** Aplica splits persistidos + genera PF hijas; reduce PF padre. */
export function applyPfSplitsToPrefacturas(
  prefacturas: PreFacturaInterna[],
  splits: PfSplitRecord[],
): PreFacturaInterna[] {
  if (!splits.length) return prefacturas;

  const byParent = new Map<string, PfSplitRecord[]>();
  for (const sp of splits) {
    const list = byParent.get(sp.parent_pf_key) ?? [];
    list.push(sp);
    byParent.set(sp.parent_pf_key, list);
  }

  const out: PreFacturaInterna[] = [];

  for (const pf of prefacturas) {
    const childSplits = byParent.get(pf.pf_key);
    if (!childSplits?.length) {
      out.push(pf);
      continue;
    }

    let remainingArts = [...pf.articulos];
    for (const sp of childSplits) {
      const childPf = buildPfFromAllocations(
        pf,
        sp.pf_key,
        sp.id_cliente,
        sp.articulos,
        pf.articulos,
        pf.listado_tier,
      );
      if (childPf.total_pares > 0) out.push(childPf);
      remainingArts = subtractAllocations(remainingArts, sp.articulos);
    }

    const t = totalsFromArts(remainingArts);
    if (t.pares > 0) {
      out.push({
        ...pf,
        total_pares: t.pares,
        total_monto: t.monto,
        articulos: remainingArts,
      });
    }
  }

  // PF hijas cuyo padre ya no está en lista base (split total del padre)
  const existingKeys = new Set(prefacturas.map((p) => p.pf_key));
  for (const sp of splits) {
    if (existingKeys.has(sp.parent_pf_key)) continue;
    const stub: PreFacturaInterna = {
      pf_key: sp.parent_pf_key,
      id_cliente: sp.id_cliente,
      marca: "—",
      id_marca: sp.id_marca,
      caso: sp.caso,
      listado_tier: 1,
      listado_label: labelListadoPrecio(1),
      total_pares: 0,
      total_monto: 0,
      articulos: [],
    };
    const child = buildPfFromAllocations(stub, sp.pf_key, sp.id_cliente, sp.articulos, [], 1);
    if (child.total_pares > 0) out.push(child);
  }

  return out;
}

export type CreatePfSplitInput = {
  parent_pf_key: string;
  id_cliente: number;
  /** Legacy: reparto proporcional automático si no hay articulos. */
  pares?: number;
  /** Selección explícita ppd_id + pares (Protocolo Chusa). */
  articulos?: PfSplitArticulo[];
};

function resolveSplitArticulos(
  parent: PreFacturaInterna,
  input: CreatePfSplitInput,
): { ok: true; articulos: PfSplitArticulo[]; pares: number } | { ok: false; error: string } {
  if (input.articulos?.length) {
    const byPpd = new Map(parent.articulos.map((a) => [Number(a.ppd_id), a]));
    const seen = new Set<number>();
    const out: PfSplitArticulo[] = [];
    let total = 0;
    for (const sel of input.articulos) {
      const ppdId = Number(sel.ppd_id);
      if (!Number.isFinite(ppdId) || seen.has(ppdId)) {
        return { ok: false, error: "Selección de artículos inválida o duplicada." };
      }
      seen.add(ppdId);
      const src = byPpd.get(ppdId);
      if (!src) {
        return { ok: false, error: `Artículo ppd ${ppdId} no pertenece a esta prefactura.` };
      }
      const p = Math.round(Number(sel.pares));
      if (p <= 0 || p > src.pares) {
        return {
          ok: false,
          error: `Pares inválidos en ${src.linea}/${src.referencia} (máx ${src.pares}).`,
        };
      }
      out.push({ ppd_id: ppdId, pares: p });
      total += p;
    }
    if (total <= 0) return { ok: false, error: "Seleccioná al menos un artículo con pares > 0." };
    if (total >= parent.total_pares) {
      return { ok: false, error: "Debe quedar al menos 1 par en la prefactura origen." };
    }
    return { ok: true, articulos: out, pares: total };
  }

  const pares = Math.round(Number(input.pares ?? 0));
  if (pares <= 0) return { ok: false, error: "Pares a dividir debe ser > 0." };
  if (pares >= parent.total_pares) {
    return { ok: false, error: `Máximo ${parent.total_pares - 1} pares (dejar al menos 1 en origen).` };
  }
  const articulos = allocateParesFromArticulos(parent.articulos, pares);
  if (!articulos.length) return { ok: false, error: "No se pudo asignar pares a artículos." };
  return { ok: true, articulos, pares };
}

export async function createPfSplit(
  pool: Pool,
  ppId: number,
  prefacturasBase: PreFacturaInterna[],
  input: CreatePfSplitInput,
): Promise<{ ok: true; split: PfSplitRecord } | { ok: false; error: string }> {
  const parent = prefacturasBase.find((p) => p.pf_key === input.parent_pf_key);
  if (!parent) return { ok: false, error: "Prefactura origen no encontrada." };

  const resolved = resolveSplitArticulos(parent, input);
  if (!resolved.ok) return resolved;

  const { articulos, pares } = resolved;

  const existing = await loadPfSplits(pool, ppId);

  const id = splitId();
  const pf_key = `${input.id_cliente}|${parent.id_marca}|${parent.caso}|${id}`;
  const split: PfSplitRecord = {
    id,
    parent_pf_key: input.parent_pf_key,
    pf_key,
    id_cliente: input.id_cliente,
    id_marca: parent.id_marca,
    caso: parent.caso,
    pares,
    articulos,
    created_at: new Date().toISOString(),
  };

  await savePfSplits(pool, ppId, [...existing, split]);
  return { ok: true, split };
}

export async function deletePfSplit(
  pool: Pool,
  ppId: number,
  splitIdValue: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await loadPfSplits(pool, ppId);
  const next = existing.filter((s) => s.id !== splitIdValue);
  if (next.length === existing.length) return { ok: false, error: "División no encontrada." };
  await savePfSplits(pool, ppId, next);
  return { ok: true };
}
