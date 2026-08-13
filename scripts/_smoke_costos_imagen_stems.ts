import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { buildArchivoFromTxt } from "../src/lib/costos-rimec-isla/parse-ifstgp4-txt";
import {
  labelMoleculaCostos,
  pilaresImagenCostos,
} from "../src/lib/costos-rimec-isla/molecule-label";
import { productImageCandidatesForRow } from "../src/lib/retail/product-image";
import { productImagePrimaryStem } from "../src/lib/retail/product-image-protocol";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    process.env[t.slice(0, eq).trim()] ??= t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const labPath = "Z:\\hector\\23956181.txt";
if (!existsSync(labPath)) {
  console.log("SKIP lab missing");
  process.exit(0);
}

const arch = buildArchivoFromTxt("lab.txt", readFileSync(labPath, "latin1"));
const milon = arch.lineas.find((l) => l.codigo === "638.231820");
if (!milon) {
  console.error("FAIL 638.231820 not found");
  process.exit(1);
}

const label = labelMoleculaCostos(milon);
if (label !== "7407-11-K7407-K8549-14") {
  console.error("FAIL label MILON", label, milon);
  process.exit(1);
}

const pil = pilaresImagenCostos(milon);
const stem638 = productImagePrimaryStem({
  linea: pil.linea,
  referencia: pil.referencia,
  material: pil.material,
  color: pil.color,
  imagenColorExcel: pil.imagenColorExcel,
  tipoV2Id: 2,
  proveedorImportacionId: 638,
});
if (stem638 !== "7407_8549") {
  console.error("FAIL stem 638 MILON", stem638);
  process.exit(1);
}

const url638 = productImageCandidatesForRow(
  pil.linea,
  pil.referencia,
  pil.material,
  pil.color,
  null,
  "thumb",
  {
    tipoV2Id: 2,
    proveedorImportacionId: 638,
    imagenColorExcel: pil.imagenColorExcel,
  },
)[0];
if (!url638 || !url638.includes("7407_8549")) {
  console.error("FAIL url 638", url638);
  process.exit(1);
}

const act654 = arch.lineas.find((l) => l.codigo === "654.216483");
if (act654) {
  const label654 = labelMoleculaCostos(act654);
  if (!label654.startsWith("40004-6-")) {
    console.error("FAIL label 654", label654);
    process.exit(1);
  }
  const stem654 = productImagePrimaryStem({
    linea: act654.linea,
    referencia: act654.referencia,
    material: act654.material,
    color: act654.color,
    tipoV2Id: 1,
    proveedorImportacionId: 654,
  });
  if (!stem654?.includes("40004-6-")) {
    console.error("FAIL stem 654", stem654);
    process.exit(1);
  }
}

const bad638 = arch.lineas.filter((l) => l.proveedorId === 638 && (!l.linea || l.linea === "0"));
if (bad638.length > 0) {
  console.error("FAIL 638 sin linea", bad638.length, bad638[0]);
  process.exit(1);
}

console.log("PASS costos pilares+imagen · MILON", label, "· stem", stem638);
