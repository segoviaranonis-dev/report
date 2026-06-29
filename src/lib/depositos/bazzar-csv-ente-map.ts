/**
 * Mapa export POS Bazzar por ente — prefijo de nombre de archivo.
 * Columnas stock idénticas en los 3 entes: S00_D1 · S00_D2 · S00_NINHOS.
 * La ente NO viene en el header; viene en el nombre: sdfm · sdsm · sdpl.
 */

import type { CategoriaDeposito } from "./depositos-config";
import { nombreTablaDeposito } from "./depositos-config";

export type EnteBazzar = "Fernando" | "San Martin" | "Palma";

export type CsvStockColumn = "S00_D1" | "S00_D2" | "S00_NINHOS";

export type SegmentoMarca = "adultos" | "ninos";

export type BazzarCsvEnteTarget = {
  csvColumn: CsvStockColumn;
  cliente_id: number;
  ente: EnteBazzar;
  /** Segmento físico tienda (Fernando/SM) o hint columna CSV (Palma única). */
  segmento: "Adultos" | "Niños";
  /** Qué universo de marcas valida esta columna — ver MATRIZ 2.3.6.4. */
  segmento_marca: SegmentoMarca;
  categoria: CategoriaDeposito;
  tabla: string;
};

/** Palma = 1 local · 1 caja tablet · 1 depósito tienda (3100). Sin 3200 operativo. */
export const PALMA_TIENDA_UNICA = {
  cliente_id: 3100,
  caja_tablet: "/tablet-bazzar/3100",
  deposito_tienda: "deposito_1_3100_tienda",
  ninos_cliente_id_legacy: 3200,
  ninos_operativo: false,
} as const;

/** Prefijo archivo (minúsculas, sin número) → ente. */
export const CSV_FILENAME_PREFIX_ENTE: Record<string, EnteBazzar> = {
  sdfm: "Fernando",
  sdsm: "San Martin",
  sdpl: "Palma",
};

/** Patrón canónico: sd(fm|sm|pl) + dígitos lote + extensión. */
export const CSV_FILENAME_REGEX = /^sd(fm|sm|pl)(\d+)\.(csv|xlsx|txt)$/i;

/** cliente_id adultos/niños por ente (matriz holding). */
export const ENTe_CLIENTE_IDS: Record<
  EnteBazzar,
  { adultos: number; ninos: number }
> = {
  Fernando: { adultos: 2100, ninos: 2900 },
  "San Martin": { adultos: 2400, ninos: 2700 },
  Palma: { adultos: 3100, ninos: 3200 },
};

export function buildDepositMapForEnte(ente: EnteBazzar): BazzarCsvEnteTarget[] {
  const ids = ENTe_CLIENTE_IDS[ente];

  if (ente === "Palma") {
    const cid = PALMA_TIENDA_UNICA.cliente_id;
    return [
      {
        csvColumn: "S00_D1",
        cliente_id: cid,
        ente,
        segmento: "Adultos",
        segmento_marca: "adultos",
        categoria: "tienda",
        tabla: nombreTablaDeposito(1, cid, "tienda"),
      },
      {
        csvColumn: "S00_D2",
        cliente_id: cid,
        ente,
        segmento: "Adultos",
        segmento_marca: "adultos",
        categoria: "guardado",
        tabla: nombreTablaDeposito(2, cid, "guardado"),
      },
      {
        csvColumn: "S00_NINHOS",
        cliente_id: cid,
        ente,
        segmento: "Niños",
        segmento_marca: "ninos",
        categoria: "tienda",
        tabla: nombreTablaDeposito(1, cid, "tienda"),
      },
    ];
  }

  return [
    {
      csvColumn: "S00_D1",
      cliente_id: ids.adultos,
      ente,
      segmento: "Adultos",
      segmento_marca: "adultos",
      categoria: "tienda",
      tabla: nombreTablaDeposito(1, ids.adultos, "tienda"),
    },
    {
      csvColumn: "S00_D2",
      cliente_id: ids.adultos,
      ente,
      segmento: "Adultos",
      segmento_marca: "adultos",
      categoria: "guardado",
      tabla: nombreTablaDeposito(2, ids.adultos, "guardado"),
    },
    {
      csvColumn: "S00_NINHOS",
      cliente_id: ids.ninos,
      ente,
      segmento: "Niños",
      segmento_marca: "ninos",
      categoria: "tienda",
      tabla: nombreTablaDeposito(1, ids.ninos, "tienda"),
    },
  ];
}

export type CsvFilenameParse =
  | { ok: true; prefix: string; ente: EnteBazzar; lote: string; ext: string }
  | { ok: false; reason: string };

export function parseBazzarCsvFilename(filename: string): CsvFilenameParse {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const m = base.match(CSV_FILENAME_REGEX);
  if (!m) {
    return {
      ok: false,
      reason:
        "Nombre esperado: sdfm####.csv · sdsm####.csv · sdpl####.csv (ente + lote POS)",
    };
  }
  const prefix = `sd${m[1].toLowerCase()}`;
  const ente = CSV_FILENAME_PREFIX_ENTE[prefix];
  if (!ente) {
    return { ok: false, reason: `Prefijo ${prefix} no reconocido` };
  }
  return { ok: true, prefix, ente, lote: m[2], ext: m[3].toLowerCase() };
}

/** @deprecated usar buildDepositMapForEnte("Fernando") */
export const FERNANDO_SDFM_DEPOSIT_MAP = buildDepositMapForEnte("Fernando");
