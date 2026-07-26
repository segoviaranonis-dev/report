/**
 * Decoder COD.GRUPO (10 dígitos Carlos) → propuestas pilares.
 * Fuente de verdad = dígitos; labels Excel = control (conflicto → gana dígito).
 */

export type CodGrupoRamo = "CALZADOS" | "CONFECCIONES";

export type CodGrupoDestino = "genero" | "tipo_1" | "estilo" | "cadena" | "marca";

export type CodGrupoDecoded = {
  raw: string;
  ok: boolean;
  marcaKey: string;
  pos23: string;
  pos45: string;
  pos67: string;
  pos89: string;
  ramo: CodGrupoRamo;
  marcaId: number | null;
  marcaLabelEsperado: string | null;
  generoCodigo: string | null;
  tipo1Label: string | null;
  estiloLabel: string | null;
  cadenaComercial: string | null;
  conflictos: string[];
};

/** Primeros 2 dígitos → id_marca (matriz holding). */
export const GRUPO_DIGITO_MARCA: Record<string, { id_marca: number; label: string }> = {
  "01": { id_marca: 1, label: "BEIRA RIO" },
  "02": { id_marca: 2, label: "VIZZANO" },
  "03": { id_marca: 3, label: "MODARE" },
  "04": { id_marca: 4, label: "MOLECA" },
  "05": { id_marca: 5, label: "MOLEKINHA" },
  "06": { id_marca: 6, label: "MOLEKINHO" },
  "07": { id_marca: 7, label: "ACTVITTA" },
  "08": { id_marca: 8, label: "BR SPORT" },
  "09": { id_marca: 9, label: "CHINELO" },
  "10": { id_marca: 10, label: "KYLY" },
  "11": { id_marca: 11, label: "MILON" },
  "12": { id_marca: 12, label: "AMORA" },
  "13": { id_marca: 13, label: "LEMON" },
  "14": { id_marca: 14, label: "NANAI" },
  "15": { id_marca: 15, label: "PIPA" },
};

const CONF_MARCAS = new Set(["10", "11", "12", "13", "14", "15"]);

/** Confecciones · dígitos 03–04 → género pilares. */
const CONF_D23_GENERO: Record<string, string> = {
  "01": "NINAS",
  "02": "NINOS",
};

/** Confecciones · dígitos 05–06 → tipo_1 (AB-CR = temporada). */
const CONF_D45_TIPO1: Record<string, string> = {
  "01": "INVIERNO",
  "02": "VERANO",
};

/** Confecciones · dígitos 07–08 → estilo o cadena. */
const CONF_D67: Record<string, { destino: "estilo" | "cadena"; label: string }> = {
  "01": { destino: "estilo", label: "ACTUAL" },
  "02": { destino: "estilo", label: "ANTERIOR" },
  "03": { destino: "cadena", label: "PROMOCIONAL" },
  "04": { destino: "cadena", label: "LIQUIDACION" },
};

/** Calzado · dígitos 03–04 → tipo_1 (AB-CR). */
const CALZ_D23_TIPO1: Record<string, string> = {
  "01": "ABIERTO",
  "02": "CERRADO",
  "03": "CARTERAS",
  "04": "MEDIAS",
  "05": "PRENDAS",
};

/** Calzado · dígitos 05–06 → cadena Tipo. */
const CALZ_D45_CADENA: Record<string, string> = {
  "01": "REGULAR",
  "02": "PROMOCIONAL",
  "04": "LIQUIDACION",
  "06": "COMUN",
};

/** Calzado · dígitos 07–08 → estilo (estructural). */
const CALZ_D67_ESTILO: Record<string, string> = {
  "00": "OTROS",
  "01": "BOTAS",
  "90": "OTROS",
};

/** Calzado · PRENDAS · d67 género. */
const CALZ_D67_GENERO: Record<string, string> = {
  "01": "DAMAS",
  "02": "CABALLEROS",
};

