import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ListadoPdfFila = {
  id_cliente: number;
  cliente: string;
  vendedor: string;
  cadena: string | null;
  marca: string;
  cajas: number;
  nro_factura: string | null;
};

export type ListadoPdfMeta = {
  preventa: string;
  pp_numero: string;
  entidad_label: string;
  quincena_corta: string;
  n_fi: number;
  n_clientes: number;
  /** Días desde publicación PP (logistica_activada_at / created_at) */
  dias_atraso?: number;
  pp_publicado_at?: string | null;
  filtros_label?: string;
};

export type ListadoPdfInput = {
  filas: ListadoPdfFila[];
  meta: ListadoPdfMeta;
};

export type ListadoPivotFila = {
  id_cliente: number | null;
  cliente: string;
  vendedor: string;
  cajas_por_marca: Record<string, number>;
  total: number;
  es_stock?: boolean;
};

export type ListadoPivotGrupo = {
  id_cliente: number | null;
  cliente: string;
  filas: ListadoPivotFila[];
  total_por_marca: Record<string, number>;
  total: number;
  es_stock?: boolean;
};

export type ListadoPivot = {
  marcas: string[];
  grupos: ListadoPivotGrupo[];
  totales_generales: Record<string, number>;
  total_general: number;
};

const normalizar = (valor: string | null | undefined, fallback: string) => String(valor ?? "").trim() || fallback;
const sumar = (destino: Record<string, number>, marca: string, cajas: number) => {
  destino[marca] = (destino[marca] ?? 0) + cajas;
};

/** Ivan: BAZZAR holding ≠ RIMEC remanente depósito — no mezclar */
export function clasificarDestinoListado(fila: ListadoPdfFila): "BAZZAR" | "RIMEC" | "CADENA" {
  const cliente = normalizar(fila.cliente, "");
  const cadena = normalizar(fila.cadena, "");
  const vendedor = normalizar(fila.vendedor, "");
  const blob = `${cadena} ${cliente}`;
  if (/BAZZAR/i.test(blob)) return "BAZZAR";
  if (
    /^RIMEC$/i.test(vendedor) ||
    /^STOCK$/i.test(cliente) ||
    /\bSTOCK\b/i.test(cliente) ||
    /REMANENTE/i.test(blob) ||
    (/RIMEC/i.test(blob) && !/BAZZAR/i.test(blob))
  ) {
    return "RIMEC";
  }
  return "CADENA";
}

function acumularMarcas(filas: ListadoPdfFila[]): { porMarca: Record<string, number>; total: number } {
  const porMarca: Record<string, number> = {};
  let total = 0;
  for (const fila of filas) {
    const marca = normalizar(fila.marca, "Sin marca");
    const cajas = Number(fila.cajas) || 0;
    sumar(porMarca, marca, cajas);
    total += cajas;
  }
  return { porMarca, total };
}

/**
 * Pivote Ivan Hoja1:
 * 1) STOCK · BAZZAR (holding)
 * 2) STOCK · RIMEC (remanente → depósito) — renglón aparte
 * 3) Total STOCK
 * 4) Clientes / cadenas con Total {id}
 */
