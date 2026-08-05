/**
 * Reloj interno automatización informes · zona America/Asuncion.
 * ISO día: 1=lunes … 7=domingo.
 */

export const TZ_ASUNCION = "America/Asuncion";

export type AhoraAsuncion = {
  /** YYYY-MM-DD */
  fecha: string;
  /** HH:MM */
  horaMin: string;
  /** 1=lun … 7=dom */
  diaIso: number;
  /** slot único anti-doble */
  slotKey: (horario: string) => string;
};

export function ahoraAsuncion(d = new Date()): AhoraAsuncion {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_ASUNCION,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const fecha = `${parts.year}-${parts.month}-${parts.day}`;
  const horaMin = `${parts.hour}:${parts.minute}`;
  const wd = (parts.weekday || "").toLowerCase();
  const map: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };
  const diaIso = map[wd] ?? 1;
  return {
    fecha,
    horaMin,
    diaIso,
    slotKey: (horario: string) => `${fecha}T${horario.slice(0, 5)}`,
  };
}

export function normalizarDiasSemana(raw: unknown): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [
    ...new Set(
      arr
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7),
    ),
  ].sort((a, b) => a - b);
  return out.length ? out : [1, 2, 3, 4, 5, 6, 7];
}

/** Resta minutos a HH:MM (día civil; cruza medianoche). */
export function restarMinutos(hhmm: string, mins: number): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  let total = Number(m[1]) * 60 + Number(m[2]) - mins;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const mi = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

/** Minutos de anticipación para armar PDF (default 10). */
export function minutosPrepPdf(): number {
  const n = Number(process.env.AUTO_PREP_MINUTES || 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(120, Math.floor(n)) : 10;
}

export const DIAS_LABEL: { id: number; corto: string; largo: string }[] = [
  { id: 1, corto: "Lun", largo: "Lunes" },
  { id: 2, corto: "Mar", largo: "Martes" },
  { id: 3, corto: "Mié", largo: "Miércoles" },
  { id: 4, corto: "Jue", largo: "Jueves" },
  { id: 5, corto: "Vie", largo: "Viernes" },
  { id: 6, corto: "Sáb", largo: "Sábado" },
  { id: 7, corto: "Dom", largo: "Domingo" },
];
