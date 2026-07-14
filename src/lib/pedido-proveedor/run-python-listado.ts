import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONTROL_CENTRAL = path.resolve(process.cwd(), "..", "control_central");
const SCRIPT = path.join(CONTROL_CENTRAL, "scripts", "report_vincular_listado_pp.py");

export type VincularListadoResult = {
  ok: boolean;
  message?: string;
  error?: string;
  stats?: {
    fi_procesadas?: number;
    fi_actualizadas?: number;
    lineas_actualizadas?: number;
    lineas_sin_precio?: number;
    snapshot?: {
      actualizados?: number;
      filas_congeladas_venta?: number;
      filas_vendidas_forzadas?: number;
      filas_sin_match?: number;
    };
    lineas_congeladas_venta?: number;
    lineas_vendidas_forzadas?: number;
    delta_monto_fi?: number;
    monto_fi_antes?: number;
    monto_fi_despues?: number;
  };
  solo_recalc?: boolean;
};

type ListadoOpts = {
  eventoId?: number;
  soloRecalc?: boolean;
  recalcularFi?: boolean;
  incluirConfirmadas?: boolean;
  incluirVendidos?: boolean;
};

async function runListadoPython(ppId: number, opts: ListadoOpts): Promise<VincularListadoResult> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL no configurada" };
  }

  const args = ["--pp-id", String(ppId)];
  if (opts.soloRecalc) {
    args.push("--solo-recalc");
  } else if (opts.eventoId != null) {
    args.push("--evento-id", String(opts.eventoId));
  }
  if (opts.recalcularFi === false) args.push("--no-recalc-fi");
  if (opts.incluirConfirmadas) args.push("--incluir-confirmadas");
  if (opts.incluirVendidos) args.push("--incluir-vendidos");

  try {
    const python = process.env.PYTHON_PATH || "python";
    const { stdout, stderr } = await execFileAsync(python, [SCRIPT, ...args], {
      cwd: CONTROL_CENTRAL,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180_000,
    });
    const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
    return JSON.parse(line) as VincularListadoResult;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const tail = err.stdout?.trim().split("\n").filter(Boolean).pop();
    if (tail) {
      try {
        return JSON.parse(tail) as VincularListadoResult;
      } catch {
        /* fall through */
      }
    }
    return {
      ok: false,
      error: err.stderr?.trim() || err.message || "Error ejecutando vincular listado",
    };
  }
}

export function runVincularListadoPython(
  ppId: number,
  eventoId: number,
  opts: { recalcularFi?: boolean; incluirConfirmadas?: boolean; incluirVendidos?: boolean },
): Promise<VincularListadoResult> {
  return runListadoPython(ppId, {
    eventoId,
    recalcularFi: opts.recalcularFi ?? true,
    incluirConfirmadas: opts.incluirConfirmadas ?? false,
    incluirVendidos: opts.incluirVendidos ?? false,
  });
}

export function runRecalcularFiPython(
  ppId: number,
  incluirConfirmadas: boolean,
  incluirVendidos = false,
): Promise<VincularListadoResult> {
  return runListadoPython(ppId, { soloRecalc: true, incluirConfirmadas, incluirVendidos });
}
