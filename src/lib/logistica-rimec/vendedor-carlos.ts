/**
 * Columna F Excel (Codigo vededor_2) = código Carlos.
 * Nombre canónico: matriz Hoja2 → vendedor_v2.descp_vendedor.
 * Prohibido: mapear código Carlos → usuario_v2 (colisión EVERT/BZZ…).
 */
import canon from "@/lib/carlos/vendedor-list-canon.json";

type VendedorEntry = {
  cod_nexus_excel: number;
  casos: Record<string, number>;
};

const VENDEDORES = canon.vendedores as Record<string, VendedorEntry>;

/**
 * Códigos Carlos del Excel Logística no cubiertos por matriz Hoja2.
 * idNexus = vendedor_v2.id_vendedor (Director 2026-07-28).
 */
const EXTRA_CARLOS: Record<number, { nombre: string; idNexus: number }> = {
  28: { nombre: "MARIO", idNexus: 18 },
  68: { nombre: "CARINA", idNexus: 3 },
  69: { nombre: "CARINA", idNexus: 3 },
  72: { nombre: "HUGO", idNexus: 12 },
  101: { nombre: "PATRICIA", idNexus: 19 },
  111: { nombre: "DARIO", idNexus: 5 },
};

/** Carlos code → { nombreHoja2, idNexus } */
const CARLOS_TO_VENDEDOR: Map<number, { nombre: string; idNexus: number }> = (() => {
  const m = new Map<number, { nombre: string; idNexus: number }>();
  for (const [nombre, entry] of Object.entries(VENDEDORES)) {
    for (const code of Object.values(entry.casos)) {
      const n = Number(code);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (!m.has(n)) m.set(n, { nombre, idNexus: entry.cod_nexus_excel });
    }
  }
  for (const [code, hit] of Object.entries(EXTRA_CARLOS)) {
    const n = Number(code);
    if (!m.has(n)) m.set(n, hit);
  }
  return m;
})();

export type VendedorCarlosResuelto = {
  codigoCarlos: number;
  /** id en vendedor_v2 (1..N) si existe en matriz */
  idNexus: number | null;
  /** Nombre para UI · preferir descp vendedor_v2 al enriquecer */
  nombreCanon: string;
};

export function resolveVendedorDesdeCodigoCarlos(
  codigoCarlos: number | null | undefined,
): VendedorCarlosResuelto {
  const codigo = Number(codigoCarlos);
  if (!Number.isFinite(codigo) || codigo <= 0) {
    return { codigoCarlos: 0, idNexus: null, nombreCanon: "—" };
  }
  const hit = CARLOS_TO_VENDEDOR.get(codigo);
  if (hit) {
    return {
      codigoCarlos: codigo,
      idNexus: hit.idNexus,
      nombreCanon: hit.nombre,
    };
  }
  return {
    codigoCarlos: codigo,
    idNexus: null,
    nombreCanon: `VEND ${codigo}`,
  };
}

/** Solo nombre (agrupación General / pestaña Vendedor). */
export function nombreVendedorCarlos(
  codigoCarlos: number,
  descpVendedorV2?: string | null,
): string {
  const r = resolveVendedorDesdeCodigoCarlos(codigoCarlos);
  const nombre = (descpVendedorV2 || "").trim() || r.nombreCanon;
  return nombre.replace(/^VEND\s+/i, "").trim() || "—";
}

/** Label con código · usar en fila FI / factura, no en cabecera de grupo. */
export function labelVendedorCarlos(
  codigoCarlos: number,
  descpVendedorV2?: string | null,
): string {
  const nombre = nombreVendedorCarlos(codigoCarlos, descpVendedorV2);
  if (!codigoCarlos || codigoCarlos <= 0) return nombre;
  return `${nombre} (${codigoCarlos})`;
}
