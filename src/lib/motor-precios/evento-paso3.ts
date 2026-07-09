import type { Pool } from "pg";
import type { SkuStagingRow } from "./excel-proveedor";
import { normalizarMarca } from "./ley-genero";
import { parseCodigoPilar, PilaresBulkResolver, codigoLineaDesdeSku } from "./evento-pilares";
import { cargarSkusExcel, contarSkusExcel } from "./evento-sku-staging";

export type CasoAsignacion = {
  id: number;
  nombre_caso: string;
  lineas: string[];
  marcas: string[] | null;
};

export type StagingRow = {
  evento_id: number;
  caso_id: number;
  marca: string;
  linea_id: number;
  referencia_id: number;
  material_id: number;
  fob_fabrica: number;
};

export type Paso3PrepResult = {
  staging: StagingRow[];
  warnings: string[];
  skus_total: number;
  skus_resueltos: number;
  skus_sin_caso: number;
};

async function cargarCasosAsignacion(pool: Pool, eventoId: number): Promise<CasoAsignacion[]> {
  const { rows } = await pool.query<{
    id: string;
    nombre_caso: string;
    marcas: string[] | null;
    lineas: string[] | null;
  }>(
    `SELECT pec.id, pec.nombre_caso, pec.marcas,
            COALESCE(
              array_agg(DISTINCT l.codigo_proveedor::text)
                FILTER (WHERE l.codigo_proveedor IS NOT NULL),
              '{}'
            ) AS lineas
     FROM precio_evento_caso pec
     LEFT JOIN precio_evento_linea_excepcion pele ON pele.caso_id = pec.id
     LEFT JOIN linea l ON l.id = pele.linea_id
     WHERE pec.evento_id = $1
     GROUP BY pec.id, pec.nombre_caso, pec.marcas
     ORDER BY pec.id`,
    [eventoId],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    nombre_caso: r.nombre_caso,
    lineas: (r.lineas ?? []).map((c) => String(Math.trunc(Number(c)))),
    marcas: r.marcas?.length ? r.marcas.map((m) => normalizarMarca(m)) : null,
  }));
}

function asignarCasoId(sku: SkuStagingRow, casos: CasoAsignacion[]): number | null {
  const lineaCod = codigoLineaDesdeSku(sku);
  const marcaNorm = normalizarMarca(sku.marca);

  if (lineaCod) {
    for (const c of casos) {
      if (c.lineas.includes(lineaCod)) return c.id;
    }
  }

  for (const c of casos) {
    if (c.marcas?.length && c.marcas.some((m) => m === marcaNorm || marcaNorm.includes(m))) {
      return c.id;
    }
  }

  const catchAll = casos.find((c) => !c.lineas.length && (!c.marcas || !c.marcas.length));
  if (catchAll) return catchAll.id;

  return casos.length === 1 ? casos[0].id : null;
}

export type LineaHuérfana = {
  marca: string;
  linea_codigo: string;
  skus_afectados: number;
};

export type CoberturaCasosResult = {
  warnings: string[];
  skus_total: number;
  skus_con_caso: number;
  skus_sin_caso: number;
  lineas_sin_caso: number;
  lineas_huerfanas: LineaHuérfana[];
  huerfanos: Array<{
    marca: string;
    linea: string;
    referencia: string;
    material: string;
  }>;
};

/** Preview — solo Excel × matriz de casos (sin tocar pilares en BD). */
export async function auditarCoberturaCasos(pool: Pool, eventoId: number): Promise<CoberturaCasosResult> {
  const skus = await cargarSkusExcel(pool, eventoId);
  const casos = await cargarCasosAsignacion(pool, eventoId);
  const warnings: string[] = [];
  const huerfanos: CoberturaCasosResult["huerfanos"] = [];
  const lineasMap = new Map<string, { marca: string; count: number }>();
  let conCaso = 0;
  let sinCaso = 0;

  if (!skus.length) {
    warnings.push("No hay SKUs Excel persistidos — volvé al Paso 0 y cargá el archivo.");
  }
  if (!casos.length) {
    warnings.push("Matriz de casos vacía — asigná biblioteca en Memoria.");
  }

  for (const sku of skus) {
    const casoId = asignarCasoId(sku, casos);
    if (!casoId) {
      sinCaso += 1;
      const lineaCod = codigoLineaDesdeSku(sku);
      if (lineaCod) {
        const prev = lineasMap.get(lineaCod);
        lineasMap.set(lineaCod, {
          marca: sku.marca,
          count: (prev?.count ?? 0) + 1,
        });
      }
      if (huerfanos.length < 200) {
        huerfanos.push({
          marca: sku.marca,
          linea: sku.linea,
          referencia: sku.referencia,
          material: sku.material,
        });
      }
    } else {
      conCaso += 1;
    }
  }

  const lineas_huerfanas: LineaHuérfana[] = [...lineasMap.entries()]
    .map(([linea_codigo, v]) => ({
      marca: v.marca,
      linea_codigo,
      skus_afectados: v.count,
    }))
    .sort((a, b) => Number(a.linea_codigo) - Number(b.linea_codigo));

  return {
    warnings,
    skus_total: skus.length,
    skus_con_caso: conCaso,
    skus_sin_caso: sinCaso,
    lineas_sin_caso: lineas_huerfanas.length,
    lineas_huerfanas,
    huerfanos,
  };
}

