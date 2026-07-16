/**
 * Índice Report — tres entes canónicos (single source of truth).
 * RIMEC · BAZZAR tiendas · BAZZAR WEB e-commerce.
 * Doc: docs/HUB_INDEX_GRUPOS.md
 */

import { hubGroupsForEnte } from "@/lib/auth/ente-acceso";

export type ReportHubGroup = "rimec" | "bazzar" | "bazzar-web" | "recursos";

export type ReportHubModule = {
  href: string;
  title: string;
  description: string;
  icon: string;
  group: ReportHubGroup;
  /** Nav key para NexusHeaderZen active state */
  navKey?: string;
  roles: number[];
  nivelDios?: boolean;
  bazzarAdminOnly?: boolean;
  rimecAdminOnly?: boolean;
  /** Etiqueta corta en header zen */
  shortLabel?: string;
};

export const REPORT_HUB_GROUP_META: Record<
  Exclude<ReportHubGroup, "recursos">,
  { label: string; icon: string; moria: string }
> = {
  rimec: {
    label: "RIMEC",
    icon: "🏢",
    moria: "Importadora · gerencia · pilares · RRHH",
  },
  bazzar: {
    label: "BAZZAR",
    icon: "🏪",
    moria: "Tiendas físicas · Retail · depósitos · Tablet POS",
  },
  "bazzar-web": {
    label: "BAZZAR WEB",
    icon: "🌐",
    moria: "E-commerce · ALM_WEB_01 · precio web · compra",
  },
};

/** Orden fijo — no mezclar grupos en UI. */
export const REPORT_HUB_MODULES: ReportHubModule[] = [
  // ── RIMEC (2.3.1.1–2.3.1.7) ──
  {
    href: "/rimec",
    title: "RIMEC — Ventas",
    shortLabel: "Ventas",
    description:
      "Sales Report · Análisis multidimensional de ventas (Clientes, Marcas, Vendedores) con drill-down, jerarquías y KPIs ejecutivos.",
    icon: "📊",
    group: "rimec",
    navKey: "rimec",
    roles: [1],
  },
  {
    href: "/ventas-fotos",
    title: "Ventas + Fotos",
    shortLabel: "Ventas + Fotos",
    description:
      "Catálogo con ventas · Productos con imagen, venta por período, filtros por marca/estilo/género, PDF ejecutivo descargable.",
    icon: "🖼️",
    group: "rimec",
    navKey: "ventas-fotos",
    roles: [1, 3],
  },
  {
    href: "/aprobaciones",
    title: "Aprobaciones",
    shortLabel: "Aprobaciones",
    description:
      "Workflow de aprobación · Pedidos pendientes de confirmación, detalle de facturas, validación operativa interna.",
    icon: "✅",
    group: "rimec",
    navKey: "aprobaciones",
    roles: [1],
    nivelDios: true,
  },
  {
    href: "/pilares",
    title: "Administrador de Pilares",
    shortLabel: "Pilares",
    description:
      "Catálogo L+R · Editar linea (marca, género) y linea_referencia (estilo, tipo_1). Calzado y confecciones (ref K).",
    icon: "🧱",
    group: "rimec",
    navKey: "pilares",
    roles: [1],
  },
  {
    href: "/rrhh",
    title: "RRHH",
    shortLabel: "RRHH",
    description:
      "Recursos Humanos · Gestión de funcionarios por ente (RIMEC + tiendas). Consulta de departamentos, cargos, antigüedad.",
    icon: "👥",
    group: "rimec",
    navKey: "rrhh",
    roles: [1],
  },
  {
    href: "/proceso-importacion",
    title: "Proceso de importación",
    shortLabel: "Importación",
    description:
      "RIMEC importadora · Motor precios · Excel · IC · Digitación · PP (2.3.1.7).",
    icon: "📦",
    group: "rimec",
    navKey: "proceso-importacion",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/holding/bitacora",
    title: "Bitácora holding",
    shortLabel: "Bitácora",
    description:
      "Governance P8–P11 · flujo_auditoria · bloqueo usuarios · cierre post-COMPRA.",
    icon: "📋",
    group: "rimec",
    navKey: "home",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/compra-legal",
    title: "Compra legal",
    shortLabel: "Compra legal",
    description:
      "Consolidación PPs · compras legales · traspasos hacia facturación (2.3.1.8).",
    icon: "🏛️",
    group: "rimec",
    navKey: "compra-legal",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/facturacion",
    title: "Facturación",
    shortLabel: "Facturación",
    description:
      "FAC-INT · tránsito y Pronta Entrega · distribución sucursales (2.3.1.9).",
    icon: "🧾",
    group: "rimec",
    navKey: "facturacion",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/deposito-rimec",
    title: "Depósito RIMEC",
    shortLabel: "Depósito RIMEC",
    description:
      "Saldo físico importadora · ALM_DEPOSITO_RIMEC (2.3.1.10).",
    icon: "🏭",
    group: "rimec",
    navKey: "deposito-rimec",
    roles: [1],
    rimecAdminOnly: true,
  },

  // ── BAZZAR tiendas (2.3.2, 2.3.6, 2.3.9/tablet) ──
  {
    href: "/retail",
    title: "Stock / Retail",
    shortLabel: "Stock / Retail",
    description:
      "Dashboard multi-tienda · Seguimiento de stock y ventas por línea, referencia, color. Ranking top productos con imágenes.",
    icon: "👟",
    group: "bazzar",
    navKey: "retail",
    roles: [1, 2],
  },
  {
    href: "/depositos-bazzar",
    title: "Depósitos Bazzar",
    shortLabel: "Depósitos",
    description:
      "Administrador de depósitos · 6 tiendas × 3 categorías. Sync Retail → Tablet POS.",
    icon: "🏪",
    group: "bazzar",
    navKey: "depositos-bazzar",
    roles: [1, 2],
  },
  {
    href: "/tablet-bazzar",
    title: "Caja Bazzar",
    shortLabel: "Caja",
    description:
      "Módulo cajero · 6 tiendas · bandeja tickets CSV/FACTURADO. POS vendedor en tablet-bazzar.vercel.app.",
    icon: "🧾",
    group: "bazzar",
    navKey: "tablet-bazzar",
    roles: [1, 2],
  },
  {
    href: "/bobeda-oro",
    title: "Bóveda de Oro",
    shortLabel: "Bóveda ORO",
    description:
      "Histórico ventas POS · bobeda_venta_pos · 6 tiendas · filtros por tienda, estado, factura, molécula y trazabilidad depósito/Excel.",
    icon: "🏆",
    group: "bazzar",
    navKey: "bobeda-oro",
    roles: [1, 2],
  },

  // ── BAZZAR WEB (2.3.7 · rutas /bazzar-web/*) ──
  {
    href: "/bazzar-web/compra",
    title: "Compra",
    shortLabel: "Compra",
    description:
      "Recepción web · Confirmar traspasos desde Facturación RIMEC hacia ALM_WEB_01.",
    icon: "🛒",
    group: "bazzar-web",
    navKey: "bazzar-web-compra",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/bazzar-web/deposito-web",
    title: "Depósito Web",
    shortLabel: "Depósito Web",
    description: "Stock ALM_WEB_01 · 5 pilares + talla para catálogo e-commerce.",
    icon: "📦",
    group: "bazzar-web",
    navKey: "bazzar-web-deposito",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/bazzar-web/motor-precio",
    title: "Motor de precio WEB",
    shortLabel: "Precio WEB",
    description: "Reglas markup · publicación precio_web para www.bazzar.com.py.",
    icon: "💰",
    group: "bazzar-web",
    navKey: "bazzar-web-motor",
    roles: [1],
    rimecAdminOnly: true,
  },
  {
    href: "/bazzar-web/stock-sano",
    title: "Stock Sano",
    shortLabel: "Stock Sano",
    description: "Protocolo aduanero ALM_WEB_01 · precio canónico L+R+Material.",
    icon: "✓",
    group: "bazzar-web",
    navKey: "bazzar-web-stock",
    roles: [1],
    rimecAdminOnly: true,
  },

  // ── Recursos (no mezclar con los tres entes) ──
  {
    href: "/informes",
    title: "Anexo Documental",
    description:
      "Repositorio de reportes · Documentación técnica, guías de uso, mapas de paridad.",
    icon: "📄",
    group: "recursos",
    navKey: "informes",
    roles: [1],
  },
  {
    href: "/informes/bazzar-web",
    title: "Índice BAZZAR WEB",
    description: "Anexo e-commerce · cadena ALM_WEB_01 → precio_web → tienda.",
    icon: "🌐",
    group: "recursos",
    roles: [1],
  },
];

