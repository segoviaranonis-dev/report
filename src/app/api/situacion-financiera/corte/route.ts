import { NextResponse } from "next/server";
import { DEMO_CORTE_AL_0308 } from "@/lib/situacion-financiera/demo-corte-al";
import type { SfCorteResumen } from "@/lib/situacion-financiera/types";
import {
  loadCorteCerradoLabFile,
  loadCorteCerradoSupabase,
} from "@/lib/situacion-financiera/corte-supabase";
import { SF_ISLA, assertSfIslaNoResultadosNexus } from "@/lib/situacion-financiera/isla";
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
  assertSfIslaNoResultadosNexus("GET /api/situacion-financiera/corte");

  // ISLA 2.3.1.50.12: NO leer corte operativo Supabase (ensucia construcción).
  // Solo LAB JSON propio del módulo + pipeline local + demo intake.
  const db = SF_ISLA.permitirCorteSupabaseOperativo
    ? await loadCorteCerradoSupabase()
    : null;
  const lab = db
    ? null
    : await loadCorteCerradoLabFile(async (rel) =>
        fs.readFile(path.join(process.cwd(), rel), "utf-8"),
      );
  const cerrado = db || lab;

  const local = await loadFromPipeline();
  const data: SfCorteResumen = {
    ...DEMO_CORTE_AL_0308,
    ...(local || {}),
    cicloEconomico: DEMO_CORTE_AL_0308.cicloEconomico,
    bloques: DEMO_CORTE_AL_0308.bloques,
  };

  if (cerrado) {
    data.fechaAl = cerrado.fechaAl || data.fechaAl;
    if (cerrado.tasaUsd != null) data.tasaUsd = cerrado.tasaUsd;
    data.estadoPipeline = cerrado.estado;
    data.fuente = cerrado.fuente;
    data.nVariaciones = data.nVariaciones ?? 0;
    // Bloque sintético desde lineas snapshot (cabecera isla)
    if (cerrado.lineas.length) {
      const porMes = new Map<string, typeof data.bloques[0]["lineas"]>();
      for (const ln of cerrado.lineas) {
        const ym = ln.mesYm || "corte";
        if (!porMes.has(ym)) porMes.set(ym, []);
        porMes.get(ym)!.push({
          concepto: ln.concepto,
          importeGs: ln.importeGs,
          origen:
            ln.origen === "auto"
              ? "auto"
              : ln.origen === "cobro"
                ? "auto"
                : "manual",
        });
      }
      data.bloques = Array.from(porMes.entries()).map(([mesYm, lineas]) => ({
        mesYm,
        etiqueta: mesYm,
        lineas,
        saldoDisponibleGs:
          lineas.find((l) =>
            (l.concepto || "").toUpperCase().includes("SALDO DISPONIBLE"),
          )?.importeGs ?? null,
      }));
    }
  }

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
  return NextResponse.json({
    ok: true,
    corte: data,
    meta: {
      isla: SF_ISLA.aislada,
      islaCodigo: SF_ISLA.codigo,
      fuenteCerrada: cerrado ? (db ? "supabase" : "lab_json_isla") : null,
      corteId: cerrado?.corteId ?? null,
      nLineasCerradas: cerrado?.lineas.length ?? 0,
      norte: "isla_faro_alejandria",
      supabaseOperativo: SF_ISLA.permitirCorteSupabaseOperativo,
    },
  });
}
