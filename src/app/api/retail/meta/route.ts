import { NextResponse } from "next/server";
import { isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { listRetailBatches } from "@/lib/retail/query-staging";
import type { RetailMetaResponse } from "@/lib/retail/types";

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    const body: RetailMetaResponse = { configured: false, batches: [] };
    return NextResponse.json(body);
  }
  try {
    const batches = await listRetailBatches();
    const body: RetailMetaResponse = { configured: true, batches };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error meta retail";
    return NextResponse.json({ configured: true, batches: [], error: msg } satisfies RetailMetaResponse, {
      status: 500,
    });
  }
}
