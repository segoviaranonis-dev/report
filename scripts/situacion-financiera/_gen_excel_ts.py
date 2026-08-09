# -*- coding: utf-8 -*-
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
jpath = ROOT / "src/lib/situacion-financiera/excel-al-0308.json"
out = ROOT / "src/lib/situacion-financiera/excel-al-0308.ts"
j = json.loads(jpath.read_text(encoding="utf-8"))
body = json.dumps(j, ensure_ascii=False, indent=2)
out.write_text(
    "import type { ExcelAlRow } from \"./types\";\n\n"
    "export type ExcelAlSnapshot = {\n"
    "  fechaAl: string;\n"
    "  tasaUsd: number;\n"
    "  titulo: string;\n"
    "  rows: ExcelAlRow[];\n"
    "};\n\n"
    f"export const EXCEL_AL_0308: ExcelAlSnapshot = {body};\n",
    encoding="utf-8",
)
print("ok", out, len(j["rows"]))
