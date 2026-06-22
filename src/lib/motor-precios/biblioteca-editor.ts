import type { Pool } from "pg";
import { calcIndiceGs, normalizarCaso, validarExclusividadCasosLineas, type CasoInput } from "./caso-utils";
import { esBibliotecaCanonica } from "./constants";
import { sortKeyLinea } from "./lineas-texto";

export type CasoBibliotecaRow = {
  id: number;
  nombre_caso: string;
  dolar_politica: number;
  factor_conversion: number;
  descuento_1: number | null;
  descuento_2: number | null;
  descuento_3: number | null;
  descuento_4: number | null;
  genera_lpc03_lpc04: boolean;
  lineas: string[];
  lineas_count: number;
  indice_gs: number;
};

export type BibliotecaEditorPayload = {
  biblioteca: {
    id: number;
    nombre: string;
    proveedor_id: number;
    canonica: boolean;
  };
  resumen: {
    n_pilar: number;
    n_asignadas: number;
    n_libres: number;
    n_casos: number;
  };
  casos: CasoBibliotecaRow[];
};

async function lineasPorCasoBiblioteca(pool: Pool, bibliotecaId: number): Promise<Map<number, string[]>> {
  const { rows } = await pool.query<{ caso_biblioteca_id: string; cod: string }>(
    `SELECT bcl.caso_biblioteca_id, l.codigo_proveedor::text AS cod
     FROM biblioteca_caso_linea bcl
     JOIN linea l ON l.id = bcl.linea_id
     WHERE bcl.biblioteca_id = $1
     ORDER BY bcl.caso_biblioteca_id, l.codigo_proveedor`,
    [bibliotecaId],
  );
  const map = new Map<number, string[]>();
  for (const r of rows) {
    const cid = Number(r.caso_biblioteca_id);
    try {
      const cod = String(Math.trunc(parseFloat(r.cod)));
      const arr = map.get(cid) ?? [];
      arr.push(cod);
      map.set(cid, arr);
    } catch {
      /* skip */
    }
  }
  return map;
}

async function cargarPilarLineas(pool: Pool, proveedorId: number): Promise<Set<string>> {
  const { rows } = await pool.query<{ cod: string }>(
    `SELECT codigo_proveedor::text AS cod
     FROM linea
     WHERE proveedor_id = $1 AND activo = true`,
    [proveedorId],
  );
  const set = new Set<string>();
  for (const r of rows) {
    try {
      set.add(String(Math.trunc(parseFloat(r.cod))));
    } catch {
      /* skip */
    }
  }
  return set;
}

/** Limpia BCL huérfana / desincronizada tras traslados parciales (evita UNIQUE bib+linea). */
async function repararBclDesincronizado(pool: Pool, proveedorId: number): Promise<void> {
  await pool.query(
    `DELETE FROM biblioteca_caso_linea bcl
     USING caso_precio_biblioteca cpb
     WHERE bcl.caso_biblioteca_id = cpb.id
       AND cpb.proveedor_id = $1
       AND bcl.biblioteca_id <> cpb.biblioteca_id
       AND EXISTS (
         SELECT 1 FROM biblioteca_caso_linea bcl2
         WHERE bcl2.biblioteca_id = cpb.biblioteca_id AND bcl2.linea_id = bcl.linea_id
       )`,
    [proveedorId],
  );

  await pool.query(
    `UPDATE biblioteca_caso_linea bcl
     SET biblioteca_id = cpb.biblioteca_id
     FROM caso_precio_biblioteca cpb
     WHERE bcl.caso_biblioteca_id = cpb.id
       AND cpb.proveedor_id = $1
       AND cpb.biblioteca_id IS NOT NULL
       AND bcl.biblioteca_id <> cpb.biblioteca_id`,
    [proveedorId],
  );

  await pool.query(
    `DELETE FROM biblioteca_caso_linea bcl
     WHERE bcl.biblioteca_id IN (
       SELECT id FROM biblioteca_precio WHERE proveedor_id = $1 AND activo = true
     )
     AND NOT EXISTS (
       SELECT 1 FROM caso_precio_biblioteca cpb
       WHERE cpb.biblioteca_id = bcl.biblioteca_id AND cpb.activo = true
     )`,
    [proveedorId],
  );
}

