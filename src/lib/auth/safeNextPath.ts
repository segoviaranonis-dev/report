/** Ruta interna segura para redirect post-login (evita open redirect). */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  const base = path.split("?")[0]?.split("#")[0] ?? fallback;
  return base || fallback;
}