export async function prepararStagingPaso3(
  pool: Pool,
  eventoId: number,
  proveedorId: number,
): Promise<Paso3PrepResult> {
  const skus = await cargarSkusExcel(pool, eventoId);
  const casos = await cargarCasosAsignacion(pool, eventoId);
  const warnings: string[] = [];
  const staging: StagingRow[] = [];
  let sinCaso = 0;

  if (!skus.length) {
    warnings.push("No hay SKUs Excel persistidos — volvé al Paso 0 y cargá el archivo.");
  }
  if (!casos.length) {
    warnings.push("Matriz de casos vacía — asigná biblioteca en Memoria.");
  }

  const pilaresResolver = new PilaresBulkResolver(pool, proveedorId);
  await pilaresResolver.preload();

  for (const sku of skus) {
    const pilares = await pilaresResolver.resolveOrEnsure(sku);
    if (!pilares) {
      warnings.push(`SKU sin pilares: ${sku.marca} · L${sku.linea} R${sku.referencia} M${sku.material}`);
      continue;
    }
    const casoId = asignarCasoId(sku, casos);
    if (!casoId) {
      sinCaso += 1;
      warnings.push(`Sin caso: ${sku.marca} · L${sku.linea} (${sku.referencia})`);
      continue;
    }
    staging.push({
      evento_id: eventoId,
      caso_id: casoId,
      marca: sku.marca,
      linea_id: pilares.linea_id,
      referencia_id: pilares.referencia_id,
      material_id: pilares.material_id,
      fob_fabrica: sku.fob_fabrica,
    });
  }

  return {
    staging,
    warnings,
    skus_total: skus.length,
    skus_resueltos: staging.length,
    skus_sin_caso: sinCaso,
  };
}

