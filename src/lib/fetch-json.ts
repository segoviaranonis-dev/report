/** Parsea JSON de fetch; si el servidor devuelve HTML/texto (500), mensaje legible. */
export async function readJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 80);
    throw new Error(
      res.ok
        ? "Respuesta inválida del servidor (no JSON)"
        : `Error del servidor (${res.status}): ${preview}`,
    );
  }
}
