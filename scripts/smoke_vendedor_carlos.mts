import {
  formatVendedorCarlosLabel,
  resolveVendedorCarlosParaCsv,
} from "../src/lib/carlos/vendedor-carlos-resolver.ts";

const cases = [
  { v: "YRMA", caso: "CARTERAS", exp: "44" },
  { v: "GRICELDA", caso: "BR-VZ-MD-ML-MKA-O", exp: "60" },
  { v: "FRANCIS", caso: "PROMOCIONAL", exp: "58" },
  { v: "FRANCIS", caso: "ACT-BRSPORT", exp: "29" },
  { v: "ENRIQUE", caso: "CLASICOS", exp: "42" },
  { v: "IRMA", caso: "TENIS", exp: "44" },
  { v: "LUIS", caso: "CARTERAS", exp: "78" },
  // Regresión 2026-07-29 · CSV 228_44047 · ATI PROMO no puede ser 53 (BR-VZ)
  { v: "ATI", caso: "PROMOCIONAL", exp: "49" },
  { v: "ATI", caso: "PE · PROMOCIONAL", exp: "49" },
  { v: "ATI", caso: "PE · batch · PROMOCIONAL", exp: "49" },
  { v: "ATI", caso: "PE-PROMOCIONAL", exp: "49" },
  { v: "ATI", caso: "BR-VZ-MD-ML-MKA-O", exp: "53" },
  // Primera venta PE 638 (confecciones KYLY/MILON) · PATRICIA · no 654
  { v: "PATRICIA", caso: "BR-VZ-MD-ML-MKA-O", exp: "101" },
  { v: "PATRICIA", caso: "PE · sdrm2745", exp: "101" },
  { v: "PATRICIA", caso: "CLASICOS", exp: "101" },
  { v: "DARIO", caso: "BR-VZ-MD-ML-MKA-O", exp: "111" },
];

let fail = 0;
for (const c of cases) {
  const got = resolveVendedorCarlosParaCsv({ vendedor_nombre: c.v, caso: c.caso });
  const label = formatVendedorCarlosLabel({ vendedor_nombre: c.v, caso: c.caso });
  const ok = got === c.exp;
  console.log(ok ? "PASS" : "FAIL", `${c.v}+${c.caso} → ${got} (${label})`, ok ? "" : `expected ${c.exp}`);
  if (!ok) fail++;
}

console.log(fail === 0 ? "SMOKE OK" : `SMOKE FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
