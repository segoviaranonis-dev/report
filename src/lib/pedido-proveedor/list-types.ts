export type PpListaRow = {
  id: number;
  numero_registro: string;
  estado: string;
  estado_digitacion: string | null;
  categoria_id: number | null;
  pares_comprometidos: number;
  total_vendido: number;
  proveedor: string;
  marcas: string;
  ics: string;
  nro_fabrica: string;
  quincena: string | null;
  quincena_arribo_id: number | null;
  fecha_arribo_estimada: string | null;
  numero_proforma: string | null;
  cliente: string;
  vendedor: string;
  nro_factura_importacion: string | null;
  total_articulos: number;
  n_fi_confirmadas: number;
};

export type PpQuincenaGrupo = {
  key: string;
  quincena: string;
  quincena_arribo_id: number | null;
  pedidos: PpListaRow[];
  n_preventas: number;
  total_pares: number;
  total_vendido: number;
  pct_ejecutado: number;
};

/** Agrupa PP por FECHA DE EMBARQUE (quincena_arribo / dato duro). Safe client. */
export function groupPedidosPorQuincena(pedidos: PpListaRow[]): PpQuincenaGrupo[] {
  const map = new Map<string, PpQuincenaGrupo>();

  for (const p of pedidos) {
    const quincena = p.quincena?.trim() || "Sin fecha de embarque";
    const key = p.quincena_arribo_id != null ? `q-${p.quincena_arribo_id}` : `z-${quincena}`;

    let g = map.get(key);
    if (!g) {
      g = {
        key,
        quincena,
        quincena_arribo_id: p.quincena_arribo_id,
        pedidos: [],
        n_preventas: 0,
        total_pares: 0,
        total_vendido: 0,
        pct_ejecutado: 0,
      };
      map.set(key, g);
    }
    g.pedidos.push(p);
    g.n_preventas += 1;
    g.total_pares += p.pares_comprometidos;
    g.total_vendido += p.total_vendido;
  }

  const grupos = [...map.values()].map((g) => ({
    ...g,
    pct_ejecutado: g.total_pares > 0 ? Math.round((g.total_vendido / g.total_pares) * 1000) / 10 : 0,
  }));

  grupos.sort((a, b) => {
    const sa = a.quincena_arribo_id ?? 9999;
    const sb = b.quincena_arribo_id ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.quincena.localeCompare(b.quincena, "es");
  });

  return grupos;
}
