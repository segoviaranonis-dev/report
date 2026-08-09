import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { MolNode } from "@/lib/situacion-financiera/types";

export const dynamic = "force-dynamic";

let cache: Record<string, MolNode> | null = null;

async function loadIndex(): Promise<Record<string, MolNode>> {
  if (cache) return cache;
  const p = path.join(
    process.cwd(),
    "src",
    "lib",
    "situacion-financiera",
    "molecular-al-0308.json"
  );
  const raw = await fs.readFile(p, "utf-8");
  cache = JSON.parse(raw) as Record<string, MolNode>;
  return cache;
}

export async function GET(req: NextRequest) {
  try {
    const INDEX = await loadIndex();
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({
        ok: true,
        keys: Object.keys(INDEX).sort(),
        n: Object.keys(INDEX).length,
      });
    }
    const node = INDEX[key];
    if (!node) {
      return NextResponse.json(
        { ok: false, error: `Sin detalle molecular / TXT para ${key}` },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, key, node });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Error leyendo molecular",
      },
      { status: 500 }
    );
  }
}
