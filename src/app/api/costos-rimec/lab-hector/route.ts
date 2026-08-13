import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  COSTOS_LAB_SNAPSHOT_PATH,
  COSTOS_LAB_TXT_SOURCES,
} from "@/lib/costos-rimec-isla/lab-txt-config";
import { buildArchivoFromTxt } from "@/lib/costos-rimec-isla/parse-ifstgp4-txt";
import type { CostosTxtArchivo } from "@/lib/costos-rimec-isla/types";
import { requireMotorPreciosAdmin } from "@/lib/motor-precios/auth-api";

function readSnapshot(): CostosTxtArchivo[] | null {
  try {
    if (!fs.existsSync(COSTOS_LAB_SNAPSHOT_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(COSTOS_LAB_SNAPSHOT_PATH, "utf8")) as {
      archivos?: CostosTxtArchivo[];
    };
    return raw.archivos?.length ? raw.archivos : null;
  } catch {
    return null;
  }
}

function readFromTxtSources(): { archivos: CostosTxtArchivo[]; mode: "txt-live" } | { error: string } {
  const archivos: CostosTxtArchivo[] = [];
  for (const src of COSTOS_LAB_TXT_SOURCES) {
    const hit = src.candidates.find((p) => fs.existsSync(p));
    if (!hit) {
      return { error: `No encontrado TXT lab: ${src.label}` };
    }
    const text = fs.readFileSync(hit, "latin1");
    const nombre = path.basename(hit);
    archivos.push(buildArchivoFromTxt(nombre, text));
  }
  return { archivos, mode: "txt-live" };
}

/** GET — lab D1+D3 · snapshot empaquetado (prod) o TXT vivo (local Z:). */
export async function GET(req: Request) {
  const gate = await requireMotorPreciosAdmin();
  if (gate.error) return gate.error;

  const url = new URL(req.url);
  const forceLive = url.searchParams.get("live") === "1";

  try {
    if (!forceLive) {
      const snap = readSnapshot();
      if (snap) {
        return NextResponse.json({
          ok: true,
          modulo: "costos-rimec-isla",
          fuente: "lab-snapshot",
          archivos: snap,
        });
      }
    }

    const live = readFromTxtSources();
    if ("error" in live) {
      const snap = readSnapshot();
      if (snap) {
        return NextResponse.json({
          ok: true,
          modulo: "costos-rimec-isla",
          fuente: "lab-snapshot-fallback",
          warn: live.error,
          archivos: snap,
        });
      }
      return NextResponse.json({ ok: false, error: live.error }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      modulo: "costos-rimec-isla",
      fuente: live.mode,
      archivos: live.archivos,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error leyendo lab COSTOS" },
      { status: 500 },
    );
  }
}
