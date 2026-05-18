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
          paper: "#faf8f4",
          paper2: "#f3f1ec",
          ink: "#1c1b19",
          navy: "#0a2342",
          navy2: "#133a5c",
          rule: "#dcd6cc",
          gold: "#7a6233",
          muted: "#5c5852",
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
