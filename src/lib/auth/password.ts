/**
 * Hashing de contraseñas — usuario_v2.password_hash (bcrypt).
 * rounds=10: equilibrio seguridad/velocidad (~60ms por hash en server).
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  const trimmed = (plain ?? "").trim();
  if (trimmed.length < 4) {
    throw new Error("La contraseña debe tener al menos 4 caracteres");
  }
  return bcrypt.hash(trimmed, BCRYPT_ROUNDS);
}

/** Contraseña temporal legible (sin caracteres ambiguos 0/O, 1/l). */
export function generateTemporaryPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Placeholder en columna legacy `password` — login usa solo password_hash. */
export function legacyPasswordPlaceholder(): string {
  return `__hash_${randomBytes(12).toString("hex")}__`;
}
