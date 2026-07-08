import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const supaUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim();

const tests = [
  "8524-116-9569-35312.jpg",
  "8524-116-9569-15745.jpg",
  "8530-120-32269-112171.jpg",
  "8546-214-21736-95373.jpg",
  "8546-214-21736-15745.jpg",
];

async function check(file) {
  const paths = [
    `sm/${file}`,
    `md/${file}`,
    file,
    `thumbs/${file}`,
    `8524-116.jpg`,
    `8530-120.jpg`,
  ];
  const out = {};
  for (const p of paths) {
    const url = `${supaUrl}/storage/v1/object/public/productos/${p}`;
    const r = await fetch(url, { method: "HEAD" });
    out[p] = r.status;
  }
  return out;
}

for (const t of tests) {
  console.log(t, await check(t));
}
