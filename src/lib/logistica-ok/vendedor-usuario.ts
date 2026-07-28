/**
 * Relación usuario Report ↔ vendedor_v2 (Logística pestaña Vendedor).
 * Match por descp_usuario ≈ descp_vendedor · alias legados (LUISLV, LILI, Eduardo…).
 * Sin match → null (jefa/DIOS gestiona esos vendedores sin login).
 */
import type { Pool } from "pg";

/** Alias login → nombre canónico vendedor_v2 */
const ALIAS_USUARIO_A_VENDEDOR: Record<string, string> = {
  ATI: "ATI",
  CARINA: "CARINA",
  CESAR: "CESAR",
  DARIO: "DARIO",
  DERLIS: "DERLIS",
  EDUARDO: "EDUARDO",
  "EDUARDO ARAUJO G.": "EDUARDO",
  "EDUARDO ARAUJO G": "EDUARDO",
  ENRIQUE: "ENRIQUE",
  FRANCIS: "FRANCIS",
  GIANINA: "GIANINA",
  GRICELDA: "GRICELDA",
  HUGO: "HUGO",
  IRMA: "IRMA",
  YRMA: "YRMA",
  KOTE: "KOTE",
  LILI: "LILIANA",
  LILIANA: "LILIANA",
  LUIS: "LUIS",
  LUISLV: "LUIS",
  MARCELO: "MARCELO",
  MARIO: "MARIO",
  PATRICIA: "PATRICIA",
  PEDRO: "PEDRO",
  RUBEN: "RUBEN",
};

function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function nombreVendedorCanonDesdeUsuario(descpUsuario: string | null | undefined): string | null {
  const n = normalizeName(descpUsuario || "");
  if (!n) return null;
  if (ALIAS_USUARIO_A_VENDEDOR[n]) return ALIAS_USUARIO_A_VENDEDOR[n];
  const first = n.split(" ")[0]!;
  if (ALIAS_USUARIO_A_VENDEDOR[first]) return ALIAS_USUARIO_A_VENDEDOR[first];
  return n;
}

export async function resolveIdVendedorFromUsuario(
  pool: Pool,
  descpUsuario: string | null | undefined,
): Promise<{ idVendedor: number | null; nombreCanon: string | null }> {
  const canon = nombreVendedorCanonDesdeUsuario(descpUsuario);
  if (!canon) return { idVendedor: null, nombreCanon: null };

  const exact = await pool.query<{ id: number }>(
    `SELECT id_vendedor AS id FROM vendedor_v2
     WHERE UPPER(BTRIM(descp_vendedor)) = UPPER(BTRIM($1))
     ORDER BY id_vendedor LIMIT 1`,
    [canon],
  );
  if (exact.rows[0]) {
    return { idVendedor: Number(exact.rows[0].id), nombreCanon: canon };
  }

  const like = await pool.query<{ id: number }>(
    `SELECT id_vendedor AS id FROM vendedor_v2
     WHERE UPPER(BTRIM(descp_vendedor)) LIKE UPPER(BTRIM($1)) || '%'
     ORDER BY id_vendedor LIMIT 1`,
    [canon.split(" ")[0]],
  );
  if (like.rows[0]) {
    return { idVendedor: Number(like.rows[0].id), nombreCanon: canon };
  }

  return { idVendedor: null, nombreCanon: canon };
}

/** Vendedor Report: rol 1+VENDEDOR o legado rol_id=3. */
export function isVendedorLogisticaReport(
  rolId: number,
  categoria: string | null | undefined,
): boolean {
  const cat = String(categoria || "")
    .toUpperCase()
    .trim();
  if (cat !== "VENDEDOR") return false;
  return rolId === 1 || rolId === 3;
}
