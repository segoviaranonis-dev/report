import { NextResponse } from "next/server";
import { getRimecPool, isRimecDatabaseConfigured } from "@/lib/rimec/pool";
import { isPoolSaturatedError, poolSaturatedResponse } from "@/lib/rimec/pool-saturated";

/** Catálogo maestro de marcas (Sales Report lee dimensión desde `marca_v2`, no solo apariciones sueltas). */
function catalogoMarcasMaestroSql() {
  return `
    SELECT TRIM(BOTH FROM descp_marca::text) AS v
    FROM marca_v2
    WHERE descp_marca IS NOT NULL
      AND LENGTH(TRIM(BOTH FROM descp_marca::text)) > 0
    ORDER BY 1 NULLS LAST
    LIMIT 8000
  `;
}

/** Valores distintos en `v_ventas_pivot` para dimensiones que no tienen tabla maestra dedicada en esta ruta. */
function distinctPivotTextSql(column: "cadena" | "vendedor") {
  return `
    SELECT DISTINCT TRIM(BOTH FROM ${column}::text) AS v
    FROM v_ventas_pivot
    WHERE ${column} IS NOT NULL
      AND LENGTH(TRIM(BOTH FROM ${column}::text)) > 0
    ORDER BY 1 NULLS LAST
    LIMIT 5000
  `;
}

function uniqStrings(rows: { v: string | null }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const s = (r.v ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export async function GET() {
  if (!isRimecDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      categorias: [] as { id_categoria: number; nombre: string }[],
      tipos: [] as string[],
      marcasCatalogo: [] as string[],
      cadenasCatalogo: [] as string[],
      vendedoresCatalogo: [] as string[],
    });
  }
  try {
    const pool = getRimecPool();
    const [cats, tipos, marcas, cadenas, vendedores] = await Promise.all([
      pool.query<{ id_categoria: number; nombre: string }>(
        `SELECT id_categoria, TRIM(descp_categoria) AS nombre FROM categoria_v2 ORDER BY id_categoria`
      ),
      pool.query<{ descp_tipo: string }>(
        `SELECT DISTINCT TRIM(descp_tipo) AS descp_tipo FROM tipo_v2 WHERE descp_tipo IS NOT NULL ORDER BY 1`
      ),
      pool.query<{ v: string | null }>(catalogoMarcasMaestroSql()),
      pool.query<{ v: string | null }>(distinctPivotTextSql("cadena")),
      pool.query<{ v: string | null }>(distinctPivotTextSql("vendedor")),
    ]);
    return NextResponse.json({
      configured: true,
      categorias: cats.rows,
      tipos: tipos.rows.map((x) => x.descp_tipo).filter(Boolean),
      marcasCatalogo: uniqStrings(marcas.rows),
      cadenasCatalogo: uniqStrings(cadenas.rows),
      vendedoresCatalogo: uniqStrings(vendedores.rows),
    });
  } catch (e) {
    if (isPoolSaturatedError(e)) {
      const sat = poolSaturatedResponse();
      return NextResponse.json({ error: sat.error, code: sat.code }, { status: 503, headers: { "Retry-After": "15" } });
    }
    const msg = e instanceof Error ? e.message : "Error meta RIMEC";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
