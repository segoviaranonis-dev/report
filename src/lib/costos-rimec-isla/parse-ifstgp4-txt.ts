/**
 * Parser TXT `ifstgp4` — isla costos · no toca stock SDRM.
 * Formato Carlos real: línea código+desc · línea detalle (mat/color/dls/lpn/stock).
 */

import {
  dpeFromGrupoTexto,
  isGrupoBannerLine,
  parseCodigoPrefijo,
  slotFromDepositoKey,
} from "./dpe-from-grupo";
import { parseLineaReferenciaFromDesc, enrich638Pilares } from "./molecule-label";
import type { CostosTxtArchivo, CostosTxtLinea } from "./types";

const CODIGO_RE = /^\s*(638\.\d+|654\.\d+)\s+(.*)$/;

export function parseNumErp(raw: string): number {
  const s = raw.trim();
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (s.includes(",") && !s.includes(".")) {
    const [left, right] = s.split(",", 2);
    if (/^\d+$/.test(right) && right.length === 3 && /^-?\d+$/.test(left.replace("-", ""))) {
      return Number(s.replace(/,/g, ""));
    }
    return Number(s.replace(",", "."));
  }
  return Number(s.replace(/,/g, ""));
}

export function depositoKeyFromCabecera(raw: string | null): string {
  if (!raw) return "SIN_DEPOSITO";
  return raw.trim().toUpperCase();
}

export function extractDepositoCabecera(text: string): string | null {
  const head = text.split(/\r?\n/).slice(0, 12).join("\n");
  const m = head.match(/DEPOSITO:\s*(\S+)/i);
  return m?.[1]?.trim() ?? null;
}

function parseDetailLine(
  raw: string,
  tipoV2Id: 1 | 2 | null,
): {
  material: string;
  color: string;
  colorExcel: string | null;
  grada: string | null;
  dlsUsd: number;
  lpnGs: number;
  qty: number;
  proveedorId: 654 | 638 | null;
} | null {
  const b = raw.trim();
  if (!b || b.length < 10) return null;

  const tail = b.match(/(\d+[.,]\d+)\s+([\d,]+)\s+(\d+)\s*$/);
  if (!tail) return null;
  const dlsUsd = parseNumErp(tail[1]);
  const lpnGs = parseNumErp(tail[2]);
  const qty = parseNumErp(tail[3]);

  const prov = b.match(/\b(654|638)\s+CR-/i);
  const proveedorId = prov
    ? (Number(prov[1]) as 654 | 638)
    : tipoV2Id === 2
      ? 638
      : tipoV2Id === 1
        ? 654
        : null;

  let material = "0";
  let color = "0";
  let colorExcel: string | null = null;
  let grada: string | null = null;

  if (proveedorId === 638 || tipoV2Id === 2) {
    const m638 = b.match(/^\s*(\d+)\s+(K\d+)\s+(K\d+)/i);
    if (m638) {
      grada = m638[1];
      material = m638[2].toUpperCase();
      colorExcel = m638[3].toUpperCase();
      color = colorExcel.replace(/^K/i, "") || colorExcel;
    }
  } else {
    const m654 = b.match(/^\s*[A-Z]{1,3}\s+(\d+)\s+(\d+)/);
    if (m654) {
      material = m654[1];
      color = m654[2];
    }
  }

  if (material === "0" && color === "0") return null;
  return { material, color, colorExcel, grada, dlsUsd, lpnGs, qty, proveedorId };
}

export function parseIfstgp4TxtContent(
  text: string,
  depositoKey: string,
): CostosTxtLinea[] {
  const lines = text.split(/\r?\n/);
  const out: CostosTxtLinea[] = [];
  let grupoTexto = "";
  let i = 0;
  while (i < lines.length - 1) {
    const a = lines[i] ?? "";
    const b = lines[i + 1] ?? "";
    const trimmed = a.trim();
    if (isGrupoBannerLine(trimmed)) {
      grupoTexto = trimmed;
      i += 1;
      continue;
    }
    const m = a.match(CODIGO_RE);
    if (m) {
      const cod = m[1].trim();
      const descripcion = (m[2] ?? "").trim();
      const pref = parseCodigoPrefijo(cod);
      const lr = parseLineaReferenciaFromDesc(descripcion, pref.tipoV2Id);
      const det = parseDetailLine(b, pref.tipoV2Id);
      if (det) {
        const dpe = dpeFromGrupoTexto(grupoTexto, pref.tipoV2Id);
        const proveedorId = det.proveedorId ?? pref.proveedorId;
        const row: CostosTxtLinea = {
          codigo: cod,
          descripcion,
          qty: det.qty,
          dlsUsd: det.dlsUsd,
          lpnGs: det.lpnGs,
          montoUsd: det.dlsUsd * det.qty,
          depositoKey,
          grupoTexto,
          linea: lr.linea,
          referencia: lr.referencia,
          material: det.material,
          color: det.color,
          imagenColorExcel: det.colorExcel,
          grada: det.grada,
          tipoV2Id: pref.tipoV2Id,
          proveedorId,
          marca: dpe.marca,
          ramo: dpe.ramo,
          tipo1: dpe.tipo1,
          cadena: dpe.cadena,
        };
        enrich638Pilares(row);
        out.push(row);
      }
      i += 2;
      continue;
    }
    i += 1;
  }
  return out;
}

/** Agrega por código dentro del mismo depósito. */
function aggregateLineas(lineas: CostosTxtLinea[]): CostosTxtLinea[] {
  const map = new Map<string, CostosTxtLinea>();
  for (const l of lineas) {
    const prev = map.get(l.codigo);
    if (!prev) {
      map.set(l.codigo, { ...l });
      continue;
    }
    prev.qty += l.qty;
    prev.montoUsd += l.montoUsd;
  }
  return [...map.values()];
}

export function buildArchivoFromTxt(nombre: string, text: string): CostosTxtArchivo {
  const depositoCabecera = extractDepositoCabecera(text);
  const depositoKey = depositoKeyFromCabecera(depositoCabecera);
  const depositoSlot = slotFromDepositoKey(depositoKey);
  const lineas = aggregateLineas(parseIfstgp4TxtContent(text, depositoKey));
  let pares = 0;
  let montoUsd = 0;
  let valorLpnGs = 0;
  for (const l of lineas) {
    pares += l.qty;
    montoUsd += l.montoUsd;
    valorLpnGs += l.lpnGs * l.qty;
  }
  return {
    nombre,
    depositoCabecera,
    depositoKey,
    depositoSlot,
    lineas,
    articulos: lineas.length,
    pares,
    montoUsd,
    valorLpnGs,
  };
}