async function sqlFunctionExists(pool: Pool, name: string): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = $1
     ) AS ok`,
    [name],
  );
  return rows[0]?.ok === true;
}

export type Paso3CalcResult =
  | {
      ok: true;
      n_staging: number;
      n_precio_lista: number;
      duracion_ms: number;
      warnings: string[];
      skus_total: number;
      recalculo: boolean;
    }
  | { ok: false; error: string; warnings?: string[] };

export async function ejecutarCalculoPaso3(
  pool: Pool,
  eventoId: number,
  proveedorId: number,
  opts?: { recalcular?: boolean },
): Promise<Paso3CalcResult> {
  const { rows: evRows } = await pool.query<{ estado: string }>(
    `SELECT estado FROM precio_evento WHERE id = $1`,
    [eventoId],
  );
  if (!evRows[0]) return { ok: false, error: "Evento no encontrado" };
  if (String(evRows[0].estado).toLowerCase() === "cerrado") {
    return { ok: false, error: "Evento cerrado — no se puede recalcular." };
  }

  const { rows: plCount } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM precio_lista WHERE evento_id = $1`,
    [eventoId],
  );
  const nExistente = Number(plCount[0]?.n ?? 0);
  if (nExistente > 0 && !opts?.recalcular) {
    return {
      ok: false,
      error: `Ya hay ${nExistente} filas en precio_lista. Usá recalcular=true para regenerar.`,
    };
  }

  const prep = await prepararStagingPaso3(pool, eventoId, proveedorId);
  if (!prep.staging.length) {
    return {
      ok: false,
      error: "No se preparó ninguna fila para staging.",
      warnings: prep.warnings,
    };
  }

  if (!(await sqlFunctionExists(pool, "calcular_precio_lista_evento_sql"))) {
    return {
      ok: false,
      error: "Función calcular_precio_lista_evento_sql no existe en BD — aplicá migración 053.",
      warnings: prep.warnings,
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (opts?.recalcular && nExistente > 0) {
      await client.query(`DELETE FROM precio_lista WHERE evento_id = $1`, [eventoId]);
    }

    await client.query(`DELETE FROM precio_lista_staging WHERE evento_id = $1`, [eventoId]);

    const CHUNK = 400;
    for (let i = 0; i < prep.staging.length; i += CHUNK) {
      const slice = prep.staging.slice(i, i + CHUNK);
      const values: unknown[] = [];
      const chunks: string[] = [];
      slice.forEach((s, idx) => {
        const b = idx * 7;
        chunks.push(
          `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`,
        );
        values.push(
          s.evento_id,
          s.caso_id,
          s.marca,
          s.linea_id,
          s.referencia_id,
          s.material_id,
          s.fob_fabrica,
        );
      });
      await client.query(
        `INSERT INTO precio_lista_staging
           (evento_id, caso_id, marca, linea_id, referencia_id, material_id, fob_fabrica)
         VALUES ${chunks.join(", ")}`,
        values,
      );
    }

    const calc = await client.query<{ total: string; duracion_ms: string; error: string | null }>(
      `SELECT total::text, duracion_ms::text, error
       FROM calcular_precio_lista_evento_sql($1)`,
      [eventoId],
    );
    const row = calc.rows[0];
    const total = Number(row?.total ?? 0);
    const duracion_ms = Number(row?.duracion_ms ?? 0);
    if (row?.error) {
      throw new Error(String(row.error));
    }
    if (total <= 0) {
      throw new Error("calcular_precio_lista_evento_sql retornó 0 filas — revisá matriz de casos y staging.");
    }

    await client.query(`DELETE FROM precio_lista_staging WHERE evento_id = $1`, [eventoId]);
    await client.query(
      `UPDATE precio_evento SET estado = 'validado' WHERE id = $1 AND estado NOT IN ('cerrado')`,
      [eventoId],
    );
    await client.query("COMMIT");

    return {
      ok: true,
      n_staging: prep.staging.length,
      n_precio_lista: total,
      duracion_ms,
      warnings: prep.warnings,
      skus_total: prep.skus_total,
      recalculo: Boolean(opts?.recalcular && nExistente > 0),
    };
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : "Error en cálculo Paso 3";
    return { ok: false, error: msg, warnings: prep.warnings };
  } finally {
    client.release();
  }
}

export async function resumenPaso3(pool: Pool, eventoId: number) {
  const n_excel = await contarSkusExcel(pool, eventoId);
  const { rows } = await pool.query<{ n_precio_lista: string; estado: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM precio_lista WHERE evento_id = $1) AS n_precio_lista,
       pe.estado
     FROM precio_evento pe WHERE pe.id = $1`,
    [eventoId],
  );
  const r = rows[0];
  return {
    n_precio_lista: Number(r?.n_precio_lista ?? 0),
    n_excel,
    estado: r?.estado ?? "borrador",
  };
}

export async function muestraPrecioLista(pool: Pool, eventoId: number, limit = 50) {
  const { rows } = await pool.query<{
    nombre_caso_aplicado: string;
    linea_codigo: string;
    referencia_codigo: string;
    material_codigo: string;
    fob_fabrica: string;
    lpn: string;
    lpc03: string | null;
    lpc04: string | null;
  }>(
    `SELECT pl.nombre_caso_aplicado,
            l.codigo_proveedor::text AS linea_codigo,
            r.codigo_proveedor::text AS referencia_codigo,
            m.codigo_proveedor::text AS material_codigo,
            pl.fob_fabrica::text,
            pl.lpn::text,
            pl.lpc03::text,
            pl.lpc04::text
     FROM precio_lista pl
     JOIN linea l ON l.id = pl.linea_id
     JOIN referencia r ON r.id = pl.referencia_id
     JOIN material m ON m.id = pl.material_id
     WHERE pl.evento_id = $1
     ORDER BY pl.nombre_caso_aplicado, l.codigo_proveedor, r.codigo_proveedor
     LIMIT $2`,
    [eventoId, limit],
  );
  return rows.map((r) => ({
    nombre_caso: r.nombre_caso_aplicado,
    linea: r.linea_codigo,
    referencia: r.referencia_codigo,
    material: r.material_codigo,
    fob: Number(r.fob_fabrica),
    lpn: Number(r.lpn),
    lpc03: r.lpc03 != null ? Number(r.lpc03) : null,
    lpc04: r.lpc04 != null ? Number(r.lpc04) : null,
  }));
}
