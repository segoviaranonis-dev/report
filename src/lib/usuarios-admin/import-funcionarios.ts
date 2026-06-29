/**
 * Importación usuario_v2 desde filas FUNCIONARIOS.xlsx (misma fuente que RRHH tiendas).
 */
import type { CreateUsuarioInput, CreateUsuarioResult } from "@/lib/usuarios-admin/queries";

export type FuncionarioExcelRow = {
  ENTE: string;
  LOCAL: number;
  NOMBRES: string;
  APELLIDOS: string;
  "N.º CEDULA": number | string;
  ROL: number;
  CATEGORIA: number;
  "CODIG.DE VENDEDOR"?: number;
};

export type ImportPreviewRow = {
  descp_usuario: string;
  ci: string;
  ente: string;
  rol_id: number;
  categoria_id: number;
  funcionario_id: number | null;
  accion: "insert" | "skip_existe" | "error";
  detalle?: string;
};

const ENTE_MAP: Record<string, number> = {
  FERNANDO: 2,
  "SAN MARTIN": 3,
  "SAN MARTÍN": 3,
  PALMA: 4,
};

export function limpiarCi(ciRaw: unknown): string {
  if (ciRaw == null || ciRaw === "") return "";
  return String(Math.trunc(Number(ciRaw)));
}

/** Usuario corto tipo tablet: primer nombre en mayúsculas. */
export function sugerirDescpUsuario(nombres: string, apellidos: string): string {
  const first = (nombres ?? "").trim().split(/\s+/)[0] ?? "";
  const lastInitial = (apellidos ?? "").trim()[0] ?? "";
  const base = first.toUpperCase();
  return lastInitial ? `${base}${lastInitial.toUpperCase()}` : base;
}

export function mapExcelRowToCreateInput(
  row: FuncionarioExcelRow,
  descpUsuario: string,
  password: string,
): CreateUsuarioInput {
  const enteKey = String(row.ENTE ?? "")
    .trim()
    .toUpperCase();
  const enteId = ENTE_MAP[enteKey];
  if (!enteId) throw new Error(`ENTE desconocido: ${row.ENTE}`);

  const rolId = Number(row.ROL);
  const categoriaId = Number(row.CATEGORIA);
  if (!rolId || !categoriaId) throw new Error("ROL o CATEGORIA inválidos");

  return {
    descpUsuario,
    password,
    rolId,
    categoriaId,
    enteId,
    esExterno: false,
  };
}

export function buildImportPreview(
  rows: FuncionarioExcelRow[],
  existentes: Set<string>,
  usernamesInBatch: Map<string, number>,
): ImportPreviewRow[] {
  const out: ImportPreviewRow[] = [];

  for (const row of rows) {
    try {
      const ci = limpiarCi(row["N.º CEDULA"]);
      if (!ci) {
        out.push({
          descp_usuario: "",
          ci: "",
          ente: String(row.ENTE ?? ""),
          rol_id: Number(row.ROL),
          categoria_id: Number(row.CATEGORIA),
          funcionario_id: null,
          accion: "error",
          detalle: "CI vacía",
        });
        continue;
      }

      let descp = sugerirDescpUsuario(row.NOMBRES, row.APELLIDOS);
      const key = descp.toLowerCase();
      const n = (usernamesInBatch.get(key) ?? 0) + 1;
      usernamesInBatch.set(key, n);
      if (n > 1) descp = `${descp}${n}`;

      if (existentes.has(descp.toLowerCase())) {
        out.push({
          descp_usuario: descp,
          ci,
          ente: String(row.ENTE ?? ""),
          rol_id: Number(row.ROL),
          categoria_id: Number(row.CATEGORIA),
          funcionario_id: null,
          accion: "skip_existe",
          detalle: "descp_usuario ya en BD",
        });
        continue;
      }

      out.push({
        descp_usuario: descp,
        ci,
        ente: String(row.ENTE ?? ""),
        rol_id: Number(row.ROL),
        categoria_id: Number(row.CATEGORIA),
        funcionario_id: null,
        accion: "insert",
      });
    } catch (e) {
      out.push({
        descp_usuario: "",
        ci: "",
        ente: String(row.ENTE ?? ""),
        rol_id: 0,
        categoria_id: 0,
        funcionario_id: null,
        accion: "error",
        detalle: e instanceof Error ? e.message : "Error fila",
      });
    }
  }

  return out;
}

export type ImportResultItem = CreateUsuarioResult & {
  ci: string;
  accion: "insert" | "skip";
  detalle?: string;
};

export type ImportBatchResult = {
  insertados: number;
  omitidos: number;
  errores: number;
  items: ImportResultItem[];
};