export function normGrupoLabel(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/**
 * Normaliza COD.GRUPO a 10 dígitos.
 * "10" / "01" = solo clave marca (no pad a 10 — eso rompería d01).
 */
export function normalizeCodGrupo(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "")
    .trim()
    .replace(/\.0$/, "")
    .replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return digits;
  if (digits.length <= 2) return null;
  if (digits.length < 10) return digits.padStart(10, "0");
  return digits.slice(0, 10);
}

export function marcaKeyFromCodGrupo(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "")
    .trim()
    .replace(/\.0$/, "")
    .replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 2) return digits.padStart(2, "0");
  const g = normalizeCodGrupo(raw);
  return g ? g.slice(0, 2) : null;
}

export function marcaIdFromCodGrupo(raw: string | null | undefined): number | null {
  const key = marcaKeyFromCodGrupo(raw);
  if (!key) return null;
  return GRUPO_DIGITO_MARCA[key]?.id_marca ?? null;
}

export type DigitoMapaRow = {
  ramo: CodGrupoRamo;
  posicion: "23" | "45" | "67";
  codigo: string;
  destino: CodGrupoDestino;
  label_canonico: string;
};

/** Seed canónico (migración + runtime). */
export function seedGrupoDigitoMapa(): DigitoMapaRow[] {
  const rows: DigitoMapaRow[] = [];
  for (const [codigo, label] of Object.entries(CONF_D23_GENERO)) {
    rows.push({ ramo: "CONFECCIONES", posicion: "23", codigo, destino: "genero", label_canonico: label });
  }
  for (const [codigo, label] of Object.entries(CONF_D45_TIPO1)) {
    rows.push({ ramo: "CONFECCIONES", posicion: "45", codigo, destino: "tipo_1", label_canonico: label });
  }
  for (const [codigo, v] of Object.entries(CONF_D67)) {
    rows.push({
      ramo: "CONFECCIONES",
      posicion: "67",
      codigo,
      destino: v.destino,
      label_canonico: v.label,
    });
  }
  for (const [codigo, label] of Object.entries(CALZ_D23_TIPO1)) {
    rows.push({ ramo: "CALZADOS", posicion: "23", codigo, destino: "tipo_1", label_canonico: label });
  }
  for (const [codigo, label] of Object.entries(CALZ_D45_CADENA)) {
    rows.push({ ramo: "CALZADOS", posicion: "45", codigo, destino: "cadena", label_canonico: label });
  }
  for (const [codigo, label] of Object.entries(CALZ_D67_ESTILO)) {
    rows.push({ ramo: "CALZADOS", posicion: "67", codigo, destino: "estilo", label_canonico: label });
  }
  for (const [codigo, label] of Object.entries(CALZ_D67_GENERO)) {
    rows.push({ ramo: "CALZADOS", posicion: "67", codigo, destino: "genero", label_canonico: label });
  }
  return rows;
}

/**
 * Decodifica COD.GRUPO.
 * labelsExcel opcionales para detectar conflictos (dígito gana).
 */
