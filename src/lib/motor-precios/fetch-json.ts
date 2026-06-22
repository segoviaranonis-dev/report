/** Evita "Unexpected end of JSON input" cuando la API devuelve cuerpo vacío. */
export async function fetchJson<T = unknown>(input: RequestInfo, init?: RequestInit): Promise<{ res: Response; data: T }> {
  const res = await fetch(input, init);
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Respuesta vacía del servidor (${res.status})`);
  }
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      throw new Error(
        `Servidor dev desincronizado (${res.status}) — ejecutá npm run dev:clean:3001 en report/ y recargá.`,
      );
    }
    throw new Error(`Respuesta no JSON (${res.status})`);
  }
  return { res, data };
}