export function agruparListadoPivot(filas: ListadoPdfFila[]): ListadoPivot {
  const marcas = [...new Set(filas.map((fila) => normalizar(fila.marca, "Sin marca")))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const bazzarFilas = filas.filter((f) => clasificarDestinoListado(f) === "BAZZAR");
  const rimecFilas = filas.filter((f) => clasificarDestinoListado(f) === "RIMEC");
  const cadenaFilas = filas.filter((f) => clasificarDestinoListado(f) === "CADENA");

  const grupos: ListadoPivotGrupo[] = [];

  const bazzar = acumularMarcas(bazzarFilas);
  const rimec = acumularMarcas(rimecFilas);
  if (bazzar.total > 0 || rimec.total > 0) {
    const stockFilas: ListadoPivotFila[] = [];
    const stockTotales: Record<string, number> = {};
    let stockTotal = 0;

    if (bazzar.total > 0) {
      stockFilas.push({
        id_cliente: 276,
        cliente: "STOCK",
        vendedor: "BAZZAR",
        cajas_por_marca: bazzar.porMarca,
        total: bazzar.total,
        es_stock: true,
      });
      for (const [m, c] of Object.entries(bazzar.porMarca)) sumar(stockTotales, m, c);
      stockTotal += bazzar.total;
    }
    if (rimec.total > 0) {
      stockFilas.push({
        id_cliente: null,
        cliente: "",
        vendedor: "RIMEC",
        cajas_por_marca: rimec.porMarca,
        total: rimec.total,
        es_stock: true,
      });
      for (const [m, c] of Object.entries(rimec.porMarca)) sumar(stockTotales, m, c);
      stockTotal += rimec.total;
    }

    grupos.push({
      id_cliente: 276,
      cliente: "STOCK",
      filas: stockFilas,
      total_por_marca: stockTotales,
      total: stockTotal,
      es_stock: true,
    });
  }

  const porCliente = new Map<number, ListadoPivotGrupo>();
  for (const fila of cadenaFilas) {
    const marca = normalizar(fila.marca, "Sin marca");
    const cajas = Number(fila.cajas) || 0;
    const idCliente = Number(fila.id_cliente);
    const cliente = normalizar(fila.cliente, `Cliente ${idCliente}`);
    const vendedor = normalizar(fila.vendedor, "—");
    let grupo = porCliente.get(idCliente);
    if (!grupo) {
      grupo = { id_cliente: idCliente, cliente, filas: [], total_por_marca: {}, total: 0 };
      porCliente.set(idCliente, grupo);
    }
    let pivotFila = grupo.filas.find((item) => item.vendedor === vendedor);
    if (!pivotFila) {
      pivotFila = { id_cliente: idCliente, cliente, vendedor, cajas_por_marca: {}, total: 0 };
      grupo.filas.push(pivotFila);
    }
    sumar(pivotFila.cajas_por_marca, marca, cajas);
    pivotFila.total += cajas;
    sumar(grupo.total_por_marca, marca, cajas);
    grupo.total += cajas;
  }

  grupos.push(
    ...[...porCliente.values()].sort(
      (a, b) => (a.id_cliente ?? 0) - (b.id_cliente ?? 0) || a.cliente.localeCompare(b.cliente, "es"),
    ),
  );

  const totalesGenerales: Record<string, number> = {};
  let totalGeneral = 0;
  for (const grupo of grupos) {
    totalGeneral += grupo.total;
    for (const [marca, cajas] of Object.entries(grupo.total_por_marca)) sumar(totalesGenerales, marca, cajas);
  }

  return { marcas, grupos, totales_generales: totalesGenerales, total_general: totalGeneral };
}

/** Paleta NIIF impresión — `.claude/.../niif_estandar_visual.md` · #002B4E */
const AZUL_RIMEC = rgb(0, 0.169, 0.306); // #002B4E
const CELESTE_FONDO = rgb(0.945, 0.961, 0.976); // #f1f5f9
const AZUL_SUAVE = rgb(0.882, 0.929, 0.988); // blue-100 — visible en tinta
const AMBAR_SUAVE = rgb(0.996, 0.953, 0.78); // amber-100
const GRIS_SUBTOTAL = rgb(0.867, 0.891, 0.922); // slate-200 — subtotal legible al imprimir
const GRIS_ZEBRA = rgb(0.973, 0.98, 0.988); // fila alterna
const BORDE = rgb(0.278, 0.333, 0.412); // slate-600 — borde para impresión
const BORDE_OSCURO = rgb(0.059, 0.09, 0.165); // slate-900 — marco tabla
const BLANCO = rgb(1, 1, 1);
const TEXTO = rgb(0.059, 0.09, 0.165); // #0f172a slate-900
const TEXTO_SEC = rgb(0.278, 0.333, 0.412); // #475569 slate-600

type AlineacionCelda = "izq" | "centro" | "der";

function esFondoOscuro(fondo: ReturnType<typeof rgb> | undefined): boolean {
  if (!fondo) return false;
  // pdf-lib Color: { type:'RGB', red, green, blue }
  const r = (fondo as { red?: number }).red ?? 1;
  const g = (fondo as { green?: number }).green ?? 1;
  const b = (fondo as { blue?: number }).blue ?? 1;
  const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminancia < 0.45;
}

function textoAjustado(font: PDFFont, valor: string, ancho: number, size: number): string {
  if (font.widthOfTextAtSize(valor, size) <= ancho) return valor;
  let texto = valor;
  while (texto.length > 1 && font.widthOfTextAtSize(`${texto}…`, size) > ancho) texto = texto.slice(0, -1);
  return `${texto}…`;
}

function dibujarCelda(
  pagina: PDFPage,
  font: PDFFont,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  size: number,
  opciones: {
    color?: ReturnType<typeof rgb>;
    fondo?: ReturnType<typeof rgb>;
    negrita?: PDFFont;
    alineacion?: AlineacionCelda;
    bordeAncho?: number;
    bordeColor?: ReturnType<typeof rgb>;
  } = {},
) {
  const fondo = opciones.fondo ?? BLANCO;
  pagina.drawRectangle({ x, y: y - alto, width: ancho, height: alto, color: fondo });
  pagina.drawRectangle({
    x,
    y: y - alto,
    width: ancho,
    height: alto,
    borderColor: opciones.bordeColor ?? BORDE,
    borderWidth: opciones.bordeAncho ?? 0.7,
  });
  const fuente = opciones.negrita ?? font;
  const pad = 3;
  const contenido = textoAjustado(fuente, texto, Math.max(ancho - pad * 2, 1), size);
  const textoAncho = fuente.widthOfTextAtSize(contenido, size);
  const alineacion = opciones.alineacion ?? "izq";
  let textoX = x + pad;
  if (alineacion === "centro") textoX = x + (ancho - textoAncho) / 2;
  if (alineacion === "der") textoX = x + ancho - textoAncho - pad;
  // NIIF: fondo navy → siempre blanco (nunca negro/slate sobre #002B4E)
  const colorTexto = esFondoOscuro(fondo) ? BLANCO : (opciones.color ?? TEXTO);
  pagina.drawText(contenido, {
    x: Math.max(textoX, x + 1),
    y: y - alto + (alto - size) / 2 + 1.2,
    size,
    font: fuente,
    color: colorTexto,
  });
}

export async function buildListadoClientesPdf(input: ListadoPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pivot = agruparListadoPivot(input.filas);
  const anchoPagina = 841.89;
  const altoPagina = 595.28;
  const margen = 18;
  const anchoTabla = anchoPagina - margen * 2;
  const anchoId = 44;
  const anchoCliente = 148;
  const anchoVendedor = 100;
  const anchoTotal = 52;
  const anchoMarca =
    (anchoTabla - anchoId - anchoCliente - anchoVendedor - anchoTotal) / Math.max(pivot.marcas.length, 1);
  const altoFila = 16;
  const altoHeader = 20;
  const yTablaInicial = altoPagina - 98;
  let pagina!: PDFPage;
  let y = yTablaInicial;
  let paginaNumero = 0;
  let filaIdx = 0;
  let yTablaTop = yTablaInicial;

  const anchosColumnas = () => [
    anchoId,
    anchoCliente,
    anchoVendedor,
    ...pivot.marcas.map(() => anchoMarca),
    anchoTotal,
  ];

  const alineacionColumna = (i: number): AlineacionCelda => {
    if (i === 0) return "centro"; // id cliente
    if (i >= 3) return "centro"; // marcas + total cajas
    return "izq";
  };

  const dibujarMarcoTabla = (yBottom: number) => {
    const alto = yTablaTop - yBottom;
    if (alto <= 0) return;
    pagina.drawRectangle({
      x: margen,
      y: yBottom,
      width: anchoTabla,
      height: alto,
      borderColor: BORDE_OSCURO,
      borderWidth: 1.2,
    });
  };

  const encabezadoTabla = () => {
    const columnas = ["CLIENTE", "NOMBRE DEL CLIENTE", "NOMBRE VENDEDOR", ...pivot.marcas, "Total"];
    const anchos = anchosColumnas();
    yTablaTop = y;
    let x = margen;
    for (let i = 0; i < columnas.length; i += 1) {
      dibujarCelda(pagina, regular, columnas[i], x, y, anchos[i], altoHeader, 6.2, {
        fondo: AZUL_RIMEC,
        color: BLANCO,
        negrita: bold,
        alineacion: alineacionColumna(i),
        bordeAncho: 0.85,
        bordeColor: BORDE_OSCURO,
      });
      x += anchos[i];
    }
    y -= altoHeader;
  };

  const nuevaPagina = () => {
    if (paginaNumero > 0) dibujarMarcoTabla(y);
    pagina = pdf.addPage([anchoPagina, altoPagina]);
    paginaNumero += 1;
    // Impresión: fondo blanco (ahorra tinta); cabecera NIIF en color
    pagina.drawRectangle({
      x: 0,
      y: 0,
      width: anchoPagina,
      height: altoPagina,
      color: BLANCO,
    });
    pagina.drawRectangle({
      x: 0,
      y: altoPagina - 58,
      width: anchoPagina,
      height: 58,
      color: CELESTE_FONDO,
    });
    pagina.drawText(`LISTADO CLIENTES · PRG & STOCK ${input.meta.preventa}`, {
      x: margen,
      y: altoPagina - 28,
      size: 14,
      font: bold,
      color: AZUL_RIMEC,
    });
    const subtitulo = [
      input.meta.pp_numero,
      input.meta.entidad_label,
      input.meta.quincena_corta,
      `N FI: ${input.meta.n_fi}`,
      `N clientes: ${input.meta.n_clientes}`,
      input.meta.dias_atraso != null ? `Atraso: ${input.meta.dias_atraso} d` : "",
      input.meta.pp_publicado_at ? `Pub. PP: ${input.meta.pp_publicado_at}` : "",
      "BAZZAR=holding · RIMEC=remanente depósito",
    ]
      .filter(Boolean)
      .join("  |  ");
    pagina.drawText(subtitulo, { x: margen, y: altoPagina - 44, size: 7.2, font: regular, color: TEXTO_SEC });
    if (input.meta.filtros_label) {
      pagina.drawText(`Filtros: ${input.meta.filtros_label}`, {
        x: margen,
        y: altoPagina - 56,
        size: 6.8,
        font: regular,
        color: TEXTO_SEC,
      });
    }
    pagina.drawText("NIIF · RIMEC Nexus", {
      x: margen,
      y: 12,
      size: 7,
      font: regular,
      color: TEXTO_SEC,
    });
    pagina.drawText(`Página ${paginaNumero}`, {
      x: anchoPagina - margen - 48,
      y: 12,
      size: 7,
      font: regular,
      color: TEXTO_SEC,
    });
    y = yTablaInicial;
    encabezadoTabla();
  };

  const asegurarEspacio = (filasNecesarias: number) => {
    if (y - filasNecesarias * altoFila < 28) nuevaPagina();
  };

  const dibujarFila = (
    fila: ListadoPivotFila,
    opciones: {
      fondo?: ReturnType<typeof rgb>;
      negrita?: boolean;
      etiquetaId?: string;
      etiquetaCliente?: string;
      /** Forzar color de texto (NIIF: blanco sobre navy) */
      color?: ReturnType<typeof rgb>;
      zebra?: boolean;
    } = {},
  ) => {
    asegurarEspacio(1);
    const valores = [
      opciones.etiquetaId ?? (fila.id_cliente == null ? "" : String(fila.id_cliente)),
      opciones.etiquetaCliente ?? fila.cliente,
      fila.vendedor,
      ...pivot.marcas.map((marca) => {
        const v = fila.cajas_por_marca[marca];
        return v == null || v === 0 ? "" : String(v);
      }),
      fila.total ? String(fila.total) : "",
    ];
    const anchos = anchosColumnas();
    let fondo = opciones.fondo;
    if (!fondo && opciones.zebra !== false && filaIdx % 2 === 1) fondo = GRIS_ZEBRA;
    let x = margen;
    for (let i = 0; i < valores.length; i += 1) {
      dibujarCelda(pagina, regular, valores[i], x, y, anchos[i], altoFila, 7, {
        fondo,
        color: opciones.color,
        negrita: opciones.negrita ? bold : undefined,
        alineacion: alineacionColumna(i),
        bordeAncho: 0.65,
      });
      x += anchos[i];
    }
    y -= altoFila;
    filaIdx += 1;
  };

  nuevaPagina();
  for (const grupo of pivot.grupos) {
    asegurarEspacio(grupo.filas.length + 1);
    for (const fila of grupo.filas) {
      const fondo =
        fila.vendedor === "BAZZAR" ? AZUL_SUAVE : fila.vendedor === "RIMEC" ? AMBAR_SUAVE : undefined;
      dibujarFila(fila, {
        fondo,
        negrita: Boolean(grupo.es_stock),
        etiquetaId: fila.vendedor === "RIMEC" ? "" : undefined,
        etiquetaCliente: fila.vendedor === "RIMEC" ? "" : undefined,
        color: TEXTO,
        zebra: !fondo,
      });
    }
    // Subtotal impresión: slate-200 + negrita + cajas centradas
    dibujarFila(
      {
        id_cliente: grupo.id_cliente,
        cliente: grupo.es_stock ? "Total STOCK" : `Total ${grupo.id_cliente}`,
        vendedor: "",
        cajas_por_marca: grupo.total_por_marca,
        total: grupo.total,
      },
      {
        fondo: GRIS_SUBTOTAL,
        negrita: true,
        color: TEXTO,
        etiquetaId: "",
        etiquetaCliente: grupo.es_stock ? "Total STOCK" : `Total ${grupo.id_cliente}`,
        zebra: false,
      },
    );
  }

  // Total general NIIF: navy #002B4E + blanco forzado
  dibujarFila(
    {
      id_cliente: null,
      cliente: "Total general",
      vendedor: "",
      cajas_por_marca: pivot.totales_generales,
      total: pivot.total_general,
    },
    {
      fondo: AZUL_RIMEC,
      negrita: true,
      color: BLANCO,
      etiquetaId: "",
      etiquetaCliente: "Total general",
      zebra: false,
    },
  );

  dibujarMarcoTabla(y);
  return pdf.save();
}