export async function loadBibliotecaEditor(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
): Promise<BibliotecaEditorPayload | null> {
  const meta = await pool.query<{ id: string; nombre: string; proveedor_id: string }>(
    `SELECT id, nombre, proveedor_id FROM biblioteca_precio
     WHERE id = $1 AND proveedor_id = $2 AND activo = true`,
    [bibliotecaId, proveedorId],
  );
  if (!meta.rows[0]) return null;

  await repararBclDesincronizado(pool, proveedorId);

  const lineasMap = await lineasPorCasoBiblioteca(pool, bibliotecaId);
  const pilarSet = await cargarPilarLineas(pool, proveedorId);

  const { rows: casosRows } = await pool.query<{
    id: string;
    nombre_caso: string;
    dolar_politica: string;
    factor_conversion: string;
    descuento_1: string | null;
    descuento_2: string | null;
    descuento_3: string | null;
    descuento_4: string | null;
    genera_lpc03_lpc04: boolean;
    lineas: string[] | null;
  }>(
    `SELECT id, nombre_caso, dolar_politica, factor_conversion,
            descuento_1, descuento_2, descuento_3, descuento_4,
            genera_lpc03_lpc04, lineas
     FROM caso_precio_biblioteca
     WHERE biblioteca_id = $1 AND activo = true
     ORDER BY nombre_caso`,
    [bibliotecaId],
  );

  const casos: CasoBibliotecaRow[] = casosRows.map((r) => {
    const cid = Number(r.id);
    const fromBcl = lineasMap.get(cid) ?? [];
    const fallback = (r.lineas ?? []).map(String);
    const lineas = fromBcl.length ? fromBcl : fallback;
    const dolar = Number(r.dolar_politica) || 8000;
    const factor = Number(r.factor_conversion) || 180;
    return {
      id: cid,
      nombre_caso: r.nombre_caso,
      dolar_politica: dolar,
      factor_conversion: factor,
      descuento_1: r.descuento_1 != null ? Number(r.descuento_1) : null,
      descuento_2: r.descuento_2 != null ? Number(r.descuento_2) : null,
      descuento_3: r.descuento_3 != null ? Number(r.descuento_3) : null,
      descuento_4: r.descuento_4 != null ? Number(r.descuento_4) : null,
      genera_lpc03_lpc04: r.genera_lpc03_lpc04 !== false,
      lineas: [...lineas].sort((a, b) => {
        const [ka, kb] = [sortKeyLinea(a), sortKeyLinea(b)];
        return ka[0] !== kb[0] ? ka[0] - kb[0] : Number(ka[1]) - Number(kb[1]);
      }),
      lineas_count: lineas.length,
      indice_gs: calcIndiceGs(dolar, factor),
    };
  });

  const asignadas = new Set<string>();
  for (const c of casos) for (const ln of c.lineas) asignadas.add(ln);

  const nombre = meta.rows[0].nombre;
  return {
    biblioteca: {
      id: Number(meta.rows[0].id),
      nombre,
      proveedor_id: Number(meta.rows[0].proveedor_id),
      canonica: esBibliotecaCanonica(nombre),
    },
    resumen: {
      n_pilar: pilarSet.size,
      n_asignadas: asignadas.size,
      n_libres: Math.max(0, pilarSet.size - asignadas.size),
      n_casos: casos.length,
    },
    casos,
  };
}

