/** Espejo bazzar-csv-ente-map.ts para CLI */

export const CSV_FILENAME_PREFIX_ENTE = {
  sdfm: "Fernando",
  sdsm: "San Martin",
  sdpl: "Palma",
};

export const CSV_FILENAME_REGEX = /^sd(fm|sm|pl)(\d+)\.(csv|xlsx|txt)$/i;

export const ENTe_CLIENTE_IDS = {
  Fernando: { adultos: 2100, ninos: 2900 },
  "San Martin": { adultos: 2400, ninos: 2700 },
  Palma: { adultos: 3100, ninos: 3200 },
};

export const PALMA_TIENDA_UNICA = {
  cliente_id: 3100,
  caja_tablet: "/tablet-bazzar/3100",
  ninos_operativo: false,
};

export function buildDepositMapForEnte(ente) {
  const ids = ENTe_CLIENTE_IDS[ente];

  if (ente === "Palma") {
    const cid = PALMA_TIENDA_UNICA.cliente_id;
    return [
      { col: "S00_D1", cliente_id: cid, tabla: `deposito_1_${cid}_tienda`, ente, segmento: "Adultos", segmento_marca: "adultos", categoria: "tienda" },
      { col: "S00_D2", cliente_id: cid, tabla: `deposito_2_${cid}_guardado`, ente, segmento: "Adultos", segmento_marca: "adultos", categoria: "guardado" },
      { col: "S00_NINHOS", cliente_id: cid, tabla: `deposito_1_${cid}_tienda`, ente, segmento: "Niños", segmento_marca: "ninos", categoria: "tienda" },
    ];
  }

  return [
    { col: "S00_D1", cliente_id: ids.adultos, tabla: `deposito_1_${ids.adultos}_tienda`, ente, segmento: "Adultos", segmento_marca: "adultos", categoria: "tienda" },
    { col: "S00_D2", cliente_id: ids.adultos, tabla: `deposito_2_${ids.adultos}_guardado`, ente, segmento: "Adultos", segmento_marca: "adultos", categoria: "guardado" },
    { col: "S00_NINHOS", cliente_id: ids.ninos, tabla: `deposito_1_${ids.ninos}_tienda`, ente, segmento: "Niños", segmento_marca: "ninos", categoria: "tienda" },
  ];
}

export function parseBazzarCsvFilename(filename) {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const m = base.match(CSV_FILENAME_REGEX);
  if (!m) {
    return {
      ok: false,
      reason: "Nombre esperado: sdfm####.csv · sdsm####.csv · sdpl####.csv",
    };
  }
  const prefix = `sd${m[1].toLowerCase()}`;
  const ente = CSV_FILENAME_PREFIX_ENTE[prefix];
  if (!ente) return { ok: false, reason: `Prefijo ${prefix} no reconocido` };
  return { ok: true, prefix, ente, lote: m[2], ext: m[3].toLowerCase() };
}
