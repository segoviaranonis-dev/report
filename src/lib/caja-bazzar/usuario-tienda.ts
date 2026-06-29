import { DEPOSITOS_CONFIG } from "@/lib/depositos/depositos-config";
import { CAJA_CLIENTE_IDS, type CajaClienteId, isCajaClienteId } from "./tiendas";

const SEDE_SLUG: Record<string, "fernando" | "sanmartin" | "palma"> = {
  F: "fernando",
  S: "sanmartin",
  P: "palma",
};

/** BZZFA → 2100 Fernando Adultos · BZZFN → 2900 Fernando Niños · etc. */
export function resolveClienteIdFromUsuario(descpUsuario: string): CajaClienteId | null {
  const key = descpUsuario.trim().toUpperCase();
  const m = key.match(/^BZZ([FSP])([AN])$/);
  if (m) {
    const sede = SEDE_SLUG[m[1]];
    const tipo = m[2] === "A" ? "Adultos" : "Niños";
    if (!sede) return null;
    const hit = DEPOSITOS_CONFIG.find((d) => d.enteSlug === sede && d.tipo === tipo && d.operativo);
    return hit && isCajaClienteId(hit.cliente_id) ? hit.cliente_id : null;
  }

  const legacy = key.match(/^BZZ([FSP])$/);
  if (legacy) {
    const sede = SEDE_SLUG[legacy[1]];
    if (!sede) return null;
    const hit =
      DEPOSITOS_CONFIG.find((d) => d.enteSlug === sede && d.tipo === "Adultos" && d.operativo) ??
      DEPOSITOS_CONFIG.find((d) => d.enteSlug === sede && d.operativo);
    return hit && isCajaClienteId(hit.cliente_id) ? hit.cliente_id : null;
  }

  const norm = key.replace(/\s+/g, " ");
  for (const d of DEPOSITOS_CONFIG) {
    if (!d.operativo || !isCajaClienteId(d.cliente_id)) continue;
    const label = `${d.ente} ${d.tipo}`.toUpperCase();
    if (norm.includes(label) || norm.includes(d.enteSlug.toUpperCase())) {
      if (norm.includes("NINO") || norm.includes("NIÑO") || norm.includes("NINOS")) {
        if (d.tipo === "Niños") return d.cliente_id;
      } else if (norm.includes("ADULTO")) {
        if (d.tipo === "Adultos") return d.cliente_id;
      } else {
        return d.cliente_id;
      }
    }
  }

  return null;
}

export function resolveClienteIdFromSession(input: {
  name: string;
  id_usuario: number;
  rol_id: number;
  role?: string;
}): CajaClienteId | null {
  const fromCode = resolveClienteIdFromUsuario(input.name);
  if (fromCode) return fromCode;

  const raw = process.env.CAJA_BAZZAR_TIENDA_MAP?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const v = parsed[String(input.id_usuario)];
      if (v != null && isCajaClienteId(v)) return v;
    } catch {
      /* ignore */
    }
  }

  return null;
}
