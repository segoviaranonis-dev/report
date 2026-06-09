import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ====================================================
        // SISTEMA NIIF UI - PALETA UNIFICADA SEMÁNTICA
        // Consolida rim + exec + report en un solo sistema
        // ====================================================

        /** ESTADOS SEMÁNTICOS - Uso universal en toda la app */
        semantic: {
          // Éxito / Positivo (fusión exec.pos + rim.good)
          success: "#2f4f3e",      // Verde oscuro (WCAG AA)
          "success-light": "#34d399", // Verde vibrante (alertas)

          // Error / Negativo (fusión exec.neg + rim.bad)
          error: "#8c3b3b",        // Rojo oscuro (WCAG AA)
          "error-light": "#fb7185", // Rosa-rojo (alertas)

          // Advertencia (rim.warn)
          warning: "#d97706",      // Ámbar oscuro (WCAG AA)
          "warning-light": "#fbbf24", // Amarillo (alertas)

          // Información (rim.accent)
          info: "#0284c7",         // Azul oscuro (WCAG AA)
          "info-light": "#38bdf8", // Azul cielo (alertas)
        },

        /** NEUTROS - Fondos, textos, bordes */
        neutral: {
          // Fondos oscuros (RIMEC inmersivo - rim.*)
          950: "#070b12",  // void - Fondo principal oscuro
          900: "#0c1220",  // ink - Fondo secundario oscuro
          800: "#111827",  // panel - Paneles oscuros
          700: "#1e293b",  // line - Líneas oscuras

          // Fondos claros (Report/Admin - exec.* + report.*)
          50: "#faf8f3",   // paper - Fondo principal claro
          100: "#f4f2ee",  // canvas - Fondo secundario claro
          200: "#ede9df",  // paper2 - Fondo terciario
          300: "#d4cfc4",  // rule - Bordes suaves
          400: "#c9c3b8",  // border - Bordes definidos

          // Textos oscuros (sobre fondos claros)
          ink: "#2d2520",       // WCAG AAA - Texto principal
          "ink-medium": "#4a3f35", // WCAG AA - Texto secundario
          "ink-muted": "#6b6660",  // WCAG AA - Texto terciario
          "ink-subtle": "#8a7f75", // Hints/placeholders

          // Textos claros (sobre fondos oscuros)
          light: "#ffffff",      // Blanco puro
          "light-88": "rgba(255,255,255,0.88)", // Principal
          "light-72": "rgba(255,255,255,0.72)", // Secundario
          "light-55": "rgba(255,255,255,0.55)", // Terciario
          "light-40": "rgba(255,255,255,0.40)", // Muted
        },

        /** ACENTOS DE MARCA - Oro elegante (retail/moda) */
        brand: {
          gold: "#D4AF37",      // Oro primario
          "gold-dark": "#B89329", // Oro oscuro
          bronze: "#8b7355",    // Bronce/accent
        },

        /** COLORES INSTITUCIONALES - RIMEC y BAZZAR */
        rimec: {
          "celeste": "#87CEEB",      // Celeste cielo
          "azul": "#1E3A8A",          // Azul marino normal
          "petroleo": "#0C2340",      // Azul marino petróleo (oscuro)
          "light": "#BFDBFE",         // Celeste claro para fondos
        },
        bazzar: {
          "azul": "#2563EB",          // Azul institucional
          "naranja": "#F97316",       // Naranja institucional
          "azul-light": "#DBEAFE",    // Azul claro para fondos
          "naranja-light": "#FED7AA", // Naranja claro para fondos
        },

        // ====================================================
        // LEGACY - Mantener temporalmente para compatibilidad
        // TODO: Migrar todos los usos a semantic/neutral/brand
        // ====================================================
        yellow: {
          400: "#D4AF37",
          500: "#B89329",
        },
        rim: {
          void: "#070b12",
          ink: "#0c1220",
          panel: "#111827",
          line: "#1e293b",
          accent: "#38bdf8",
          good: "#34d399",
          warn: "#fbbf24",
          bad: "#fb7185",
          muted: "#94a3b8",
        },
        exec: {
          canvas: "#f4f2ee",
          wash: "#ebe8e2",
          surface: "#ffffff",
          line: "#ded9d1",
          "line-subtle": "#ece9e4",
          ink: "#121110",
          navy: "#1e2a32",
          muted: "#6b6660",
          subtle: "#9c9791",
          pos: "#2f4f3e",
          neg: "#8c3b3b",
        },
        report: {
          primary: "#4a3f35",
          accent: "#8b7355",
          navy: "#3d342c",
          navy2: "#2d2520",
          nav: "#3d342c",
          bg: "#f5f1e8",
          paper: "#faf8f3",
          paper2: "#ede9df",
          ink: "#2d2520",
          muted: "#8a7f75",
          rule: "#d4cfc4",
          border: "#c9c3b8",
        },
      },
      boxShadow: {
        panel: "0 0 0 1px rgb(30 41 59 / 0.6), 0 18px 50px rgb(0 0 0 / 0.45)",
        exec: "0 1px 0 rgb(18 17 16 / 0.05), 0 14px 36px rgb(18 17 16 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.9)",
      },
      fontFamily: {
        sans: ["var(--font-report-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-report-serif)", "Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
