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
