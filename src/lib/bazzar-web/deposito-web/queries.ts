import {
  getDepositoRowsIngreso,
  getDepositoRowsVendible,
} from "./deposito-web-rows";
import type { DepositoWebPayload } from "./types";

export type { DepositoWebPayload } from "./types";

export async function fetchDepositoWebData(): Promise<Omit<DepositoWebPayload, "configured">> {
  const [ingresoSettled, vendibleSettled] = await Promise.allSettled([
    getDepositoRowsIngreso(),
    getDepositoRowsVendible(),
  ]);

  if (ingresoSettled.status === "rejected") {
    throw ingresoSettled.reason;
  }

  const ingreso = ingresoSettled.value;
  let vendible: DepositoWebPayload["vendible"] = [];
  let vendibleOk = true;
  if (vendibleSettled.status === "fulfilled") {
    vendible = vendibleSettled.value;
  } else {
    vendibleOk = false;
    console.warn("[deposito-web] v_stock_web:", vendibleSettled.reason);
  }

  return { ingreso, vendible, vendibleOk };
}