export function filterHubModules(
  modules: ReportHubModule[],
  rolId: number,
  categoria: string | null,
  canDios: boolean,
  enteCodigo?: number | null,
): ReportHubModule[] {
  const allowedGroups = new Set(hubGroupsForEnte(enteCodigo, rolId));
  const cat = (categoria || "").toUpperCase().trim();

  return modules.filter((m) => {
    if (!allowedGroups.has(m.group)) return false;

    // CAJA RIMEC: solo Facturación (home real = Pronta Entrega vía middleware)
    if (rolId === 1 && cat === "CAJA") {
      return m.href === "/facturacion";
    }

    // Matriz: rol 2 = solo columna BAZZAR tienda (retail · depósitos · caja)
    if (rolId === 2) {
      if (m.group !== "bazzar") return false;
      if (m.href === "/tablet-bazzar") {
        return categoria === "ADMIN" || categoria === "SU";
      }
      if (m.href === "/depositos-bazzar") {
        return categoria === "ADMIN";
      }
      if (m.href === "/retail") {
        return categoria === "ADMIN" || categoria === "VENDEDOR";
      }
      if (m.href === "/bobeda-oro") {
        return categoria === "ADMIN";
      }
      return false;
    }

    if (m.nivelDios && !canDios) return false;
    if (m.rimecAdminOnly && rolId !== 1) return false;
    if (m.bazzarAdminOnly && !(rolId === 1 || (rolId === 2 && categoria === "ADMIN"))) {
      return false;
    }
    if (m.href === "/tablet-bazzar") {
      return rolId === 1 || (rolId === 2 && (categoria === "ADMIN" || categoria === "SU"));
    }
    if (m.href === "/depositos-bazzar") {
      return rolId === 1 || (rolId === 2 && categoria === "ADMIN");
    }
    if (m.href === "/retail") {
      return rolId === 1 || (rolId === 2 && (categoria === "ADMIN" || categoria === "VENDEDOR"));
    }
    if (m.href === "/bobeda-oro") {
      return rolId === 1 || (rolId === 2 && categoria === "ADMIN");
    }
    return m.roles.includes(rolId);
  });
}

export function modulesByGroup(
  visible: ReportHubModule[],
  group: ReportHubGroup,
): ReportHubModule[] {
  return visible.filter((m) => m.group === group);
}
