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
        /** Informe RIMEC — estética minimal retail (neutros cálidos, sin oro / sin UI oscura tipo Streamlit). */
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
