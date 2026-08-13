/**
 * Genera snapshot JSON isla COSTOS — prod Vercel (sin Z:\hector).
 * Fuente: lab TXT Carlos · D1 + D3.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { buildArchivoFromTxt } from "../src/lib/costos-rimec-isla/parse-ifstgp4-txt";
import {
  COSTOS_LAB_TXT_SOURCES,
  type CostosLabTxtSource,
} from "../src/lib/costos-rimec-isla/lab-txt-config";

function readTxt(path: string): string {
  return readFileSync(path, "latin1");
}

function resolveSource(src: CostosLabTxtSource): string | null {
  for (const p of src.candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function main() {
  const archivos = [];
  for (const src of COSTOS_LAB_TXT_SOURCES) {
    const path = resolveSource(src);
    if (!path) {
      console.error("FAIL missing TXT", src.label, src.candidates);
      process.exit(1);
    }
    const text = readTxt(path);
    const nombre = path.split(/[/\\]/).pop() ?? src.label;
    archivos.push(buildArchivoFromTxt(nombre, text));
    console.log("OK", src.label, path, "· SKUs", archivos.at(-1)?.lineas.length);
  }

  const outDir = resolve(__dirname, "../data/costos-lab");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "snapshot.json");
  const payload = {
    generado: new Date().toISOString(),
    fuente: "lab-txt-hector",
    modulo: "costos-rimec-isla",
    archivos,
  };
  writeFileSync(outPath, JSON.stringify(payload), "utf8");
  const kb = Math.round(readFileSync(outPath).length / 1024);
  console.log("WROTE", outPath, kb, "KB · archivos", archivos.length);
}

main();
