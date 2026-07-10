/** Smoke hotfix grada — metadata _shop/_brand fuera de compacto */
const META = new Set(["_shop", "_brand", "_item"]);

function isTalla(k) {
  if (!k || k.startsWith("_") || META.has(k)) return false;
  const n = Number(String(k).split("/")[0].replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 20 && n <= 55;
}

function soloTallas(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isTalla(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function toCompacto(raw) {
  const grades = soloTallas(raw);
  const items = Object.entries(grades).sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
  const inter = items.map(([t, c]) => `${t}:${c}`).join(" · ");
  const pares = inter.split("·").map((p) => p.trim());
  const tallas = [];
  const cantidades = [];
  for (const par of pares) {
    const [t, c] = par.split(":");
    tallas.push(t.trim());
    cantidades.push(c.trim());
  }
  return `${tallas[0]}(${cantidades.join(" ")})${tallas[tallas.length - 1]}`;
}

const sample = {
  34: 1,
  35: 2,
  36: 3,
  37: 3,
  38: 2,
  39: 1,
  _shop: "1359",
  _brand: "974",
};

const bad = "35(1 2 3 3 2 1 139 974 )_brand";
const got = toCompacto(sample);
const expect = "34(1 2 3 3 2 1)39";
console.log("got:", got);
console.log("expect:", expect);
console.log("bad was like:", bad);
const ok = got === expect;
console.log(ok ? "VERIFY PASS" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
