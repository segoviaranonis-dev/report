/**
 * Smoke bancario — traductor Carlos (CODxCASOS).
 * Regresión crítica: PE · PROMOCIONAL no puede caer a BR-VZ (ATI 49≠53).
 */
import canon from "../src/lib/carlos/vendedor-list-canon.json";
import {
  CASOS_ORDEN,
  extractCasoCanonicoFromText,
  resolveCasoComercialCarlos,
  resolveVendedorCarlosParaCsv,
} from "../src/lib/carlos/vendedor-carlos-resolver";

type Entry = { cod_nexus_excel: number; casos: Record<string, number> };
const VENDEDORES = canon.vendedores as Record<string, Entry>;

const PE_WRAPPERS = [
  (c: string) => c,
  (c: string) => `PE · ${c}`,
  (c: string) => `PE · batch · ${c}`,
  (c: string) => `PE-${c}`,
  (c: string) => `PE · Fecha · ${c}`,
];

let fail = 0;
function check(ok: boolean, msg: string) {
  console.log(ok ? "PASS" : "FAIL", msg);
  if (!ok) fail++;
}

// 1) Extracción canónica bajo wrappers PE
for (const key of CASOS_ORDEN) {
  for (const wrap of PE_WRAPPERS) {
    const raw = wrap(key);
    const got = extractCasoCanonicoFromText(raw);
    check(got === key, `extract ${JSON.stringify(raw)} → ${got} (exp ${key})`);
  }
}

// 2) Matriz completa × wrappers PE → mismo código Carlos
for (const [vend, entry] of Object.entries(VENDEDORES)) {
  for (const [caso, codigo] of Object.entries(entry.casos)) {
    for (const wrap of PE_WRAPPERS) {
      const raw = wrap(caso);
      const casoR = resolveCasoComercialCarlos(raw);
      const cod = resolveVendedorCarlosParaCsv({ vendedor_nombre: vend, caso: raw });
      check(
        casoR === caso && cod === String(codigo),
        `${vend} + ${JSON.stringify(raw)} → caso=${casoR} cod=${cod} (exp ${caso}/${codigo})`,
      );
    }
  }
}

// 3) Caso Ati / CSV 228_44047 — nunca más 53 en PROMO
const atiPromoCases = [
  "PROMOCIONAL",
  "PE · PROMOCIONAL",
  "PE · batch · PROMOCIONAL",
  "PE-PROMOCIONAL",
  "PE · 228 · PROMOCIONAL",
];
for (const raw of atiPromoCases) {
  const cod = resolveVendedorCarlosParaCsv({ vendedor_nombre: "ATI", caso: raw });
  check(cod === "49", `ATI PROMO ${JSON.stringify(raw)} → ${cod} (exp 49, nunca 53)`);
  check(cod !== "53", `ATI PROMO anti-53 ${JSON.stringify(raw)}`);
}

// 4) ATI BR-VZ sigue en 53
check(
  resolveVendedorCarlosParaCsv({ vendedor_nombre: "ATI", caso: "BR-VZ-MD-ML-MKA-O" }) === "53",
  "ATI BR-VZ → 53",
);
check(
  resolveVendedorCarlosParaCsv({ vendedor_nombre: "ATI", caso: "PE · 228" }) === "53",
  "ATI PE sin clave → fallback BR-VZ 53",
);

// 5) Vendors donde PROMO ≠ BR-VZ: PE·PROMO nunca igual al código BR-VZ
for (const [vend, entry] of Object.entries(VENDEDORES)) {
  const promo = entry.casos.PROMOCIONAL;
  const br = entry.casos["BR-VZ-MD-ML-MKA-O"];
  if (promo == null || br == null || promo === br) continue;
  const cod = resolveVendedorCarlosParaCsv({
    vendedor_nombre: vend,
    caso: "PE · batch · PROMOCIONAL",
  });
  check(
    cod === String(promo) && cod !== String(br),
    `${vend} PE·PROMO → ${cod} (promo=${promo} br=${br})`,
  );
}

// 6) Smoke legacy
const legacy = [
  { v: "YRMA", caso: "CARTERAS", exp: "44" },
  { v: "FRANCIS", caso: "PROMOCIONAL", exp: "58" },
  { v: "IRMA", caso: "TENIS", exp: "44" },
];
for (const c of legacy) {
  const got = resolveVendedorCarlosParaCsv({ vendedor_nombre: c.v, caso: c.caso });
  check(got === c.exp, `legacy ${c.v}+${c.caso} → ${got}`);
}

console.log(fail === 0 ? "\nSMOKE BANCARIO OK" : `\nSMOKE BANCARIO FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
