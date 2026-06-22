import type { Pool } from "pg";
import { GENEROS_LEY, type LeyGeneroResult, validarLeyGeneroMarcas } from "./ley-genero";
import { leerExcelProveedor, resolverNombreEvento, type SkuStagingRow } from "./excel-proveedor";
import { guardarSkusExcel } from "./evento-sku-staging";
import { getMotorProveedorMeta } from "./proveedores-meta";

const CODIGOS_GENERO_BD: Record<string, string[]> = {
  DAMAS: ["DAMAS", "DAMA"],
  NIÑAS: ["NIÑAS", "NINAS", "NINA", "NIÑA"],
  NIÑOS: ["NIÑOS", "NINOS", "NINO", "NIÑO"],
  CABALLEROS: ["CABALLEROS", "CABALLERO"],
};

export type ProveedorRow = { id: number; codigo: string; nombre: string };

export async function listProveedoresImportacion(pool: Pool): Promise<ProveedorRow[]> {
  const { rows } = await pool.query<{ id: string; codigo: string; nombre: string }>(
    `SELECT id, codigo, nombre FROM proveedor_importacion ORDER BY id`,
  );
  return rows.map((r) => ({ id: Number(r.id), codigo: r.codigo, nombre: r.nombre }));
}

async function proveedorExisteEnBd(pool: Pool, proveedorId: number): Promise<boolean> {
  const { rows } = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM proveedor_importacion WHERE id = $1) AS ok`,
    [proveedorId],
  );
  return rows[0]?.ok === true;
}

async function codigosGeneroEnBd(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ codigo: string }>(`SELECT UPPER(TRIM(codigo)) AS codigo FROM genero`);
  return new Set(rows.map((r) => r.codigo));
}

function leyGeneroExisteEnBd(codigoLey: string, enBd: Set<string>): boolean {
  const variants = CODIGOS_GENERO_BD[codigoLey] ?? [codigoLey];
  return variants.some((v) => enBd.has(v.toUpperCase()));
}

export async function validarLeyGeneroCompleta(
  pool: Pool,
  marcas: string[],
): Promise<LeyGeneroResult> {
  const base = validarLeyGeneroMarcas(marcas);
  const enBd = await codigosGeneroEnBd(pool);
  const faltantesBd = GENEROS_LEY.filter((g) => !leyGeneroExisteEnBd(g, enBd));
  const usados = new Set(Object.values(base.asignaciones));
  const faltantesUsados = [...usados].filter((g) => !leyGeneroExisteEnBd(g, enBd));

  return {
    ...base,
    generos_faltantes_bd: [...new Set([...faltantesBd, ...faltantesUsados])],
    ok: base.ok && faltantesBd.length === 0 && faltantesUsados.length === 0,
  };
}

/** Paridad Streamlit `crear_evento`. */
export async function crearPrecioEvento(
  pool: Pool,
  input: {
    nombre_evento: string;
    nombre_archivo: string;
    vigente_desde: string;
    proveedor_id: number;
    usuario_id?: number | null;
  },
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO precio_evento
       (nombre_evento, nombre_archivo, fecha_vigencia_desde, proveedor_id, usuario_id)
     VALUES ($1, $2, $3::date, $4, $5)
     RETURNING id`,
    [
      input.nombre_evento.trim(),
      input.nombre_archivo,
      input.vigente_desde,
      input.proveedor_id,
      input.usuario_id ?? null,
    ],
  );
  const id = Number(rows[0]?.id);
  if (!id) throw new Error("No se obtuvo id de precio_evento");
  return id;
}

export type CargaEventoInput = {
  proveedor_id: number;
  nombre_evento: string;
  vigente_desde: string;
  archivo: Buffer;
  nombre_archivo: string;
  usuario_id?: number | null;
};

export type CargaEventoOk = {
  ok: true;
  evento_id: number;
  skus_count: number;
  marcas_count: number;
  asignaciones_genero: Record<string, string>;
  marcas: string[];
  skus: SkuStagingRow[];
};

export async function ejecutarPaso0Carga(pool: Pool, input: CargaEventoInput): Promise<
  | CargaEventoOk
  | { ok: false; code: string; error: string; marcas_rechazadas?: string[]; generos_faltantes_bd?: string[] }
> {
  const meta = getMotorProveedorMeta(input.proveedor_id);
  if (!meta) {
    return { ok: false, code: "PROVEEDOR", error: `Proveedor ${input.proveedor_id} no reconocido. Solo 654 (calzado) y 638 (confecciones).` };
  }
  if (!meta.paso0Report) {
    return {
      ok: false,
      code: "PROVEEDOR",
      error: `Paso 0 Report aún no habilitado para proveedor ${meta.id} (${meta.label}). Usá Streamlit Motor o elegí 654 para calzado.`,
    };
  }

  const enBd = await proveedorExisteEnBd(pool, input.proveedor_id);
  if (!enBd) {
    return {
      ok: false,
      code: "PROVEEDOR",
      error: `Proveedor ${input.proveedor_id} no está en proveedor_importacion. Alta en BD antes de importar.`,
    };
  }

  const lectura = leerExcelProveedor(input.archivo, input.nombre_archivo, input.proveedor_id);
  if (lectura.error) {
    return { ok: false, code: "EXCEL", error: lectura.error };
  }

  const ley = await validarLeyGeneroCompleta(pool, lectura.marcas);
  if (!ley.ok) {
    return {
      ok: false,
      code: "LEY_GENERO",
      error: "Ley de género no cumplida",
      marcas_rechazadas: ley.marcas_rechazadas,
      generos_faltantes_bd: ley.generos_faltantes_bd,
    };
  }

  const nombre_evento = resolverNombreEvento(input.nombre_evento, input.nombre_archivo);

  const evento_id = await crearPrecioEvento(pool, {
    nombre_evento,
    nombre_archivo: input.nombre_archivo,
    vigente_desde: input.vigente_desde,
    proveedor_id: input.proveedor_id,
    usuario_id: input.usuario_id,
  });

  await guardarSkusExcel(pool, evento_id, lectura.skus);

  return {
    ok: true,
    evento_id,
    skus_count: lectura.skus.length,
    marcas_count: lectura.marcas.length,
    asignaciones_genero: ley.asignaciones,
    marcas: lectura.marcas,
    skus: lectura.skus,
  };
}