async function onConflictFragment(pool: Pool): Promise<string> {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_constraint WHERE conname = 'biblioteca_caso_linea_bib_linea_uq' LIMIT 1`,
  );
  return rows.length
    ? "ON CONFLICT (biblioteca_id, linea_id) DO NOTHING"
    : "ON CONFLICT (caso_biblioteca_id, linea_id) DO NOTHING";
}

export async function persistirLineasCaso(
  pool: Pool,
  bibliotecaId: number,
  casoId: number,
  proveedorId: number,
  codigos: string[],
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conflict = await onConflictFragment(pool);

    await client.query(
      `DELETE FROM biblioteca_caso_linea WHERE biblioteca_id = $1 AND caso_biblioteca_id = $2`,
      [bibliotecaId, casoId],
    );

    let n = 0;
    if (codigos.length) {
      const codesInt = codigos.map((c) => parseInt(c, 10)).filter((n) => Number.isFinite(n));
      if (codesInt.length) {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO biblioteca_caso_linea (biblioteca_id, caso_biblioteca_id, linea_id)
           SELECT $1, $2, l.id
           FROM linea l
           WHERE l.proveedor_id = $3 AND l.codigo_proveedor = ANY($4::bigint[])
           ${conflict}
           RETURNING id`,
          [bibliotecaId, casoId, proveedorId, codesInt],
        );
        n = ins.rowCount ?? ins.rows.length;
      }
    }

    await client.query(`UPDATE caso_precio_biblioteca SET lineas = $1 WHERE id = $2`, [codigos, casoId]);
    await client.query("COMMIT");
    return n;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function validarLineasParaCaso(
  pool: Pool,
  bibliotecaId: number,
  casoId: number,
  proveedorId: number,
  codigos: string[],
): Promise<{ ok: boolean; error?: string; codigos?: string[] }> {
  const pilar = await cargarPilarLineas(pool, proveedorId);
  const faltantes = codigos.filter((c) => !pilar.has(c));
  if (faltantes.length) {
    return {
      ok: false,
      error: `Códigos fuera del pilar: ${faltantes.slice(0, 8).join(", ")}`,
    };
  }

  const { rows } = await pool.query<{ cod: string; caso_id: string; nombre: string }>(
    `SELECT l.codigo_proveedor::text AS cod, cpb.id::text AS caso_id, cpb.nombre_caso AS nombre
     FROM biblioteca_caso_linea bcl
     JOIN linea l ON l.id = bcl.linea_id
     JOIN caso_precio_biblioteca cpb ON cpb.id = bcl.caso_biblioteca_id
     WHERE bcl.biblioteca_id = $1 AND bcl.caso_biblioteca_id <> $2`,
    [bibliotecaId, casoId],
  );

  const ocupadas = new Map<string, string>();
  for (const r of rows) {
    try {
      ocupadas.set(String(Math.trunc(parseFloat(r.cod))), r.nombre);
    } catch {
      /* skip */
    }
  }

  const conflictos = codigos.filter((c) => ocupadas.has(c));
  if (conflictos.length) {
    const ej = conflictos[0];
    return {
      ok: false,
      error: `Línea ${ej} ya está en otro caso (${ocupadas.get(ej)})`,
    };
  }

  return { ok: true, codigos: [...new Set(codigos)] };
}

export async function updateCasoBiblioteca(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
  casoId: number,
  input: CasoInput,
): Promise<void> {
  const norm = normalizarCaso(input);
  if (!norm.nombre_caso) throw new Error("Nombre de caso obligatorio.");

  await pool.query(
    `UPDATE caso_precio_biblioteca SET
       nombre_caso = $1,
       dolar_politica = $2,
       factor_conversion = $3,
       descuento_1 = $4,
       descuento_2 = $5,
       descuento_3 = $6,
       descuento_4 = $7,
       genera_lpc03_lpc04 = $8,
       alcance_tipo = 'lineas'
     WHERE id = $9 AND biblioteca_id = $10 AND proveedor_id = $11`,
    [
      norm.nombre_caso,
      norm.dolar_politica,
      norm.factor_conversion,
      norm.descuento_1,
      norm.descuento_2,
      norm.descuento_3,
      norm.descuento_4,
      norm.genera_lpc03_lpc04,
      casoId,
      bibliotecaId,
      proveedorId,
    ],
  );
}

