import path from "path";

export type CostosLabTxtSource = {
  label: string;
  /** Orden: lab Director (Z:) → TXT empaquetado repo (prod). */
  candidates: string[];
};

const REPO_TXT = (name: string) =>
  path.join(process.cwd(), "data", "costos-lab", "txt", name);

/** Lab Director · TXT ifstgp4 isla costos (no stock SDRM). */
export const COSTOS_LAB_TXT_SOURCES: ReadonlyArray<CostosLabTxtSource> = [
  {
    label: "D1 · 23980722",
    candidates: ["Z:\\hector\\23980722.txt", REPO_TXT("23980722.txt")],
  },
  {
    label: "D3 · 23956181",
    candidates: ["Z:\\hector\\23956181.txt", REPO_TXT("23956181.txt")],
  },
];

/** @deprecated usar COSTOS_LAB_TXT_SOURCES */
export const COSTOS_LAB_TXT_HECTOR = COSTOS_LAB_TXT_SOURCES.map((s) => ({
  path: s.candidates[0],
  label: s.label,
}));

export const COSTOS_LAB_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "costos-lab",
  "snapshot.json",
);
