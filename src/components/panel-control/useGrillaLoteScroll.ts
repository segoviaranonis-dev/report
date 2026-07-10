"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PeImportadoraCard } from "@/lib/depositos/agrupar-pe-importadora";
import {
  GRILLA_LOTE_INICIAL,
  GRILLA_LOTE_SCROLL,
  type GrillaLoteModo,
} from "@/lib/panel-control/grilla-carga-lotes";

type Args = {
  cards: PeImportadoraCard[];
  modo: GrillaLoteModo;
  loteInicial?: number;
  loteScroll?: number;
};

export function useGrillaLoteScroll({
  cards,
  modo,
  loteInicial = GRILLA_LOTE_INICIAL,
  loteScroll = GRILLA_LOTE_SCROLL,
}: Args) {
  const [limitUnitario, setLimitUnitario] = useState(loteInicial);
  const [limitCalzado, setLimitCalzado] = useState(loteInicial);
  const [limitConf, setLimitConf] = useState(loteInicial);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLimitUnitario(loteInicial);
    setLimitCalzado(loteInicial);
    setLimitConf(loteInicial);
  }, [cards, loteInicial, modo]);

  const { visible, total, hasMore } = useMemo(() => {
    if (modo === "pe-dual-ramo") {
      const calzado = cards.filter((c) => c.producto.tipo_v2_id === 1);
      const conf = cards.filter((c) => c.producto.tipo_v2_id === 2);
      const otros = cards.filter((c) => c.producto.tipo_v2_id !== 1 && c.producto.tipo_v2_id !== 2);
      const vis = [
        ...calzado.slice(0, limitCalzado),
        ...conf.slice(0, limitConf),
        ...otros,
      ];
      const totalVis = calzado.length + conf.length + otros.length;
      const more =
        limitCalzado < calzado.length ||
        limitConf < conf.length ||
        (otros.length > 0 && vis.length < cards.length);
      return { visible: vis, total: totalVis, hasMore: more };
    }
    const vis = cards.slice(0, limitUnitario);
    return {
      visible: vis,
      total: cards.length,
      hasMore: limitUnitario < cards.length,
    };
  }, [cards, modo, limitUnitario, limitCalzado, limitConf]);

  const cargarMas = useCallback(() => {
    if (modo === "pe-dual-ramo") {
      setLimitCalzado((n) => n + loteScroll);
      setLimitConf((n) => n + loteScroll);
    } else {
      setLimitUnitario((n) => n + loteScroll);
    }
  }, [modo, loteScroll]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cargarMas();
      },
      { rootMargin: "320px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cargarMas, hasMore]);

  return {
    visibleCards: visible,
    totalProductos: total,
    visibleCount: visible.length,
    hasMore,
    cargarMas,
    sentinelRef,
  };
}
