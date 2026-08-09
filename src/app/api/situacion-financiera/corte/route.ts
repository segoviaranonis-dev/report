import { NextResponse } from "next/server";
import { DEMO_CORTE_AL_0308 } from "@/lib/situacion-financiera/demo-corte-al";
import type { SfCorteResumen } from "@/lib/situacion-financiera/types";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/** Intenta enriquecer con persistencia LAB local; si no hay, demo AL 03-08. */
async function loadFromPipeline(): Promise<Partial<SfCorteResumen> | null> {
  try {
    const base = path.join(
      process.cwd(),
      "scripts",
      "situacion-financiera",
      "out",
      "AL-03-08-26",
    );
    const persistPath = path.join(base, "persistencia.json");
    const resumenPath = path.join(base, "resumen.json");
    const persistRaw = await fs.readFile(persistPath, "utf-8").catch(() => null);
    const resumenRaw = await fs.readFile(resumenPath, "utf-8").catch(() => null);
    if (!persistRaw && !resumenRaw) return null;

    const persist = persistRaw ? JSON.parse(persistRaw) : {};
    const resumen = resumenRaw ? JSON.parse(resumenRaw) : {};
    const cheques = resumen?.totales_clave?.cheques_por_mes || {};
    const aging = resumen?.totales_clave?.aging || {};
    const pv = resumen?.totales_clave?.pv_prog_por_mes || {};

    return {
      estadoPipeline: persist.estado || "desconocido",
      nVariaciones: persist.n_variaciones ?? 0,
      chequesPorMes: Object.entries(cheques)
        .filter(([k]) => !String(k).startsWith("_") && !String(k).endsWith("+"))
        .map(([mesYm, importeGs]) => ({
          mesYm,
          importeGs: Number(importeGs) || 0,
        })),
      pvProgPorMes: Object.entries(pv).map(([mesYm, importeGs]) => ({
        mesYm,
        importeGs: Number(importeGs) || 0,
      })),
      aging: Object.entries(aging).map(([key, importeGs]) => ({
        key,
        label: key,
        importeGs: Number(importeGs) || 0,
      })),
      fuente: `pipeline local · batch ${persist.batch_id || "—"}`,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const local = await loadFromPipeline();
  const data: SfCorteResumen = {
    ...DEMO_CORTE_AL_0308,
    ...(local || {}),
    cicloEconomico: DEMO_CORTE_AL_0308.cicloEconomico,
    bloques: DEMO_CORTE_AL_0308.bloques,
  };
  if (local?.chequesPorMes?.length) {
    data.chequesPorMes = local.chequesPorMes;
  }
  if (local?.pvProgPorMes?.length) {
    data.pvProgPorMes = local.pvProgPorMes;
  }
  if (local?.aging?.length) {
    data.aging = local.aging.map((a) => ({
      ...a,
      label:
        DEMO_CORTE_AL_0308.aging.find((x) => x.key === a.key)?.label || a.label,
    }));
  }
  return NextResponse.json({ ok: true, corte: data });
}
