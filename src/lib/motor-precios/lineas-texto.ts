/** Parsea códigos/rangos desde texto (comas, saltos de línea, rangos 520-530). */
export function parseCodigosLineaTexto(texto: string): { ok: string[]; errores: string[] } {
  const ok: string[] = [];
  const errores: string[] = [];
  if (!texto?.trim()) return { ok, errores };

  const vistos = new Set<string>();
  const raw = texto.replace(/;/g, ",").replace(/\n/g, ",");

  for (const parte of raw.split(",")) {
    const p = parte.trim();
    if (!p) continue;

    if (p.includes("-")) {
      try {
        const [a, b] = p.split("-", 2);
        let desde = parseInt(a.trim(), 10);
        let hasta = parseInt(b.trim(), 10);
        if (Number.isNaN(desde) || Number.isNaN(hasta)) throw new Error("nan");
        if (desde > hasta) [desde, hasta] = [hasta, desde];
        for (let n = desde; n <= hasta; n++) {
          const cod = String(n);
          if (!vistos.has(cod)) {
            vistos.add(cod);
            ok.push(cod);
          }
        }
      } catch {
        errores.push(`Rango inválido: ${p}`);
      }
    } else {
      try {
        const cod = String(Math.trunc(parseFloat(p)));
        if (!vistos.has(cod)) {
          vistos.add(cod);
          ok.push(cod);
        }
      } catch {
        errores.push(`Código inválido: ${p}`);
      }
    }
  }
  return { ok, errores };
}

export function lineasATexto(codigos: string[]): string {
  return [...codigos]
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    })
    .join(", ");
}

export function sortKeyLinea(c: string): [number, string | number] {
  const n = parseInt(c, 10);
  return Number.isNaN(n) ? [1, c] : [0, n];
}
