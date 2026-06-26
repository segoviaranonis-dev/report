/**
 * Matriz holding: usuarios código BZZ* = empresa Bazzar (rol_id 2).
 * Nunca rol_id 1 (RIMEC) aunque la BD esté mal.
 * Doc: MATRIZ_ROLES_ACCESOS_HOLDING.md
 */

const SEDE_ENTE: Record<string, number> = {
  F: 2, // Fernando
  S: 3, // San Martín
  P: 4, // Palma
};

export function esUsuarioCodigoBzz(descpUsuario: string): boolean {
  return /^BZZ/i.test((descpUsuario ?? "").trim());
}

/** BZZ + sede F/S/P → entes.codigo (2–4). BZZF legacy → Fernando. */
export function inferirEnteCodigoBzz(descpUsuario: string): number | null {
  const u = (descpUsuario ?? "").trim().toUpperCase();
  if (!u.startsWith("BZZ")) return null;
  if (u === "BZZF") return 2;
  const m = u.match(/^BZZ([FSP])/);
  return m ? (SEDE_ENTE[m[1]] ?? null) : null;
}

export type AccesoBzzCorregido = {
  rol_id: number;
  ente_codigo: number | null;
  corregido: boolean;
  motivo?: string;
};

/** Fuerza rol 2 + ente tienda para cuentas BZZ*. */
export function aplicarAccesoCanonicoBzz(
  descpUsuario: string,
  rolId: number,
  enteCodigo: number | null,
): AccesoBzzCorregido {
  if (!esUsuarioCodigoBzz(descpUsuario)) {
    return { rol_id: rolId, ente_codigo: enteCodigo, corregido: false };
  }

  let rol_id = rolId;
  let ente_codigo = enteCodigo;
  const motivos: string[] = [];

  if (rol_id === 1) {
    rol_id = 2;
    motivos.push("rol_id 1→2");
  } else if (rol_id === 3) {
    rol_id = 2;
    motivos.push("rol_id 3→2");
  }

  const inferido = inferirEnteCodigoBzz(descpUsuario);
  if (inferido != null && ente_codigo !== inferido) {
    ente_codigo = inferido;
    motivos.push(`ente ${ente_codigo ?? "?"}→${inferido}`);
  }

  return {
    rol_id,
    ente_codigo,
    corregido: motivos.length > 0,
    motivo: motivos.length ? motivos.join(", ") : undefined,
  };
}
