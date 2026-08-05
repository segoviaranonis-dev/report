import type { DepositoRow } from "@/app/api/depositos/[cliente_id]/route";

export type DepositoWebPayload = {
  configured: boolean;
  ingreso: DepositoRow[];
  vendible: DepositoRow[];
  vendibleOk: boolean;
};
