/** Reclamos Guido · hoja «Situacion Comentarios» · Excel 08 SF AL 01/08/2026 · 2.3.1.50.30 */

export type ReclamoGuidoEstado = "abierto" | "en_curso" | "cerrado";

export type ReclamoGuido = {
  id: number;
  concepto: string;
  textoGuido: string;
  captura?: string;
  reglaCanon: string;
  nexusHoy: string;
  respuesta: string;
  accion: string;
  estado: ReclamoGuidoEstado;
};

export const RECLAMOS_GUIDO_0308: ReclamoGuido[] = [
  {
    id: 1,
    concepto: "SALDO DE CLIENTES",
    textoGuido:
      "Tomar SALDO CLIENTES DETALLADO AL 03-08; sumar por cuota según plazo de factura; solo clientes OK; vencimiento hasta último día hábil del mes.",
    captura: "image2.png · UI «explosión cuotas pendiente»",
    reglaCanon: "G4 · saldo_cli = {OK} × bucket M (ago-26)",
    nexusHoy:
      "Parser suma stock total TXT (~6.817M Gs) sin tipo cobro ni explosión de cuotas.",
    respuesta:
      "Guido tiene razón: la fila es proyección de cuotas OK del mes, no saldo bruto de corte. El motor existe en cuadro_vencimientos_html.py; falta cablearlo al pipeline.",
    accion: "Ola 2: explotar_cuotas → T14 sf_proyeccion_cuota → celda Sit Fin.",
    estado: "en_curso",
  },
  {
    id: 2,
    concepto: "MERCADERÍAS A ENTREGAR",
    textoGuido:
      "No PV y PROG. Tomar saldo detallado; facturas sin fecha entrega en el TXT.",
    captura:
      "image3.png · image4.png — cliente 910, facturas 9124771/9125426 sin FECHA ENTREGA",
    reglaCanon: "G7 · fila A ENTREGAR · operación real sin Fecha_Entrega",
    nexusHoy:
      "Molecular mercaderia:{mes} = mismo nodo que pv:{mes} desde PV Y PROG.txt (~5.825M ref).",
    respuesta:
      "Correcto: mercadería viene del saldo detallado (sin fecha entrega), no del universo PV/PROG. Retiramos ese atajo.",
    accion: "build_mercaderia desde saldo det + G7; enriquecer parser con Fecha_Entrega.",
    estado: "en_curso",
  },
  {
    id: 3,
    concepto: "VENCIDOS A 30 DÍAS",
    textoGuido:
      "Solo OK + Luisito, 1–30 días; clientes 1323 y 2048 (SALEMMA) → difícil cobro, no aquí.",
    captura: "image5.png — códigos 1323/2048 en vencidos 30",
    reglaCanon: "venc30 = {OK, LUISITO} × bucket M-1 (jul-26)",
    nexusHoy:
      "aging v30 AUTO = Dias_Vencido 1–30 sin filtro tipo (~1.644M Gs); SALEMMA entra por error.",
    respuesta:
      "De acuerdo: vencidos 30 son cuotas OK/Luisito del mes anterior, no aging ERP crudo. SALEMMA va a DIF.COBRO.",
    accion: "Reemplazar aging crudo por cuota + clientes.xlsx; excluir SALEMMA/DIFICIL.",
    estado: "abierto",
  },
  {
    id: 4,
    concepto: "VENCIDOS A 60 DÍAS",
    textoGuido: "Igual que vencidos 30 pero 31–60 días, OK + Luisito.",
    reglaCanon: "venc60 = {OK, LUISITO} × bucket M-2",
    nexusHoy: "Misma brecha: Dias_Vencido 31–60 (~197M Gs) sin tipo cobro.",
    respuesta: "Misma lógica que punto 3 con bucket M-2.",
    accion: "Unificar fix v30/v60 en motor cuotas T14.",
    estado: "abierto",
  },
  {
    id: 5,
    concepto: "PV Y PROG A COBRAR",
    textoGuido:
      "Total ago/set/oct cuadra con TXT pero mal ordenado; cuotas por Fecha Entrega + plazo en mes correcto.",
    captura:
      'image1.png · fórmula SI(O(Plazo="CONS";"OBS"); ImporteTotalCuotas; suma buckets − PAGADO)',
    reglaCanon: "G4 · PV/OK del saldo detallado con explosión cuotas",
    nexusHoy:
      "parse_pv_prog suma Importe_Cuota por vencimientos embebidos en TSV, no entrega + plazo.",
    respuesta:
      "El total orienta; la distribución mensual debe seguir Fecha Entrega + condiciones_pago.csv.",
    accion: "PV mes desde cuadro Guido / T14, no TSV directo en Sit Fin.",
    estado: "abierto",
  },
  {
    id: 6,
    concepto: "PAGO LUISITO",
    textoGuido: "Cuotas a vencer en el mes, TIPO COBRO Luisito.",
    reglaCanon: "G8 · pago_lui = {LUISITO} × M · entrega día >20 → día 5 mes sig.",
    nexusHoy:
      "Molecular luisito:{mes} = stock total LUISITO TXT (~2.015M) replicado en todos los meses.",
    respuesta:
      "Correcto: es cuota del mes LUISITO, no saldo acumulado de cartera.",
    accion: "Separar acordeón stock vs celda cuota mes; aplicar regla G8 en T14.",
    estado: "abierto",
  },
];

export const OBSERVACION_FINAL_GUIDO =
  "Misma lógica: fecha entrega → división cuotas → TIPO COBRO → cadenas; PV y PROG hasta mes del último cobro.";