export async function crearCasoBiblioteca(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
  input: CasoInput,
  lineasIniciales: string[] = [],
): Promise<number> {
  const norm = normalizarCaso({ ...input, lineas: lineasIniciales });
  if (!norm.nombre_caso) throw new Error("Nombre de caso obligatorio.");

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO caso_precio_biblioteca
       (proveedor_id, biblioteca_id, nombre_caso,
        dolar_politica, factor_conversion,
        descuento_1, descuento_2, descuento_3, descuento_4,
        genera_lpc03_lpc04, alcance_tipo, lineas, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'lineas', $11, true)
     ON CONFLICT (biblioteca_id, nombre_caso) DO UPDATE SET
       dolar_politica = EXCLUDED.dolar_politica,
       factor_conversion = EXCLUDED.factor_conversion,
       descuento_1 = EXCLUDED.descuento_1,
       descuento_2 = EXCLUDED.descuento_2,
       descuento_3 = EXCLUDED.descuento_3,
       descuento_4 = EXCLUDED.descuento_4,
       genera_lpc03_lpc04 = EXCLUDED.genera_lpc03_lpc04,
       alcance_tipo = EXCLUDED.alcance_tipo,
       lineas = EXCLUDED.lineas,
       activo = true
     RETURNING id`,
    [
      proveedorId,
      bibliotecaId,
      norm.nombre_caso,
      norm.dolar_politica,
      norm.factor_conversion,
      norm.descuento_1,
      norm.descuento_2,
      norm.descuento_3,
      norm.descuento_4,
      norm.genera_lpc03_lpc04,
      lineasIniciales,
    ],
  );

  const casoId = Number(rows[0]?.id);
  if (!casoId) throw new Error("No se obtuvo id al crear el caso.");

  if (lineasIniciales.length) {
    const val = await validarLineasParaCaso(pool, bibliotecaId, casoId, proveedorId, lineasIniciales);
    if (!val.ok) throw new Error(val.error);
    await persistirLineasCaso(pool, bibliotecaId, casoId, proveedorId, val.codigos ?? lineasIniciales);
  }

  return casoId;
}

export async function countLineasLibresParaCaso(
  pool: Pool,
  bibliotecaId: number,
  casoId: number,
  proveedorId: number,
): Promise<{ libres: number; en_otros: number }> {
  const pilar = await cargarPilarLineas(pool, proveedorId);
  const { rows } = await pool.query<{ cod: string; caso_id: string }>(
    `SELECT l.codigo_proveedor::text AS cod, bcl.caso_biblioteca_id::text AS caso_id
     FROM biblioteca_caso_linea bcl
     JOIN linea l ON l.id = bcl.linea_id
     WHERE bcl.biblioteca_id = $1`,
    [bibliotecaId],
  );

  const enEste = new Set<string>();
  const enOtros = new Set<string>();
  for (const r of rows) {
    try {
      const cod = String(Math.trunc(parseFloat(r.cod)));
      if (Number(r.caso_id) === casoId) enEste.add(cod);
      else enOtros.add(cod);
    } catch {
      /* skip */
    }
  }

  let libres = 0;
  for (const c of pilar) {
    if (!enEste.has(c) && !enOtros.has(c)) libres++;
  }
  return { libres, en_otros: enOtros.size };
}

export type LineaLibreRow = {
  codigo: string;
  marca: string | null;
};

/** Líneas del pilar no asignadas a ningún caso de esta biblioteca. */
export async function listLineasLibres(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
): Promise<LineaLibreRow[]> {
  const { rows } = await pool.query<{ cod: string; marca: string | null }>(
    `SELECT l.codigo_proveedor::text AS cod, mv.descp_marca::text AS marca
     FROM linea l
     LEFT JOIN marca_v2 mv ON mv.id_marca = l.marca_id
     WHERE l.proveedor_id = $1 AND l.activo = true
       AND NOT EXISTS (
         SELECT 1 FROM biblioteca_caso_linea bcl
         WHERE bcl.biblioteca_id = $2 AND bcl.linea_id = l.id
       )
     ORDER BY l.codigo_proveedor::bigint`,
    [proveedorId, bibliotecaId],
  );

  const out: LineaLibreRow[] = [];
  for (const r of rows) {
    try {
      out.push({
        codigo: String(Math.trunc(parseFloat(r.cod))),
        marca: r.marca?.trim() || null,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function lineasActualesCaso(pool: Pool, bibliotecaId: number, casoId: number): Promise<string[]> {
  const map = await lineasPorCasoBiblioteca(pool, bibliotecaId);
  return map.get(casoId) ?? [];
}

async function agregarLineasIncremental(
  pool: Pool,
  bibliotecaId: number,
  casoId: number,
  proveedorId: number,
  codigosAgregar: string[],
  lineasFinales: string[],
): Promise<void> {
  if (!codigosAgregar.length) return;
  const codesInt = codigosAgregar.map((c) => parseInt(c, 10)).filter((n) => Number.isFinite(n));
  if (!codesInt.length) return;

  const conflict = await onConflictFragment(pool);
  await pool.query(
    `INSERT INTO biblioteca_caso_linea (biblioteca_id, caso_biblioteca_id, linea_id)
     SELECT $1, $2, l.id
     FROM linea l
     WHERE l.proveedor_id = $3 AND l.codigo_proveedor = ANY($4::bigint[])
     ${conflict}`,
    [bibliotecaId, casoId, proveedorId, codesInt],
  );
  await pool.query(`UPDATE caso_precio_biblioteca SET lineas = $1 WHERE id = $2`, [lineasFinales, casoId]);
}

export type AsignacionLinea = { codigo: string; caso_id: number };

/** Asigna líneas libres a casos (incremental, una línea → un caso). */
export async function aplicarAsignacionesLineasLibres(
  pool: Pool,
  bibliotecaId: number,
  proveedorId: number,
  asignaciones: AsignacionLinea[],
): Promise<{ asignadas: number; omitidas: number; errores: string[] }> {
  const errores: string[] = [];
  const libres = new Set((await listLineasLibres(pool, bibliotecaId, proveedorId)).map((l) => l.codigo));

  const porCaso = new Map<number, string[]>();
  const vistos = new Set<string>();

  for (const a of asignaciones) {
    const cod = a.codigo?.trim();
    const casoId = Number(a.caso_id);
    if (!cod || !casoId) continue;
    if (vistos.has(cod)) {
      errores.push(`Línea ${cod} duplicada en la solicitud`);
      continue;
    }
    vistos.add(cod);
    if (!libres.has(cod)) {
      errores.push(`Línea ${cod} ya no está libre`);
      continue;
    }
    const arr = porCaso.get(casoId) ?? [];
    arr.push(cod);
    porCaso.set(casoId, arr);
  }

  if (porCaso.size === 0) {
    return { asignadas: 0, omitidas: asignaciones.length, errores };
  }

  let asignadas = 0;
  for (const [casoId, codigos] of porCaso) {
    const actuales = await lineasActualesCaso(pool, bibliotecaId, casoId);
    const actualesSet = new Set(actuales);
    const delta = codigos.filter((c) => !actualesSet.has(c));
    if (!delta.length) continue;

    const union = [...actualesSet, ...delta].sort((a, b) => {
      const [ka, kb] = [sortKeyLinea(a), sortKeyLinea(b)];
      return ka[0] !== kb[0] ? ka[0] - kb[0] : Number(ka[1]) - Number(kb[1]);
    });

    await agregarLineasIncremental(pool, bibliotecaId, casoId, proveedorId, delta, union);
    asignadas += delta.length;
  }

  return {
    asignadas,
    omitidas: asignaciones.length - asignadas,
    errores,
  };
}

async function vaciarCasosBiblioteca(pool: Pool, bibliotecaId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM biblioteca_caso_linea WHERE biblioteca_id = $1`, [bibliotecaId]);
    await client.query(`UPDATE caso_precio_biblioteca SET activo = false WHERE biblioteca_id = $1`, [bibliotecaId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export type CopiarCasosBibliotecaResult = {
  n_casos: number;
  n_lineas: number;
  origen_biblioteca_id: number;
  dest_biblioteca_id: number;
  modo: "clonar";
};

type CasoOrigenRow = {
  id: string;
  nombre_caso: string;
  dolar_politica: string;
  factor_conversion: string;
  descuento_1: string | null;
  descuento_2: string | null;
  descuento_3: string | null;
  descuento_4: string | null;
  genera_lpc03_lpc04: boolean;
  alcance_tipo: string | null;
  marcas: string[] | null;
  lineas: string[] | null;
};

async function cargarCasosOrigenCompletos(
  pool: Pool,
  origenBibliotecaId: number,
  proveedorId: number,
): Promise<CasoOrigenRow[]> {
  const { rows } = await pool.query<CasoOrigenRow>(
    `SELECT id, nombre_caso, dolar_politica, factor_conversion,
            descuento_1, descuento_2, descuento_3, descuento_4,
            genera_lpc03_lpc04, alcance_tipo, marcas, lineas
     FROM caso_precio_biblioteca
     WHERE biblioteca_id = $1 AND proveedor_id = $2 AND activo = true
     ORDER BY nombre_caso`,
    [origenBibliotecaId, proveedorId],
  );
  return rows;
}

/**
 * Clona casos + líneas BCL de origen → destino. El origen **no se modifica**.
 * Requiere MIG-118: UNIQUE (biblioteca_id, nombre_caso).
 */
export async function copiarCasosDesdeBiblioteca(
  pool: Pool,
  destBibliotecaId: number,
  origenBibliotecaId: number,
  proveedorId: number,
  reemplazar = false,
): Promise<CopiarCasosBibliotecaResult> {
  if (destBibliotecaId === origenBibliotecaId) {
    throw new Error("Origen y destino no pueden ser la misma biblioteca.");
  }

  const origen = await loadBibliotecaEditor(pool, origenBibliotecaId, proveedorId);
  if (!origen) throw new Error("Biblioteca origen no encontrada.");
  const dest = await loadBibliotecaEditor(pool, destBibliotecaId, proveedorId);
  if (!dest) throw new Error("Biblioteca destino no encontrada.");

  if (origen.casos.length === 0) {
    throw new Error("La biblioteca origen no tiene casos para copiar.");
  }

  const conflictos = validarExclusividadCasosLineas(origen.casos);
  if (conflictos.length) {
    throw new Error(`Biblioteca origen inconsistente: ${conflictos[0]}`);
  }

  if (dest.casos.length > 0) {
    if (!reemplazar) {
      throw new Error(
        `Esta biblioteca ya tiene ${dest.casos.length} caso(s). Confirmá reemplazo para copiar desde otra.`,
      );
    }
    await vaciarCasosBiblioteca(pool, destBibliotecaId);
  }

  const casosOrig = await cargarCasosOrigenCompletos(pool, origenBibliotecaId, proveedorId);
  let nLineas = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conflictBcl = await onConflictFragment(pool);

    for (const caso of casosOrig) {
      const lineasArr = (caso.lineas ?? []).map(String);
      const ins = await client.query<{ id: string }>(
        `INSERT INTO caso_precio_biblioteca
           (proveedor_id, biblioteca_id, nombre_caso,
            dolar_politica, factor_conversion,
            descuento_1, descuento_2, descuento_3, descuento_4,
            genera_lpc03_lpc04, alcance_tipo, marcas, lineas, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
         ON CONFLICT (biblioteca_id, nombre_caso) DO UPDATE SET
           dolar_politica = EXCLUDED.dolar_politica,
           factor_conversion = EXCLUDED.factor_conversion,
           descuento_1 = EXCLUDED.descuento_1,
           descuento_2 = EXCLUDED.descuento_2,
           descuento_3 = EXCLUDED.descuento_3,
           descuento_4 = EXCLUDED.descuento_4,
           genera_lpc03_lpc04 = EXCLUDED.genera_lpc03_lpc04,
           alcance_tipo = EXCLUDED.alcance_tipo,
           marcas = EXCLUDED.marcas,
           lineas = EXCLUDED.lineas,
           activo = true
         RETURNING id`,
        [
          proveedorId,
          destBibliotecaId,
          caso.nombre_caso,
          caso.dolar_politica,
          caso.factor_conversion,
          caso.descuento_1,
          caso.descuento_2,
          caso.descuento_3,
          caso.descuento_4,
          caso.genera_lpc03_lpc04 !== false,
          caso.alcance_tipo ?? "lineas",
          caso.marcas,
          lineasArr,
        ],
      );

      const destCasoId = Number(ins.rows[0]?.id);
      if (!destCasoId) throw new Error(`No se clonó el caso ${caso.nombre_caso}.`);

      await client.query(
        `DELETE FROM biblioteca_caso_linea WHERE biblioteca_id = $1 AND caso_biblioteca_id = $2`,
        [destBibliotecaId, destCasoId],
      );

      const { rows: lineasBcl } = await client.query<{ linea_id: string }>(
        `SELECT linea_id FROM biblioteca_caso_linea
         WHERE biblioteca_id = $1 AND caso_biblioteca_id = $2`,
        [origenBibliotecaId, Number(caso.id)],
      );

      if (lineasBcl.length) {
        const ids = lineasBcl.map((r) => Number(r.linea_id));
        const insBcl = await client.query(
          `INSERT INTO biblioteca_caso_linea (biblioteca_id, caso_biblioteca_id, linea_id)
           SELECT $1, $2, x.lid
           FROM unnest($3::bigint[]) AS x(lid)
           ${conflictBcl}`,
          [destBibliotecaId, destCasoId, ids],
        );
        nLineas += insBcl.rowCount ?? ids.length;
      } else if (lineasArr.length) {
        const codesInt = lineasArr.map((c) => parseInt(c, 10)).filter((n) => Number.isFinite(n));
        if (codesInt.length) {
          const insBcl = await client.query(
            `INSERT INTO biblioteca_caso_linea (biblioteca_id, caso_biblioteca_id, linea_id)
             SELECT $1, $2, l.id
             FROM linea l
             WHERE l.proveedor_id = $3 AND l.codigo_proveedor = ANY($4::bigint[])
             ${conflictBcl}`,
            [destBibliotecaId, destCasoId, proveedorId, codesInt],
          );
          nLineas += insBcl.rowCount ?? 0;
        }
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("caso_precio_biblioteca_biblioteca_nombre_uq") || msg.includes("there is no unique")) {
      throw new Error(
        "Falta migración 118 en BD (unique por biblioteca). Ejecutá control_central/migrations/118_caso_precio_biblioteca_unique_por_biblioteca.sql",
      );
    }
    throw e;
  } finally {
    client.release();
  }

  return {
    n_casos: casosOrig.length,
    n_lineas: nLineas,
    origen_biblioteca_id: origenBibliotecaId,
    dest_biblioteca_id: destBibliotecaId,
    modo: "clonar",
  };
}
