import fs from "node:fs";
import { spawnSync } from "node:child_process";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const db = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
const supa = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");

const pyEnv = {
  ...process.env,
  DATABASE_URL: db,
  NEXT_PUBLIC_SUPABASE_URL: supa,
  PYTHONIOENCODING: "utf-8",
};

const code = `
from core.pdf_factura_individual import _bruto_desde_neto, _resolve_item_image
b = _bruto_desde_neto(57174, 5, 10, 10, 0)
assert b == 74300, b
snap = {"linea_codigo": "4134", "ref_codigo": "446", "material_code": "9921", "color_code": "100196"}
img = _resolve_item_image(snap)
assert img is not None, "sin imagen L-R-M-C"
print("OK bruto", b, "img", type(img).__name__)
`;

const r = spawnSync("python", ["-c", code], {
  cwd: "c:/Users/hecto/Nexus_Core/control_central",
  env: pyEnv,
  encoding: "utf-8",
  timeout: 30000,
});

if (r.status !== 0) {
  console.error("FAIL", r.stderr || r.stdout);
  process.exit(1);
}
console.log(r.stdout.trim());
