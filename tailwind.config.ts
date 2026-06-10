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

          // Información / acción primaria NIIF (RIMEC)
          info: "#002B4E",         // Azul institucional RIMEC
          "info-light": "#003d6b", // Azul RIMEC hover
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

        /** ACENTOS DE MARCA - BAZZAR NIIF */
        brand: {
          gold: "#ea580c",      // Alias legacy -> naranja BAZZAR
          "gold-dark": "#c2410c", // Alias legacy -> naranja oscuro
          bronze: "#9a3412",    // Acento tierra BAZZAR
        },

        /** COLORES INSTITUCIONALES NIIF PRO - RIMEC y BAZZAR */

        // 1. FONDOS CELESTES (Griseados/Profesionales)
        "app-bg": "#f1f5f9",          // Fondo general celeste griseado (8 horas sin cansancio)
        "app-bg-alt": "#e2e8f0",      // Alternativa celeste slate
        "card-bg": "#ffffff",         // Tarjetas blanco puro (flotan sobre fondo)

        // 2. RIMEC - Azul Institucional Exacto (RGB: 0, 43, 78)
        rimec: {
          "azul": "#002B4E",          // Azul institucional RIMEC (HSL: 138, 240, 37)
          "azul-dark": "#001829",     // Azul ultra oscuro (headers)
          "azul-light": "#003d6b",    // Azul claro para hover
          "celeste-bg": "#f1f5f9",    // Fondo sección (mismo que app-bg)
          "celeste": "#e2e8f0",       // Alias legacy para fondos suaves
          "petroleo": "#002B4E",      // Alias legacy -> azul RIMEC
          "light": "#ffffff",         // Alias legacy para texto claro
          "text-white": "#ffffff",    // Texto sobre azul
        },

        // 3. BAZZAR - Naranja Quemado Premium (Retail/Moda)
        bazzar: {
          "naranja": "#ea580c",       // Naranja arcilla principal (brand)
          "naranja-dark": "#c2410c",  // Naranja quemado oscuro
          "naranja-light": "#fb923c", // Alias legacy para hover/acento
          "azul": "#ea580c",          // Alias legacy -> naranja BAZZAR
          "azul-light": "#fb923c",    // Alias legacy -> naranja claro
          "text-white": "#ffffff",    // Texto blanco sobre naranja (WCAG AA)
          "text-dark": "#431407",     // Marrón oscuro alternativa (WCAG AA)
          "fondo": "#f1f5f9",         // Fondo sección (mismo que app-bg)
        },

        // ====================================================
        // LEGACY - Mantener temporalmente para compatibilidad
        // TODO: Migrar todos los usos a semantic/neutral/brand
        // ====================================================
        yellow: {
          400: "#002B4E",
          500: "#001829",
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
          primary: "#002B4E",
          accent: "#ea580c",
          gold: "#ea580c",
          navy: "#002B4E",
          navy2: "#001829",
          nav: "#002B4E",
          bg: "#f1f5f9",
          paper: "#ffffff",
          paper2: "#f1f5f9",
          ink: "#2d2520",
          muted: "#8a7f75",
          rule: "#cbd5e1",
          border: "#94a3b8",
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