export function decodeCodGrupo(
  raw: string | null | undefined,
  labelsExcel?: {
    marca?: string | null;
    tipo0?: string | null;
    tipo1?: string | null;
    tipo2?: string | null;
    cadena?: string | null;
  },
): CodGrupoDecoded {
  const empty: CodGrupoDecoded = {
    raw: String(raw ?? ""),
    ok: false,
    marcaKey: "",
    pos23: "",
    pos45: "",
    pos67: "",
    pos89: "",
    ramo: "CALZADOS",
    marcaId: null,
    marcaLabelEsperado: null,
    generoCodigo: null,
    tipo1Label: null,
    estiloLabel: null,
    cadenaComercial: null,
    conflictos: [],
  };

  const g = normalizeCodGrupo(raw);
  if (!g || g.length !== 10) {
    empty.conflictos.push("COD.GRUPO inválido (se esperan 10 dígitos)");
    return empty;
  }

  const marcaKey = g.slice(0, 2);
  const pos23 = g.slice(2, 4);
  const pos45 = g.slice(4, 6);
  const pos67 = g.slice(6, 8);
  const pos89 = g.slice(8, 10);
  const ramo: CodGrupoRamo = CONF_MARCAS.has(marcaKey) ? "CONFECCIONES" : "CALZADOS";
  const marcaMeta = GRUPO_DIGITO_MARCA[marcaKey] ?? null;
  const conflictos: string[] = [];

  let generoCodigo: string | null = null;
  let tipo1Label: string | null = null;
  let estiloLabel: string | null = null;
  let cadenaComercial: string | null = "REGULAR";

  if (ramo === "CONFECCIONES") {
    generoCodigo = CONF_D23_GENERO[pos23] ?? null;
    tipo1Label = CONF_D45_TIPO1[pos45] ?? null;
    const d67 = CONF_D67[pos67];
    if (d67?.destino === "estilo") estiloLabel = d67.label;
    if (d67?.destino === "cadena") cadenaComercial = d67.label;

    const t0 = normGrupoLabel(labelsExcel?.tipo0);
    if (t0 && generoCodigo) {
      const expect =
        generoCodigo === "NINAS" ? ["FEM", "FEMENINO"] : ["MASC", "MASCULINO"];
      if (!expect.includes(t0)) conflictos.push(`TIPO0=${t0} ≠ d23→${generoCodigo}`);
    }
    const t1 = normGrupoLabel(labelsExcel?.tipo1);
    if (t1 && tipo1Label && t1 !== tipo1Label) {
      conflictos.push(`TIPO1=${t1} ≠ d45→${tipo1Label}`);
    }
    const t2 = normGrupoLabel(labelsExcel?.tipo2);
    if (t2 && estiloLabel && t2 !== estiloLabel && !["NADA", ""].includes(t2)) {
      if (t2 !== "LIQUIDACION" && t2 !== "PROMOCIONAL") {
        conflictos.push(`TIPO2=${t2} ≠ d67→${estiloLabel}`);
      }
    }
  } else {
    tipo1Label = CALZ_D23_TIPO1[pos23] ?? null;
    cadenaComercial = CALZ_D45_CADENA[pos45] ?? "REGULAR";
    if (tipo1Label === "PRENDAS") {
      generoCodigo = CALZ_D67_GENERO[pos67] ?? null;
      estiloLabel = "OTROS";
    } else {
      estiloLabel = CALZ_D67_ESTILO[pos67] ?? (pos67 === "02" ? "OTROS" : null);
      if (pos67 === "01" && tipo1Label !== "PRENDAS") estiloLabel = "BOTAS";
      if (pos67 === "00") estiloLabel = "OTROS";
    }

    const t0 = normGrupoLabel(labelsExcel?.tipo0);
    if (t0 && tipo1Label && t0 !== tipo1Label) {
      conflictos.push(`TIPO0=${t0} ≠ d23→${tipo1Label}`);
    }
  }

  const marcaExcel = normGrupoLabel(labelsExcel?.marca);
  if (marcaExcel && marcaMeta && !marcaExcel.includes(marcaMeta.label.split(" ")[0]!)) {
    const a = marcaExcel.replace(/\s+/g, "");
    const b = marcaMeta.label.replace(/\s+/g, "");
    if (a !== b && !a.includes(b) && !b.includes(a)) {
      conflictos.push(`MARCA=${marcaExcel} ≠ d01→${marcaMeta.label}`);
    }
  }

  const cadenaExcel = normGrupoLabel(labelsExcel?.cadena);
  if (
    cadenaExcel &&
    cadenaComercial &&
    cadenaExcel !== cadenaComercial &&
    !(cadenaExcel === "NORMAL" && cadenaComercial === "REGULAR")
  ) {
    conflictos.push(`cadena=${cadenaExcel} ≠ dígitos→${cadenaComercial}`);
  }

  return {
    raw: g,
    ok: true,
    marcaKey,
    pos23,
    pos45,
    pos67,
    pos89,
    ramo,
    marcaId: marcaMeta?.id_marca ?? null,
    marcaLabelEsperado: marcaMeta?.label ?? null,
    generoCodigo,
    tipo1Label,
    estiloLabel,
    cadenaComercial,
    conflictos,
  };
}
