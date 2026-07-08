import fs from "node:fs";

const env = fs.readFileSync("c:/Users/hecto/Nexus_Core/report/.env.local", "utf8");
const supa = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, "");

const stems = [
  "4134-446-9921-100196.jpg",
  "4134-446-9921-15745.jpg",
  "4134-446.jpg",
];

for (const stem of stems) {
  for (const tier of ["sm", "md", "lg", ""]) {
    const path = tier ? `${tier}/${stem}` : stem;
    const url = `${supa}/storage/v1/object/public/productos/${path}`;
    const res = await fetch(url, { method: "HEAD" });
    console.log(res.status, path);
  }
}
