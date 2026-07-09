import { NextResponse } from "next/server";
import { isPoolSaturatedError, poolSaturatedResponse } from "@/lib/rimec/pool-saturated";

export function icApiErrorResponse(e: unknown, fallback: string) {
  if (isPoolSaturatedError(e)) {
    return NextResponse.json(poolSaturatedResponse(), { status: 503, headers: { "Retry-After": "15" } });
  }
  const msg = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}
